const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const archiver = require('archiver');
const db = require('../config/db');
const { getAssignedYearLevels, applyOfficerYearLevelFilter, normalizeYearLevel, yearLevelSqlExpression } = require('../utils/officerAssignments');
const cloudinary = require('../config/cloudinary');
const nodemailer = require('nodemailer');
const letterPdfGenerator = require('../services/letterPdfGenerator');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { normalizeSubmissionValue } = require('../utils/submissionPayload');
const { logComplianceIncident, clampCompliance, getComplianceSettings, calculateCurrentCompliance, resolveGradeScale } = require('../utils/complianceLogger');
const { logAuditEvent } = require('../utils/auditLogger');
const { canAccessScholar, logPrivacyAccess } = require('../middleware/privacyAccess');
const { consumeCompleted, removeSession } = require('../services/resumableUploadService');
const { predictSentimentForLetter, predictContentScoreForLetter, mapSentimentValueToLabel } = require('../services/sentimentService');
const { predictLetterScore, mapQualityStatus, mapQualityLabel } = require('../services/letterScoreService');

const normalizeManualWorkflowStatus = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (['pending', 'under_review', 'approved', 'returned', 'rejected'].includes(normalized)) {
        return normalized;
    }
    if (['needs_revision', 'needs-revision', 'needs revision'].includes(normalized)) {
        return 'returned';
    }
    if (normalized === 'rejected') {
        return 'returned';
    }
    return 'pending';
};

const isDuplicateRequirementSubmissionAllowed = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    return ['rejected', 'returned', 'needs_revision', 'needs-revision', 'needs revision'].includes(normalized);
};

const taskTypeForSubmission = {
    letter: 'Monthly Report',
    report_card: 'Report Card',
    cor: 'COR Upload',
};

const parseTaskYearLevels = (value) => {
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const findLatestAssignedTask = async (scholarId, submissionType) => {
    const taskType = taskTypeForSubmission[submissionType];
    if (!taskType) return null;
    const [rows] = await db.promise().query(
        `SELECT t.id, t.created_at, t.target_year_levels, u.year_level
         FROM tasks t
         JOIN users u ON u.scholar_id = ? AND u.role = 'scholar'
         WHERE t.type = ? AND t.is_active = 1
         ORDER BY t.created_at DESC`,
        [scholarId, taskType]
    );
    return rows.find((task) => {
        const levels = parseTaskYearLevels(task.target_year_levels);
        return !levels.length || levels.some((level) => normalizeYearLevel(level) === normalizeYearLevel(task.year_level));
    }) || null;
};

const isManualValidationVisibleStatus = (status, finalizedAt) => {
    if (finalizedAt) return false;
    const normalizedStatus = normalizeManualWorkflowStatus(status);
    return ['pending', 'under_review', 'returned', 'approved'].includes(normalizedStatus);
};

exports.getFinalizedDossiers = async (req, res) => {
    try {
        const [submissions] = await db.promise().query(
            `SELECT s.id, s.scholar_id, s.submission_type, s.letter_content,
                    s.report_card_path, s.cor_path, s.generated_pdf_path,
                    s.quality_score, s.status, s.officer_comment,
                    s.submitted_at, s.approved_at, s.finalized_at,
                    s.export_available_at, s.finalization_batch_id,
                    (SELECT GROUP_CONCAT(CONCAT_WS('||', sm.file_path, IFNULL(sm.description, '')) SEPARATOR ';;')
                     FROM submission_media sm WHERE sm.submission_id = s.id) AS media_raw,
                    u.full_name, u.year_level
             FROM submissions s
             LEFT JOIN users u ON u.scholar_id = s.scholar_id
             WHERE s.finalized_at IS NOT NULL`
        );
        const [gradeRows] = await db.promise().query(
            `SELECT g.scholar_id, g.semester, g.academic_year, g.subject_name,
                    g.units, g.grade, g.proof_path, g.created_at AS submitted_at,
                    g.finalized_at, g.export_available_at, g.finalization_batch_id,
                    u.full_name, u.year_level
             FROM grades g
             LEFT JOIN users u ON u.scholar_id = g.scholar_id
             WHERE g.finalized_at IS NOT NULL`
        );

        let visibleSubmissions = submissions;
        let visibleGrades = gradeRows;
        if (req.user?.role === 'officer') {
            const levels = await getAssignedYearLevels(req.user.id);
            const isAssigned = yearLevel => levels.some(level => normalizeYearLevel(level) === normalizeYearLevel(yearLevel));
            visibleSubmissions = submissions.filter(row => isAssigned(row.year_level));
            visibleGrades = gradeRows.filter(row => isAssigned(row.year_level));
        }

        const finalizedRows = visibleSubmissions.map(row => ({ ...row, record_type: 'submission' }));
        const gradesBySemester = new Map();
        visibleGrades.forEach(row => {
            const key = `${row.scholar_id}|${row.semester}|${row.academic_year}|${row.finalization_batch_id}`;
            if (!gradesBySemester.has(key)) {
                gradesBySemester.set(key, {
                    id: `grades-${key}`,
                    scholar_id: row.scholar_id,
                    full_name: row.full_name,
                    year_level: row.year_level,
                    submission_type: 'grades',
                    semester: row.semester,
                    academic_year: row.academic_year,
                    proof_path: row.proof_path,
                    submitted_at: row.submitted_at,
                    finalized_at: row.finalized_at,
                    export_available_at: row.export_available_at,
                    finalization_batch_id: row.finalization_batch_id,
                    subjects: [],
                    total_units: 0,
                    weighted_sum: 0,
                    record_type: 'grades',
                });
            }
            const semester = gradesBySemester.get(key);
            semester.subjects.push({ subject_name: row.subject_name, units: row.units, grade: Number(row.grade) });
            semester.total_units += Number(row.units) || 0;
            semester.weighted_sum += (Number(row.units) || 0) * (Number(row.grade) || 0);
        });
        for (const grade of gradesBySemester.values()) {
            grade.gwa = grade.total_units > 0 ? Number((grade.weighted_sum / grade.total_units).toFixed(2)) : null;
            finalizedRows.push(grade);
        }
        const dossiers = new Map();
        finalizedRows.forEach(row => {
            const batchId = row.finalization_batch_id || `legacy-${row.scholar_id}-${row.finalized_at}`;
            if (!dossiers.has(batchId)) {
                dossiers.set(batchId, {
                    id: batchId,
                    scholar_id: row.scholar_id,
                    full_name: row.full_name,
                    year_level: row.year_level,
                    finalized_at: row.finalized_at,
                    export_available_at: row.export_available_at,
                    items: [],
                });
            }
            dossiers.get(batchId).items.push(row);
        });
        return res.json([...dossiers.values()].sort((a, b) => new Date(b.finalized_at) - new Date(a.finalized_at)));
    } catch (err) {
        console.error('Error fetching finalized dossiers:', err);
        return res.status(500).json({ error: 'Error fetching finalized dossiers.' });
    }
};

exports.exportFinalizedDossier = async (req, res) => {
    const batchId = String(req.params.batch_id || '').trim();
    try {
        const [submissions] = await db.promise().query(
            `SELECT s.id, s.scholar_id, s.submission_type, s.letter_content,
                    s.report_card_path, s.cor_path, s.generated_pdf_path, s.quality_score, s.status,
                    s.officer_comment, s.submitted_at, s.approved_at,
                    s.finalized_at, s.export_available_at,
                    (SELECT GROUP_CONCAT(CONCAT_WS('||', sm.file_path, IFNULL(sm.description, '')) SEPARATOR ';;')
                     FROM submission_media sm WHERE sm.submission_id = s.id) AS media_raw,
                    u.full_name, u.year_level
             FROM submissions s LEFT JOIN users u ON u.scholar_id = s.scholar_id
             WHERE s.finalization_batch_id = ?`,
            [batchId]
        );
        const [grades] = await db.promise().query(
            `SELECT g.scholar_id, g.semester, g.academic_year, g.subject_name,
                    g.units, g.grade, g.proof_path, g.created_at AS submitted_at,
                    g.finalized_at, g.export_available_at, u.full_name, u.year_level
             FROM grades g LEFT JOIN users u ON u.scholar_id = g.scholar_id
             WHERE g.finalization_batch_id = ?`,
            [batchId]
        );
        const rows = [
            ...submissions.map(row => ({ ...row, record_type: 'submission' })),
            ...grades.map(row => ({ ...row, record_type: 'grades' })),
        ];
        if (!rows.length) return res.status(404).json({ error: 'Finalized dossier not found.' });

        const firstRow = rows[0];
        if (req.user?.role === 'officer') {
            const levels = await getAssignedYearLevels(req.user.id);
            if (!levels.some(level => normalizeYearLevel(level) === normalizeYearLevel(firstRow.year_level))) {
                return res.status(403).json({ error: 'This dossier is not assigned to your officer account.' });
            }
        }

        return res.json({ dossier: { id: batchId, scholar_id: firstRow.scholar_id, full_name: firstRow.full_name, year_level: firstRow.year_level }, rows });
    } catch (err) {
        console.error('Error exporting finalized dossier:', err);
        return res.status(500).json({ error: 'Unable to export finalized dossier.' });
    }
};

exports.finalizeScholarDossier = async (req, res) => {
    const scholarId = String(req.params.scholar_id || '').trim();
    if (!scholarId) return res.status(400).json({ error: 'A scholar ID is required.' });

    let connection;
    try {
        const levels = await getAssignedYearLevels(req.user.id);
        const [scholars] = await db.promise().query(
            "SELECT year_level FROM users WHERE scholar_id = ? AND role = 'scholar' AND status = 'active' LIMIT 1",
            [scholarId]
        );
        if (!scholars.length) return res.status(404).json({ error: 'Active scholar not found.' });
        if (!levels.some(level => normalizeYearLevel(level) === normalizeYearLevel(scholars[0].year_level))) {
            return res.status(403).json({ error: 'This scholar is not assigned to your officer account.' });
        }

        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        const [[submissionCounts]] = await connection.query(
                `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN COALESCE(status, 'pending') NOT IN ('approved', 'archived') THEN 1 ELSE 0 END) AS pending
             FROM submissions WHERE scholar_id = ? AND finalized_at IS NULL`,
            [scholarId]
        );
        const [[gradeCounts]] = await connection.query(
                `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN COALESCE(verification_status, 'pending') <> 'approved' THEN 1 ELSE 0 END) AS pending
             FROM grades WHERE scholar_id = ? AND finalized_at IS NULL`,
            [scholarId]
        );
        const total = Number(submissionCounts.total || 0) + Number(gradeCounts.total || 0);
        const pending = Number(submissionCounts.pending || 0) + Number(gradeCounts.pending || 0);
        if (!total) {
            await connection.rollback();
            return res.status(409).json({ error: 'There are no unfinalized submissions in this dossier.' });
        }
        if (pending) {
            await connection.rollback();
            return res.status(409).json({ error: `${pending} submission item(s) still need approval or revision.` });
        }

        const batchId = randomUUID();
        await connection.query(
            `UPDATE submissions
             SET finalized_at = NOW(), export_available_at = NOW(), finalization_batch_id = ?
             WHERE scholar_id = ? AND finalized_at IS NULL AND status IN ('approved', 'archived')`,
            [batchId, scholarId]
        );
        await connection.query(
            `UPDATE grades
             SET finalized_at = NOW(), export_available_at = NOW(), finalization_batch_id = ?
             WHERE scholar_id = ? AND finalized_at IS NULL AND verification_status = 'approved'`,
            [batchId, scholarId]
        );
        await connection.commit();
        await logAuditEvent({ req, action: 'dossier_finalized', module: 'Manual Validation', details: `Finalized dossier for scholar ${scholarId}; export is available immediately.` });
        return res.json({ message: 'Dossier finalized and moved to Reports. Export is available immediately.', finalization_batch_id: batchId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Error finalizing scholar dossier:', err);
        return res.status(500).json({ error: 'Unable to finalize this dossier.' });
    } finally {
        connection?.release();
    }
};

const normalizeQualityStatus = (value) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (['accepted', 'medium_risk', 'high_risk'].includes(normalized)) return normalized;
    if (normalized === 'pending' || normalized === 'medium' || normalized === 'high') return 'high_risk';
    return 'high_risk';
};

// NEW: whitelist for the explicit submission_type column.
// Falls back to inferring from payload shape if the frontend doesn't send it yet
// (keeps old clients working while you roll out the frontend change).
const VALID_TYPES = ['letter', 'report_card', 'cor', 'other'];
const normalizeSubmissionType = (value, { hasLetter, hasReportCard, hasCor }) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (VALID_TYPES.includes(normalized)) return normalized;
    if (hasLetter) return 'letter';
    if (hasReportCard) return 'report_card';
    if (hasCor) return 'cor';
    return 'other';
};

const folderForField = {
    report_card: 'report-cards',
    cor: 'cor',
    media: 'other-documents',
    proof: 'grades-proof',
};

const uploadBufferToCloudinary = (file) => new Promise((resolve, reject) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const baseName = path.parse(file.originalname || 'upload').name
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 80) || 'upload';
    const uploader = cloudinary.uploader.upload_stream({
        folder: `apple-scholar/submissions/${folderForField[file.fieldname] || 'other'}`,
        resource_type: 'auto',
        type: 'authenticated',
        public_id: `${Date.now()}-${baseName}`,
        format: extension.slice(1),
    }, (error, result) => {
        if (error) return reject(error);
        resolve(result);
    });
    uploader.end(file.buffer);
});

const uploadPermanentFiles = async (files) => {
    await Promise.all(files.map(async (file) => {
        const asset = await uploadBufferToCloudinary(file);
        file.path = asset.secure_url;
        file.cloudinaryAsset = asset;
    }));
};

const registerFileAssets = async (scholarId, files) => {
    for (const file of files) {
        const asset = file.cloudinaryAsset;
        if (!asset?.secure_url || !asset.public_id) continue;
        await new Promise((resolve) => {
            db.query(
                `INSERT INTO file_assets (scholar_id, file_url, public_id, resource_type, file_format)
                 VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE public_id = VALUES(public_id), resource_type = VALUES(resource_type), file_format = VALUES(file_format)`,
                [scholarId, asset.secure_url, asset.public_id, asset.resource_type || 'image', asset.format || null],
                (err) => {
                    if (err) console.error('File asset registry error:', err.message);
                    resolve();
                }
            );
        });
    }
};

const getTransporter = () => {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !port || !user || !pass) return null;
    return nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
    });
};

// GET LETTERS FOR CORRESPONDENCE EVALUATOR
exports.getLetters = async (req, res) => {
    const conditions = ["s.submission_type = 'letter'", 's.finalized_at IS NULL'];
    const values = [];
    await applyOfficerYearLevelFilter(req, conditions, values);

    if (req.user?.role === 'officer') {
        conditions.push("s.status IN ('pending', 'under_review', 'returned', 'approved')");
    }

    const sql = `
        SELECT
            s.id,
            s.scholar_id,
            s.letter_content,
            s.quality_score,
            s.quality_status,
            s.content_score,
            s.content_breakdown,
            s.sentiment_score,
            s.sentiment_label,
            s.status,
            s.officer_comment AS staff_comment,
            s.finalized_at,
            s.export_available_at,
            s.finalization_batch_id,
            s.submitted_at,
            u.full_name,
            u.year_level
        FROM submissions s
        LEFT JOIN users u ON s.scholar_id = u.scholar_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.submitted_at DESC
    `;

    db.query(sql, values, (err, rows) => {
        if (err) {
            console.error('Error fetching letters:', err);
            return res.status(500).json({ error: 'Error fetching letters.' });
        }
        res.json(rows);
    });
};

// SUBMIT COMPLIANCE
// scholar_id comes from the verified JWT (req.user), never trusted from the body.
// req.files[...][0].path is already the full Cloudinary secure URL thanks to
// multer-storage-cloudinary - no local file handling needed at all.
exports.submitCompliance = async (req, res) => {
    const scholar_id = req.user.scholar_id;
    const {
        letter_content,
        name,
        age,
        year,
        course,
        school,
        sentiment_score,
        sentiment_label,
        service_activity,
        service_hours,
        service_date,
        quality_score,
        quality_status,
        media_descriptions,
        submission_type, // NEW: frontend should send this explicitly ('letter' | 'report_card' | 'cor' | 'other')
    } = req.body;

    try {
        let resumableIds = [];
        if (req.body.resumable_uploads) {
            try {
                resumableIds = JSON.parse(req.body.resumable_uploads);
            } catch {
                return res.status(400).json({ error: 'Invalid resumable upload list' });
            }
        }
        if (!Array.isArray(resumableIds) || resumableIds.length > 11) {
            return res.status(400).json({ error: 'Invalid resumable upload list' });
        }
        const stagedFiles = await Promise.all(resumableIds.map(id => consumeCompleted(id, scholar_id)));
        const uploadedFiles = [...Object.values(req.files || {}).flat(), ...stagedFiles];
        await uploadPermanentFiles(uploadedFiles);
        await registerFileAssets(scholar_id, uploadedFiles);
        await Promise.all(resumableIds.map(removeSession));
        const reportCardPath = uploadedFiles.find(file => file.fieldname === 'report_card')?.path || null;
        const corPath = uploadedFiles.find(file => file.fieldname === 'cor')?.path || null;
        const mediaFiles = uploadedFiles.filter(file => file.fieldname === 'media');

        const resolvedType = normalizeSubmissionType(submission_type, {
            hasLetter: !!(letter_content && letter_content.trim()),
            hasReportCard: !!reportCardPath,
            hasCor: !!corPath,
        });
        const assignedTask = await findLatestAssignedTask(scholar_id, resolvedType);
        if (!assignedTask) {
            await Promise.all(resumableIds.map(removeSession));
            return res.status(409).json({
                error: 'You cannot submit this requirement because there is no active task assigned by the administrator yet.',
                requirement_type: resolvedType,
            });
        }

        const normalizedPayload = {
            scholar_id,
            submission_type: resolvedType,
            letter_content: normalizeSubmissionValue(letter_content),
            name: normalizeSubmissionValue(name),
            age: normalizeSubmissionValue(age),
            year: normalizeSubmissionValue(year),
            course: normalizeSubmissionValue(course),
            school: normalizeSubmissionValue(school),
            sentiment_score: normalizeSubmissionValue(sentiment_score),
            sentiment_label: normalizeSubmissionValue(sentiment_label),
            content_score: null,
            content_breakdown: null,
            quality_label: null,
            report_card_path: normalizeSubmissionValue(reportCardPath),
            cor_path: normalizeSubmissionValue(corPath),
            service_activity: normalizeSubmissionValue(service_activity),
            service_hours: normalizeSubmissionValue(service_hours),
            service_date: normalizeSubmissionValue(service_date),
            // quality_score/quality_status are only meaningful for 'letter' type
            quality_score: resolvedType === 'letter' ? normalizeSubmissionValue(quality_score) : null,
            quality_status: resolvedType === 'letter' ? normalizeQualityStatus(normalizeSubmissionValue(quality_status)) : null,
        };

        let prediction = null;
        let contentPrediction = null;
        let modelScorePrediction = null;
        if (resolvedType === 'letter' && normalizedPayload.letter_content) {
            prediction = await predictSentimentForLetter(normalizedPayload.letter_content);
            contentPrediction = await predictContentScoreForLetter(normalizedPayload.letter_content);
            try {
                modelScorePrediction = await predictLetterScore(normalizedPayload.letter_content);
                if (modelScorePrediction?.score != null) {
                    normalizedPayload.quality_score = normalizeSubmissionValue(modelScorePrediction.score);
                    normalizedPayload.quality_status = normalizeQualityStatus(normalizeSubmissionValue(modelScorePrediction.quality_status));
                }
            } catch (scoreErr) {
                console.warn('Warning: model score prediction unavailable; keeping existing rule-based letter quality fields.', scoreErr?.message || scoreErr);
            }
        }

        if (prediction) {
            normalizedPayload.sentiment_score = normalizeSubmissionValue(prediction.sentiment);
            normalizedPayload.sentiment_label = normalizeSubmissionValue(prediction.sentiment_label);
        }

        if (contentPrediction) {
            normalizedPayload.content_score = normalizeSubmissionValue(contentPrediction.score);
            normalizedPayload.content_breakdown = normalizeSubmissionValue(JSON.stringify(contentPrediction.breakdown));
            normalizedPayload.quality_label = normalizeSubmissionValue(contentPrediction.quality_label);
        }

        // Rule: one active submission per requirement type at a time.
        // Scholars may only submit the same requirement again after the earlier
        // version was rejected/returned for revision. Other pages should not be
        // accepted as a second valid submission.
        const existingSubmissionSql = `
            SELECT id, status, submitted_at
            FROM submissions
            WHERE scholar_id = ? AND submission_type = ?
            ORDER BY submitted_at DESC
            LIMIT 1
        `;

        db.query(existingSubmissionSql, [scholar_id, resolvedType], (existingErr, existingRows) => {
            if (existingErr) {
                console.error('Error checking existing submission:', existingErr);
                return res.status(500).json({ error: 'Error checking requirement submission status' });
            }

            const latestExisting = existingRows && existingRows[0];
            const existingIsForCurrentTask = latestExisting
                && new Date(latestExisting.submitted_at || 0).getTime() >= new Date(assignedTask.created_at || 0).getTime();
            if (latestExisting && existingIsForCurrentTask && !isDuplicateRequirementSubmissionAllowed(latestExisting.status)) {
                return res.status(409).json({
                    error: 'You already submitted this requirement for the current task. Please wait for it to be rejected or returned for revision.',
                    requirement_type: resolvedType,
                });
            }

            if (latestExisting && existingIsForCurrentTask && isDuplicateRequirementSubmissionAllowed(latestExisting.status)) {
                db.query(
                    `DELETE FROM submissions
                     WHERE scholar_id = ? AND submission_type = ? AND status IN ('rejected', 'returned', 'needs_revision', 'needs-revision')`,
                    [scholar_id, resolvedType],
                    (deleteErr) => {
                        if (deleteErr) {
                            console.error('Error clearing rejected requirement before resubmission:', deleteErr);
                            return res.status(500).json({ error: 'Unable to replace the rejected requirement submission.' });
                        }
                        continueSubmissionInsert();
                    }
                );
                return;
            }

            continueSubmissionInsert();
        });

        const continueSubmissionInsert = () => {
            // FIX: every new submission (including a resubmit after rejection) must
            // start completely fresh - explicitly reset status to 'pending' and
            // clear out any old staff_comment, instead of relying on whatever the
            // `status` column's DB-level default happens to be. Previously these
            // two columns were omitted from the INSERT entirely, which is why a
            // resubmitted letter could still show as "Returned for Revision" (or
            // fail to insert at all if the column has no default / is NOT NULL).
            const sql = `
                INSERT INTO submissions (
                    scholar_id, submission_type, letter_content, sentiment_score, sentiment_label,
                    content_score, content_breakdown, quality_label,
                    report_card_path, cor_path, service_activity, service_hours,
                    service_date, quality_score, quality_status, status, officer_comment, needs_followup
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            calculateCurrentCompliance(scholar_id, (preCalcErr, preCompliance, preMinCompliance, preScore) => {
                if (preCalcErr) {
                    console.error('Error calculating compliance before submission:', preCalcErr);
                }

                db.query(sql, [
                    normalizedPayload.scholar_id,
                    normalizedPayload.submission_type,
                    normalizedPayload.letter_content,
                    normalizedPayload.sentiment_score,
                    normalizedPayload.sentiment_label,
                    normalizedPayload.content_score,
                    normalizedPayload.content_breakdown,
                    normalizedPayload.quality_label,
                    normalizedPayload.report_card_path,
                    normalizedPayload.cor_path,
                    normalizedPayload.service_activity,
                    normalizedPayload.service_hours,
                    normalizedPayload.service_date,
                    normalizedPayload.quality_score,
                    normalizedPayload.quality_status,
                    'pending',   // status - always starts fresh, regardless of any earlier rejected row
                    null,        // officer_comment - always starts empty, old officer feedback stays only on the old row
                    prediction?.sentiment === -1 ? 1 : 0,
                ], (err, result) => {
                    if (err) {
                        console.error('DB error saving submission:', err);
                        return res.status(500).json({ error: 'Error saving submission' });
                    }

                const submissionId = result.insertId;

                registerRetentionDocuments(scholar_id, submissionId, uploadedFiles, {
                    report_card: 'grades',
                    cor: 'COR',
                });

                if (resolvedType === 'letter' && (normalizedPayload.name || normalizedPayload.year || normalizedPayload.course || normalizedPayload.school)) {
                    const setClauses = [];
                    const params = [];

                    if (normalizedPayload.name) {
                        setClauses.push('full_name = ?');
                        params.push(normalizedPayload.name);
                    }
                    if (normalizedPayload.year) {
                        setClauses.push('year_level = ?');
                        params.push(normalizedPayload.year);
                    }
                    if (normalizedPayload.course) {
                        setClauses.push('course = ?');
                        params.push(normalizedPayload.course);
                    }
                    if (normalizedPayload.school) {
                        setClauses.push('school = ?');
                        params.push(normalizedPayload.school);
                    }

                    if (setClauses.length > 0) {
                        params.push(scholar_id);
                        db.query(
                            `UPDATE users SET ${setClauses.join(', ')} WHERE scholar_id = ? LIMIT 1`,
                            params,
                            (userErr) => {
                                if (userErr) console.error('Failed to save scholar letter profile fields:', userErr.message || userErr);
                            }
                        );
                    }
                }

                calculateCurrentCompliance(scholar_id, (calcErr, currentCompliance, minCompliance, currentScore) => {
                    if (!calcErr && typeof currentCompliance === 'number') {
                        logComplianceIncident(
                            scholar_id,
                            'submission_created',
                            0,
                            currentCompliance,
                            currentCompliance,
                            `Compliance submission recorded for ${resolvedType}.`
                        );

                        if (currentScore?.totalBonusPoints > (preScore?.totalBonusPoints || 0)) {
                            const bonusDelta = Math.round((currentScore.totalBonusPoints - (preScore?.totalBonusPoints || 0)) * 100) / 100;
                            logComplianceBonus(
                                scholar_id,
                                'submission_recovery_bonus',
                                bonusDelta,
                                preCompliance,
                                currentCompliance,
                                `Recovery bonus awarded after ${resolvedType} submission.`
                            );
                        }
                    }
                });

                const descriptions = JSON.parse(media_descriptions || '[]');

                if (mediaFiles.length > 0) {
                    const mediaValues = mediaFiles
                        .map((file, idx) => {
                            const mediaPath = file?.path || null;
                            if (!mediaPath) return null;
                            return [submissionId, mediaPath, descriptions[idx] || ''];
                        })
                        .filter(Boolean);

                    if (mediaValues.length > 0) {
                        const mediaSql = "INSERT INTO submission_media (submission_id, file_path, photo_path, description, uploaded_at, retention_until) VALUES ?";
                        const mediaRows = mediaValues.map(([id, filePath, description]) => [
                            id,
                            filePath,
                            filePath,
                            description,
                            new Date(),
                            new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
                        ]);
                        db.query(mediaSql, [mediaRows], (mediaErr) => {
                            if (mediaErr) console.error('Media save error:', mediaErr);
                        });
                    }
                }

                if (resolvedType === 'letter') {
                    letterPdfGenerator.generateLetterPdf(submissionId)
                        .then((publicPath) => {
                            console.log(`Generated PDF for submission ${submissionId}: ${publicPath}`);
                            db.query(
                                `INSERT INTO documents (scholar_id, category, file_name, file_path, mime_type, status, retention_until, source_submission_id)
                                 VALUES (?, 'monthly_letter', ?, ?, 'application/pdf', 'Pending', DATE_ADD(NOW(), INTERVAL 5 YEAR), ?)`,
                                [scholar_id, `monthly-letter-${submissionId}.pdf`, publicPath, submissionId],
                                (documentErr) => { if (documentErr) console.error('Letter retention registry error:', documentErr.message); }
                            );
                        })
                        .catch((genErr) => {
                            console.error(`Failed to generate PDF for letter submission ${submissionId}:`, genErr);
                        });
                }

                res.status(201).json({
                    message: 'Submission successful',
                    submissionId,
                    submission_type: resolvedType,
                    quality_score: normalizedPayload.quality_score,
                    quality_status: normalizedPayload.quality_status,
                });
        });
    });
        };
    } catch (err) {
        console.error('Submit error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// SCORE A LETTER BODY USING THE TRAINED REGRESSION MODEL
exports.predictLetterScore = async (req, res) => {
    const rawLetter = typeof req.body?.letter_content === 'string'
        ? req.body.letter_content
        : typeof req.body?.letter_text === 'string'
            ? req.body.letter_text
            : '';

    if (!rawLetter || !rawLetter.trim()) {
        return res.status(400).json({ error: 'Missing letter content' });
    }

    try {
        const flaskScore = await predictContentScoreForLetter(rawLetter);
        console.log('[letter-score-debug] controller received Flask response:', {
            raw: flaskScore?.raw_response || null,
            normalized: flaskScore,
        });

        if (flaskScore?.flagged === true) {
            console.warn('[letter-score-debug] flagged path selected; skipping local model and rule-based scoring:', flaskScore.flag_reason);
            return res.status(200).json({
                score: 0,
                body_score: 0,
                flagged: true,
                flag_reason: flaskScore.flag_reason || 'This submission does not appear to be a valid letter.',
                quality_status: 'high_risk',
                quality_label: 'Invalid Letter',
                academic_tone: 'Informal',
                breakdown: {
                    date: { score: 0 },
                    paragraph: { score: 0 },
                    academic: { score: 0 },
                    self_improvement: { score: 0 },
                    family: { score: 0 },
                    difficulty: { score: 0 },
                    picture: { score: 0 },
                    caption: { score: 0 },
                },
                fallback: false,
            });
        }

        if (flaskScore && typeof flaskScore.score === 'number') {
            const computedScore = Number(flaskScore.score);
            const breakdown = {
                date: { score: 5 },
                paragraph: { score: Number(flaskScore.breakdown?.paragraph ?? 0) },
                academic: { score: Number(flaskScore.breakdown?.academic ?? 0) },
                self_improvement: { score: Number(flaskScore.breakdown?.self_improvement ?? 0) },
                family: { score: Number(flaskScore.breakdown?.family ?? 0) },
                difficulty: { score: Number(flaskScore.breakdown?.difficulty ?? 0) },
                picture: { score: 10 },
                caption: { score: 10 },
            };

            const bodyScoreOutOf70 = ['paragraph', 'academic', 'self_improvement', 'family', 'difficulty']
                .reduce((sum, key) => sum + Number(breakdown[key].score), 0);
            console.log('[letter-score-debug] Flask ML path executed for /predict-score');
            console.log('[letter-score-debug] RAW Flask /predict-score response:', flaskScore.raw_response);
            console.log('[letter-score-debug] reshaped frontend breakdown:', breakdown);
            console.log('[letter-score-debug] body arithmetic:', {
                bodyScoreOutOf70,
                flaskOverallScoreOutOf100: computedScore,
            });

            return res.status(200).json({
                score: computedScore,
                body_score: bodyScoreOutOf70,
                quality_status: mapQualityStatus(computedScore),
                quality_label: String(flaskScore.quality_label || mapQualityLabel(computedScore)),
                academic_tone: 'Formal',
                breakdown,
                fallback: false,
            });
        }

        console.warn('[letter-score-debug] Flask response unusable; selecting local model fallback.');
        const result = await predictLetterScore(rawLetter);
        console.log('[letter-score-debug] Flask ML path unavailable; local regression fallback result:', result);
        if (!result || result.fallback || result.score === null) {
            console.log('[letter-score-debug] rule-based fallback path selected: no usable Flask or local regression score');
            return res.status(200).json({
                score: null,
                quality_label: 'Good',
                quality_status: 'accepted',
                academic_tone: 'Formal',
                breakdown: {
                    date: { score: 5 },
                    paragraph: { score: 0 },
                    academic: { score: 0 },
                    self_improvement: { score: 0 },
                    family: { score: 0 },
                    difficulty: { score: 0 },
                    picture: { score: 10 },
                    caption: { score: 10 },
                },
                fallback: true,
            });
        }

        console.log('[letter-score-debug] local regression path executed; reshaped frontend breakdown:', {
            date: Number(result.breakdown?.date ?? 5),
            paragraph: Number(result.breakdown?.body ?? 50),
            academic: 0,
            self_improvement: 0,
            family: 0,
            difficulty: 0,
            picture: Number(result.breakdown?.attachments ?? 20),
            caption: Number(result.breakdown?.caption ?? 13),
        });
        const localBodyScore = Number(result.score) * 70 / 100;
        return res.status(200).json({
            score: Number(result.score),
            body_score: localBodyScore,
            quality_label: result.quality_label,
            quality_status: result.quality_status,
            academic_tone: result.academic_tone || 'Formal',
            breakdown: {
                date: { score: Number(result.breakdown?.date ?? 5) },
                paragraph: { score: Number(result.breakdown?.body ?? 50) },
                academic: { score: 0 },
                self_improvement: { score: 0 },
                family: { score: 0 },
                difficulty: { score: 0 },
                picture: { score: Number(result.breakdown?.attachments ?? 20) },
                caption: { score: Number(result.breakdown?.caption ?? 13) },
            },
            fallback: false,
        });
    } catch (err) {
        console.warn('Warning: model score route failed:', err?.message || err);
        return res.status(200).json({
            score: null,
            quality_label: 'Good',
            quality_status: 'accepted',
            academic_tone: 'Formal',
            breakdown: {
                date: { score: 5 },
                paragraph: { score: 0 },
                academic: { score: 0 },
                self_improvement: { score: 0 },
                family: { score: 0 },
                difficulty: { score: 0 },
                picture: { score: 10 },
                caption: { score: 10 },
            },
            fallback: true,
        });
    }
};

// PREVIEW / PROXY A CLOUDINARY FILE
// The `url` query param is already the full Cloudinary secure_url stored in the DB
// (set by multer-storage-cloudinary at upload time), so we just fetch it directly
// and stream it back - no need to hit the Cloudinary Admin API at all.
// This avoids the resource_type mismatch issues (image/video/raw/auto) entirely.
exports.previewCloudinaryFile = async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing file URL' });

    try {
        const fileRows = await new Promise((resolve, reject) => {
            db.query(
                `SELECT scholar_id, id AS resource_id, submission_type AS resource_type FROM submissions
                 WHERE report_card_path = ? OR cor_path = ? OR generated_pdf_path = ?
                 UNION ALL SELECT s.scholar_id, s.id AS resource_id, s.submission_type AS resource_type
                 FROM submission_media m
                 JOIN submissions s ON s.id = m.submission_id
                 WHERE m.file_path = ?
                 UNION ALL SELECT scholar_id, id AS resource_id, 'grades' AS resource_type FROM grades WHERE proof_path = ?
                 UNION ALL SELECT d.scholar_id, d.id AS resource_id, COALESCE(s.submission_type, 'document') AS resource_type
                 FROM documents d
                 LEFT JOIN submissions s ON s.id = d.source_submission_id
                 WHERE d.file_path = ?
                 LIMIT 1`,
                [url, url, url, url, url, url],
                (queryErr, rows) => queryErr ? reject(queryErr) : resolve(rows)
            );
        });
        if (!fileRows.length) {
            await logPrivacyAccess(req, {
                action: 'DENIED_ACCESS',
                resourceType: 'scholar_document',
                resourceId: 'unregistered',
                status: 'denied',
            });
            return res.status(404).json({ error: 'File is not registered in the system' });
        }
        const scholarId = fileRows[0].scholar_id;
        const isOfficerLetter = req.user?.role !== 'officer' || fileRows[0].resource_type === 'letter';
        const canView = isOfficerLetter && await canAccessScholar(req, scholarId, { document: true });
        await logPrivacyAccess(req, {
            action: canView ? 'VIEW_DOCUMENT' : 'DENIED_ACCESS',
            resourceType: 'scholar_document',
            resourceId: fileRows[0].resource_id,
            status: canView ? 'allowed' : 'denied',
        });
        if (!canView) return res.status(403).json({ error: 'You are not allowed to preview this file' });

        // Generated letters can fall back to the authenticated server's local uploads directory
        // when Cloudinary is unavailable. Keep that fallback behind the same preview authorization.
        if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
            const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
            const relativePath = url.replace(/^\/+uploads[\\/]/, '');
            const localPath = path.resolve(uploadsRoot, relativePath);
            if (!localPath.startsWith(`${uploadsRoot}${path.sep}`) || !fs.existsSync(localPath)) {
                return res.status(404).json({ error: 'Local file not found' });
            }

            res.setHeader('content-type', 'application/pdf');
            res.setHeader('content-disposition', 'inline');
            return res.sendFile(localPath);
        }

        // Basic safety check: only allow proxying actual Cloudinary URLs.
        const parsedUrl = new URL(url);
        const configuredCloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'res.cloudinary.com' || !configuredCloudName || parsedUrl.pathname.split('/')[1] !== configuredCloudName) {
            return res.status(400).json({ error: 'Invalid file source' });
        }

        const assetRows = await new Promise((resolve, reject) => {
            db.query('SELECT public_id, resource_type, file_format, scholar_id FROM file_assets WHERE file_url = ? LIMIT 1', [url], (queryErr, rows) => queryErr ? reject(queryErr) : resolve(rows));
        });
        let fetchUrl = url;
        if (assetRows.length) {
            if (assetRows[0].scholar_id !== scholarId) {
                await logPrivacyAccess(req, {
                    action: 'DENIED_ACCESS',
                    resourceType: 'scholar_document',
                    resourceId: fileRows[0].resource_id,
                    status: 'denied',
                });
                return res.status(403).json({ error: 'File ownership does not match its registration.' });
            }
            fetchUrl = cloudinary.utils.private_download_url(
                assetRows[0].public_id,
                assetRows[0].file_format || 'bin',
                {
                    resource_type: assetRows[0].resource_type || 'image',
                    type: 'authenticated',
                    expires_at: Math.floor(Date.now() / 1000) + 600,
                    attachment: false,
                }
            );
        }

        const remoteRes = await fetch(fetchUrl, { redirect: 'follow' });

        if (!remoteRes.ok) {
            return res.status(remoteRes.status).json({ error: 'File not found on Cloudinary' });
        }

        const contentType = url.toLowerCase().includes('.pdf')
            ? 'application/pdf'
            : (remoteRes.headers.get('content-type') || 'application/octet-stream');
        res.setHeader('content-type', contentType);
        res.setHeader('content-disposition', 'inline'); // "inline" = preview in browser, not force-download

        res.send(Buffer.from(await remoteRes.arrayBuffer()));
        await logAuditEvent({ req, action: 'file_preview', module: 'Submissions', details: `Previewed registered file for scholar ${fileRows[0].scholar_id}` });
    } catch (err) {
        console.error('Preview proxy error:', err);
        res.status(500).json({ error: 'Unable to preview file' });
    }
};

// GET SUBMISSIONS BY SCHOLAR
// Scholar can only fetch their OWN history; Staff/Admin can fetch any scholar's history.
exports.getHistory = (req, res) => {
    const { scholar_id } = req.params;

    const isOwner = req.user.role === 'scholar' && String(req.user.scholar_id) === String(scholar_id);
    const isAdminOrOfficer = ['admin', 'officer'].includes(req.user.role);

    if (!isOwner && !isAdminOrOfficer) {
        return res.status(403).json({ message: 'Access denied: insufficient role' });
    }

    const officerLetterFilter = req.user.role === 'officer' ? "AND s.submission_type = 'letter'" : '';
    const sql = `
        SELECT s.*,
        s.officer_comment AS staff_comment,
        GROUP_CONCAT(sm.file_path) as media_paths,
        GROUP_CONCAT(sm.description) as media_descriptions
        FROM submissions s
        LEFT JOIN submission_media sm ON s.id = sm.submission_id
        WHERE s.scholar_id = ? ${officerLetterFilter}
        GROUP BY s.id
        ORDER BY s.submitted_at DESC
    `;
    db.query(sql, [scholar_id], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching history' });
        res.json(data);
    });
};

// GET ALL SUBMISSIONS (Admin/Staff) - flat list, kept for backward compatibility
exports.getAllSubmissions = (req, res) => {
    const conditions = [];
    const values = [];
    if (req.user.role === 'officer') conditions.push("s.submission_type = 'letter'");
    if (req.user.role === 'staff') {
        conditions.push(`EXISTS (
            SELECT 1 FROM scholar_group_members scoped_members
            JOIN scholar_groups scoped_groups ON scoped_groups.id = scoped_members.group_id
            WHERE scoped_members.scholar_id = s.scholar_id
              AND scoped_groups.assigned_staff_id = ?
        )`);
        values.push(req.user.id);
    }
    applyOfficerYearLevelFilter(req, conditions, values, 'u.year_level').then(() => {
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT s.*, s.officer_comment AS staff_comment, u.full_name, u.scholar_id as sid,
            GROUP_CONCAT(sm.file_path) as media_paths
            FROM submissions s
            LEFT JOIN users u ON s.scholar_id = u.scholar_id
            LEFT JOIN submission_media sm ON s.id = sm.submission_id
            ${where}
            GROUP BY s.id
            ORDER BY s.submitted_at DESC
        `;

        db.query(sql, values, (err, data) => {
            if (err) return res.status(500).json({ error: 'Error fetching submissions' });
            res.json(data);
        });
    }).catch((err) => {
        console.error('Failed to scope submissions to assigned scholars:', err);
        res.status(500).json({ error: 'Unable to verify scholar access.' });
    });
};

exports.archiveSubmissionsBulk = (req, res) => {
    const { submissionIds } = req.body || {};
    if (!Array.isArray(submissionIds) || submissionIds.length === 0 || submissionIds.length > 500) {
        return res.status(400).json({ error: 'Provide between 1 and 500 submission IDs.' });
    }

    const ids = [...new Set(submissionIds.map(Number))];
    if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
        return res.status(400).json({ error: 'Submission IDs must be positive integers.' });
    }

    const placeholders = ids.map(() => '?').join(', ');
    db.query(
        `UPDATE submissions
         SET archived_at = NOW()
         WHERE id IN (${placeholders})
           AND status = 'approved'
           AND archived_at IS NULL
           AND archive_at IS NULL`,
        ids,
        (err, result) => {
            if (err) {
                console.error('Error archiving submission records:', err);
                return res.status(500).json({ error: 'Unable to archive submission records.' });
            }
            res.json({
                message: 'Submission records archived successfully.',
                archivedCount: result.affectedRows,
            });
        }
    );
};

// ============================================================
// NEW: GET SUBMISSIONS GROUPED BY SCHOLAR (for the consolidated
// one-tab-per-scholar Officer view)
//
// Returns one object per scholar, each holding:
//   - monthly_letters: [] (has quality_score/quality_status + status/staff_comment)
//   - report_cards:    []
//   - cors:             []
//   - other_documents: []
//   - grades:           [] (from the separate `grades` table, per semester)
//
// Each item already includes status ('pending'/'approved'/'rejected') and
// staff_comment so the officer UI can show Accept/Reject + feedback per item
// without needing separate tabs.
// ============================================================
exports.getScholarSubmissions = (req, res) => {
    const submissionsSql = `
        SELECT s.*, s.officer_comment AS staff_comment, COALESCE(u.full_name, s.scholar_id) AS full_name, u.year_level, u.course, u.school,
        GROUP_CONCAT(
            CONCAT_WS('||', sm.id, sm.file_path, IFNULL(sm.description, ''))
            SEPARATOR ';;'
        ) as media_raw
        FROM submissions s
        LEFT JOIN users u ON s.scholar_id = u.scholar_id
        LEFT JOIN submission_media sm ON s.id = sm.submission_id
        GROUP BY s.id
        ORDER BY s.submitted_at DESC
    `;

    const gradesSql = `
        SELECT g.*, g.verification_status AS status, g.officer_comment AS staff_comment, u.full_name, u.year_level
        FROM grades g
        LEFT JOIN users u ON g.scholar_id = u.scholar_id
        WHERE g.finalized_at IS NULL
        ORDER BY g.created_at DESC
    `;

    db.query(submissionsSql, (err, submissions) => {
        if (err) {
            console.error('Error fetching submissions:', err);
            return res.status(500).json({ error: 'Error fetching submissions' });
        }

        db.query(gradesSql, (gradesErr, gradeRows) => {
            if (gradesErr) {
                console.error('Error fetching grades:', gradesErr);
                return res.status(500).json({ error: 'Error fetching grades' });
            }

            const filterRowsForOfficer = async () => {
                if (req.user?.role !== 'officer') return { submissions, gradeRows, levels: [] };
                const levels = await getAssignedYearLevels(req.user.id);
                const isAssignedYearLevel = yearLevel => levels.some(
                    level => normalizeYearLevel(level) === normalizeYearLevel(yearLevel)
                );
                return {
                    submissions: submissions.filter(row => row.submission_type === 'letter' && isAssignedYearLevel(row.year_level)),
                    gradeRows: [],
                    levels,
                };
            };

            filterRowsForOfficer().then(({ submissions: visibleSubmissions, gradeRows: visibleGrades, levels }) => {
            const scholars = {};

            const ensureScholar = (scholar_id, full_name, year_level) => {
                if (!scholars[scholar_id]) {
                    scholars[scholar_id] = {
                        scholar_id,
                        full_name: full_name || null,
                        year_level: year_level || null,
                        monthly_letters: [],
                        report_cards: [],
                        cors: [],
                        other_documents: [],
                        grades: [],
                    };
                }
                if (full_name && !scholars[scholar_id].full_name) {
                    scholars[scholar_id].full_name = full_name;
                }
                if (year_level && !scholars[scholar_id].year_level) {
                    scholars[scholar_id].year_level = year_level;
                }
                return scholars[scholar_id];
            };

            // --- group submissions rows by scholar + type ---
            visibleSubmissions.forEach(row => {
                const bucket = ensureScholar(row.scholar_id, row.full_name, row.year_level);

                if (!isManualValidationVisibleStatus(row.status, row.finalized_at)) {
                    return;
                }

                const media = (row.media_raw || '')
                    .split(';;')
                    .filter(Boolean)
                    .map(chunk => {
                        const [id, file_path, description] = chunk.split('||');
                        return { id, file_path, description };
                    });

                const item = {
                    id: row.id,
                    submission_type: row.submission_type,
                    letter_content: row.letter_content,
                    sentiment_score: row.sentiment_score,
                    sentiment_label: row.sentiment_label,
                    report_card_path: row.report_card_path,
                    cor_path: row.cor_path,
                    generated_pdf_path: row.generated_pdf_path,
                    year_level: row.year_level,
                    course: row.course,
                    school: row.school,
                    quality_score: row.quality_score,
                    quality_status: row.quality_status,
                    status: row.status,
                    finalized_at: row.finalized_at,
                    export_available_at: row.export_available_at,
                    finalization_batch_id: row.finalization_batch_id,
                    staff_comment: row.staff_comment,
                    submitted_at: row.submitted_at,
                    media, // includes per-photo description (visible to officer AND scholar)
                }; 

                switch (row.submission_type) {
                    case 'letter':
                        bucket.monthly_letters.push(item);
                        break;
                    case 'report_card':
                        bucket.report_cards.push(item);
                        break;
                    case 'cor':
                        bucket.cors.push(item);
                        break;
                    default:
                        bucket.other_documents.push(item);
                }
            });

            // --- group grades by scholar + semester (reuse getAllGrades logic) ---
            const semMap = {};
            visibleGrades.forEach(row => {
                const key = `${row.scholar_id}|${row.semester}|${row.academic_year}`;
                if (!semMap[key]) {
                    semMap[key] = {
                        scholar_id: row.scholar_id,
                        full_name: row.full_name,
                        semester: row.semester,
                        academic_year: row.academic_year,
                        proof_path: row.proof_path,
                        submitted_at: row.created_at,
                        subjects: [],
                        total_units: 0,
                        weighted_sum: 0,
                        status: row.status || 'pending',
                        staff_comment: row.staff_comment || null,
                    };
                }
                semMap[key].subjects.push({
                    subject_name: row.subject_name,
                    units: row.units,
                    grade: parseFloat(row.grade),
                });
                semMap[key].total_units += row.units;
                semMap[key].weighted_sum += row.units * parseFloat(row.grade);
            });

            Object.values(semMap).forEach(sem => {
                const bucket = ensureScholar(sem.scholar_id, sem.full_name, sem.year_level);
                bucket.grades.push({
                    ...sem,
                    gwa: sem.total_units > 0 ? parseFloat((sem.weighted_sum / sem.total_units).toFixed(2)) : null,
                    academic_status: sem.total_units > 0
                        ? (sem.weighted_sum / sem.total_units) <= 3.00 ? 'passed' : 'failed'
                        : 'pending',
                });
            });

            // Include active scholars even when they have no submission yet.
            db.query(
                'SELECT scholar_id, full_name, year_level FROM users WHERE role = \'scholar\' AND status = \'active\' AND scholar_id IS NOT NULL',
                (scholarsErr, scholarRows) => {
                    if (scholarsErr) {
                        console.error('Error fetching active scholars:', scholarsErr);
                        return res.status(500).json({ error: 'Error fetching scholars' });
                    }

                    const visibleScholarRows = req.user?.role === 'officer'
                        ? scholarRows.filter(row => levels.some(level => normalizeYearLevel(level) === normalizeYearLevel(row.year_level)))
                        : scholarRows;

                    visibleScholarRows.forEach(row => ensureScholar(row.scholar_id, row.full_name, row.year_level));
                    res.json(Object.values(scholars));
                }
            );
            }).catch(() => res.status(500).json({ error: 'Failed to resolve officer assignments.' }));
        });
    });
};

// APPROVE / REJECT SUBMISSION (Staff/Admin/Officer)
// Works for ANY submission_type (letter, report_card, cor, other) since they're
// all just rows in `submissions` with their own id.
exports.reviewSubmission = (req, res) => {
    const { id } = req.params;
    const { status, staff_comment } = req.body || {};

    const requestedStatus = String(status || '').trim().toLowerCase();
    const validStatuses = new Set([
        'pending',
        'under_review',
        'approved',
        'returned',
        'rejected',
        'needs_revision',
        'needs-revision',
        'needs revision',
    ]);
    if (!validStatuses.has(requestedStatus)) {
        return res.status(400).json({ error: 'Invalid status. Must be pending, under_review, approved, returned, or rejected.' });
    }

    const resolvedStatus = normalizeManualWorkflowStatus(requestedStatus);
    if (req.user.role === 'officer' && !['approved', 'returned'].includes(resolvedStatus)) {
        return res.status(400).json({ error: "Officers may only 'approve' or 'return' a letter." });
    }
    const comment = typeof staff_comment === 'string' ? staff_comment.trim() : '';
    if (staff_comment != null && typeof staff_comment !== 'string') {
        return res.status(400).json({ error: 'Review comments must be text.' });
    }
    if (comment.length > 4000) {
        return res.status(400).json({ error: 'Review comments must not exceed 4000 characters.' });
    }
    if (resolvedStatus === 'returned' && !comment) {
        return res.status(400).json({ error: 'A reason is required when returning a submission.' });
    }

    const sql = `UPDATE submissions s
        JOIN users u ON u.scholar_id = s.scholar_id
        SET s.status = ?,
            s.officer_comment = ?,
            s.reviewed_at = NOW(),
            s.approved_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END,
            s.finalized_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END,
            s.export_available_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END,
            s.finalization_batch_id = CASE WHEN ? = 'approved' THEN ? ELSE NULL END,
            s.archive_at = NULL,
            s.returned_at = CASE WHEN ? IN ('returned', 'rejected') THEN NOW() ELSE NULL END
        WHERE s.id = ?
          AND (? <> 'officer' OR s.submission_type = 'letter')
          AND (? <> 'officer' OR (s.finalized_at IS NULL AND s.status IN ('pending', 'under_review')))
          AND (? <> 'officer' OR EXISTS (
              SELECT 1 FROM officer_year_level_assignments oya
                            WHERE oya.officer_id = ?
                                AND ${yearLevelSqlExpression('oya.year_level')} = ${yearLevelSqlExpression('u.year_level')}
          ))`;
    const exportBatchId = resolvedStatus === 'approved' ? randomUUID() : null;
    db.query(sql, [resolvedStatus, comment || null, resolvedStatus, resolvedStatus, resolvedStatus, resolvedStatus, exportBatchId, resolvedStatus, id, req.user.role, req.user.role, req.user.role, req.user.id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error updating submission' });
        logPrivacyAccess(req, {
            action: result.affectedRows
                ? (req.user.role === 'officer' ? 'VALIDATE_LETTER' : 'UPDATE_SUBMISSION')
                : 'DENIED_ACCESS',
            resourceType: req.user.role === 'officer' ? 'letter' : 'submission',
            resourceId: id,
            status: result.affectedRows ? 'allowed' : 'denied',
        }).catch((auditError) => console.error('Failed to log letter validation access:', auditError));
        if (!result.affectedRows) {
            if (req.user.role !== 'officer') {
                return res.status(404).json({ error: 'Submission not found.' });
            }
            return db.query(
                `SELECT s.submission_type, s.status, s.finalized_at,
                        EXISTS (
                            SELECT 1
                            FROM officer_year_level_assignments oya
                            WHERE oya.officer_id = ?
                              AND ${yearLevelSqlExpression('oya.year_level')} = ${yearLevelSqlExpression('u.year_level')}
                        ) AS assigned
                 FROM submissions s
                 LEFT JOIN users u ON u.scholar_id = s.scholar_id
                 WHERE s.id = ?
                 LIMIT 1`,
                [req.user.id, id],
                (lookupErr, rows) => {
                    if (lookupErr) {
                        console.error('Failed to classify denied letter review:', lookupErr);
                        return res.status(500).json({ error: 'Unable to verify submission review access.' });
                    }
                    if (!rows.length) return res.status(404).json({ error: 'Submission not found.' });
                    if (rows[0].submission_type !== 'letter' || !rows[0].assigned) {
                        return res.status(403).json({ error: 'This submission is outside your assigned year levels.' });
                    }
                    return res.status(409).json({ error: 'This letter has already been reviewed or is no longer reviewable.' });
                }
            );
        }
        res.json({ message: 'Submission reviewed successfully', id, review_status: resolvedStatus });
        logAuditEvent({ req, action: 'submission_reviewed', module: 'Submissions', details: `Reviewed submission ${id} as ${resolvedStatus}` });
        db.query(
            `UPDATE documents SET status = CASE ? WHEN 'approved' THEN 'Approved' WHEN 'returned' THEN 'Rejected' WHEN 'rejected' THEN 'Rejected' ELSE 'Pending' END WHERE source_submission_id = ?`,
            [resolvedStatus, id],
            (documentStatusErr) => { if (documentStatusErr) console.error('Document retention status update failed:', documentStatusErr.message); }
        );
        const donorApproval = resolvedStatus === 'approved' ? 1 : 0;
        db.query(
            `UPDATE submission_media
             SET approved_for_donor = ?,
                 approved_at = CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
                 approved_by = CASE WHEN ? = 1 THEN ? ELSE NULL END
             WHERE submission_id = ?`,
            [donorApproval, donorApproval, donorApproval, req.user.id, id],
            (mediaStatusErr) => { if (mediaStatusErr) console.error('Submission media approval update failed:', mediaStatusErr.message); }
        );

        // Fire-and-forget: notify scholar by email about the review decision
        try {
            // Get submission + scholar email
            db.query('SELECT scholar_id, submission_type, created_at FROM submissions WHERE id = ? LIMIT 1', [id], (sErr, rows) => {
                if (sErr || !rows || rows.length === 0) return; // nothing to do
                const sub = rows[0];
                db.query('SELECT email, full_name FROM users WHERE scholar_id = ? LIMIT 1', [sub.scholar_id], (uErr, uRows) => {
                    if (uErr || !uRows || uRows.length === 0) return;
                    const user = uRows[0];
                    const transporter = getTransporter();
                    if (!transporter) return;

                    const subject = resolvedStatus === 'approved'
                        ? 'Your submission has been approved'
                        : resolvedStatus === 'returned'
                            ? 'Your submission has been returned for revision'
                            : `Submission status: ${resolvedStatus}`;

                    const text = resolvedStatus === 'approved'
                        ? `Hello ${user.full_name || ''},\n\nYour ${sub.submission_type || 'submission'} has been approved by staff.\n\nThank you.`
                        : resolvedStatus === 'returned'
                            ? `Hello ${user.full_name || ''},\n\nYour ${sub.submission_type || 'submission'} was returned for revision.\n\nComment from staff: ${staff_comment || 'No comment provided.'}`
                            : `Hello ${user.full_name || ''},\n\nThe status of your submission has been updated to: ${resolvedStatus}.\n\nComment: ${staff_comment || 'No comment provided.'}`;

                    transporter.sendMail({
                        from: process.env.SMTP_FROM || process.env.SMTP_USER,
                        to: user.email,
                        subject,
                        text,
                    }).then((info) => {
                        // Log success to notification_logs
                        const detail = typeof info === 'object' ? JSON.stringify(info) : String(info);
                        db.query(
                            'INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
                            [sub.scholar_id, user.email, 'email', 'submission_review', 'sent', detail],
                            () => { /* ignore logging errors */ }
                        );
                    }).catch((err) => {
                        const detail = String(err);
                        db.query(
                            'INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
                            [sub.scholar_id, user.email, 'email', 'submission_review', 'failed', detail],
                            () => { /* ignore logging errors */ }
                        );
                    });

                    // Fire-and-forget: also dispatch webhook (if configured) and log result
                    try {
                        const webhookUrl = process.env.MESSENGER_WEBHOOK_URL;
                        if (webhookUrl) {
                            const parsed = new URL(webhookUrl);
                            const lib = parsed.protocol === 'https:' ? https : http;
                            const payloadObj = {
                                type: 'submission_review',
                                scholar_id: sub.scholar_id,
                                submission_id: id,
                                submission_type: sub.submission_type,
                                status: resolvedStatus,
                                staff_comment: staff_comment || null,
                                message: subject,
                            };
                            const payload = JSON.stringify(payloadObj);
                            const opts = {
                                method: 'POST',
                                hostname: parsed.hostname,
                                path: parsed.pathname + (parsed.search || ''),
                                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Content-Length': Buffer.byteLength(payload),
                                },
                                timeout: 5000,
                            };

                            const req = lib.request(opts, (resp) => {
                                let body = '';
                                resp.on('data', (c) => (body += c));
                                resp.on('end', () => {
                                    const statusText = resp.statusCode && resp.statusCode >= 200 && resp.statusCode < 300 ? 'sent' : 'failed';
                                    db.query(
                                        'INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
                                        [sub.scholar_id, parsed.hostname, 'webhook', 'submission_review', statusText, `${resp.statusCode}:${body}`],
                                        () => { /* ignore logging errors */ }
                                    );
                                });
                            });
                            req.on('error', (e) => {
                                db.query(
                                    'INSERT INTO notification_logs (scholar_id, recipient, channel, type, status, detail) VALUES (?, ?, ?, ?, ?, ?)',
                                    [sub.scholar_id, parsed.hostname, 'webhook', 'submission_review', 'failed', String(e)],
                                    () => { /* ignore logging errors */ }
                                );
                            });
                            req.on('timeout', () => {
                                req.destroy();
                            });
                            req.write(payload);
                            req.end();
                        }
                    } catch (webErr) {
                        // swallow webhook errors to avoid breaking flow
                    }
                });
            });
        } catch (notifyErr) {
            // swallow errors
        }
    });
};

// ============================================================
// GRADES (Scholar self-submit, locked per semester UNLESS the
// officer rejected it - a rejected semester unlocks for resubmission)
// ============================================================

// GET scholar's own grades, grouped by semester with computed GWA.
// Now also surfaces the officer's review_status + staff_comment per
// semester (previously this info existed in the `grades` table but was
// never selected here, so scholars never saw it).
exports.getGrades = (req, res) => {
    const { scholar_id } = req.params;

    const isOwner = req.user.role === 'scholar' && String(req.user.scholar_id) === String(scholar_id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Access denied: insufficient role' });
    }

    const sql = `
        SELECT id, semester, academic_year, subject_name, units, grade, proof_path, created_at,
               verification_status AS status, officer_comment AS staff_comment
        FROM grades
        WHERE scholar_id = ?
        ORDER BY academic_year DESC, semester ASC, subject_name ASC
    `;

    db.query(sql, [scholar_id], (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching grades' });

        const semMap = {};
        data.forEach(row => {
            const key = `${row.semester}|${row.academic_year}`;
            if (!semMap[key]) {
                semMap[key] = {
                    semester: row.semester,
                    academic_year: row.academic_year,
                    subjects: [],
                    total_units: 0,
                    weighted_sum: 0,
                    proof_path: row.proof_path,
                    submitted_at: row.created_at,
                    // review_status = officer's decision on THIS submission (pending/approved/rejected).
                    // All rows for one semester submission share the same status/comment.
                    review_status: row.status || 'pending',
                    staff_comment: row.staff_comment || null,
                };
            }
            semMap[key].subjects.push({
                id: row.id,
                subject_name: row.subject_name,
                units: row.units,
                grade: parseFloat(row.grade),
            });
            const units = Number(row.units) || 0;
            const grade = Number(row.grade);
            semMap[key].total_units += units;
            semMap[key].weighted_sum += units * grade;
        });

        const semesters = Object.values(semMap).map(sem => ({
            ...sem,
            gwa: sem.total_units > 0 ? parseFloat((sem.weighted_sum / sem.total_units).toFixed(2)) : null,
            // `status` here stays the ACADEMIC status (passed/failed based on GWA) -
            // unchanged meaning from before, kept for backward compatibility with the UI.
            status: sem.total_units > 0
                ? (sem.weighted_sum / sem.total_units) <= 3.00 ? 'passed' : 'failed'
                : 'pending',
            // Only a REJECTED semester unlocks for resubmission. Pending/approved stay locked.
            locked: sem.review_status !== 'rejected',
        }));

        res.json(semesters);
    });
};

// GET check if a specific semester is already locked (submitted) for this scholar.
// A semester only stays locked if a submission exists AND it hasn't been
// rejected - a rejected submission unlocks the form so the scholar can fix
// and resubmit.
exports.checkGradesLocked = (req, res) => {
    const { scholar_id, semester, academic_year } = req.params;

    const isOwner = req.user.role === 'scholar' && String(req.user.scholar_id) === String(scholar_id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Access denied: insufficient role' });
    }

    db.query(
        'SELECT verification_status AS status, officer_comment AS staff_comment FROM grades WHERE scholar_id = ? AND semester = ? AND academic_year = ? LIMIT 1',
        [scholar_id, semester, academic_year],
        (err, data) => {
            if (err) return res.status(500).json({ error: 'Error checking semester' });

            if (data.length === 0) {
                return res.json({ locked: false, status: null, staff_comment: null });
            }

            const status = data[0].status || 'pending';
            res.json({
                locked: status !== 'rejected',
                status,
                staff_comment: data[0].staff_comment || null,
            });
        }
    );
};

// POST submit a full semester's grades at once.
// Locked after this UNLESS the existing submission for this sem/year was
// rejected - in that case, the old (rejected) rows are cleared out first
// so the resubmission fully replaces them, then the new rows are inserted
// with a fresh 'pending' status.
// scholar_id comes from the verified JWT (req.user), never trusted from the body.
// req.file is validated in memory before its buffer is stored in Cloudinary.
exports.submitGrades = (req, res) => {
    const scholar_id = req.user.scholar_id;
    const { semester, academic_year } = req.body;
    let subjects;
    try {
        subjects = JSON.parse(req.body.subjects || '[]');
    } catch (e) {
        return res.status(400).json({ error: 'Invalid subjects data' });
    }

    if (!scholar_id || !semester || !academic_year || !Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ error: 'Missing required fields or empty subjects list' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'A photo of your Report Card / Grade Sheet is required as proof.' });
    }

    for (const subject of subjects) {
        if (!subject.subject_name || !subject.units || subject.grade === undefined) {
            return res.status(400).json({ error: 'Each subject needs subject_name, units, and grade' });
        }
        if (!Number.isFinite(Number(subject.units)) || Number(subject.units) <= 0) {
            return res.status(400).json({ error: `Invalid units for ${subject.subject_name}` });
        }
        if (!Number.isFinite(Number(subject.grade))) {
            return res.status(400).json({ error: `Invalid grade for ${subject.subject_name}` });
        }
    }

    findLatestAssignedTask(scholar_id, 'report_card')
        .then((assignedTask) => {
            if (!assignedTask) {
                throw Object.assign(new Error('You cannot submit grades because there is no active Report Card task assigned by the administrator yet.'), { statusCode: 409 });
            }
            return uploadBufferToCloudinary(req.file);
        })
        .then(async (asset) => {
            req.file.path = asset.secure_url;
            req.file.cloudinaryAsset = asset;
            await registerFileAssets(scholar_id, [req.file]);
            return saveGradesWithProofPath(req, res, scholar_id, semester, academic_year, subjects, asset.secure_url, assignedTask);
        })
        .catch((uploadError) => {
            console.error('Grade proof upload error:', uploadError);
            res.status(uploadError.statusCode || 502).json({ error: uploadError.message || 'Could not securely store the uploaded proof file' });
        });

};

const saveGradesWithProofPath = (req, res, scholar_id, semester, academic_year, subjects, proofPath, assignedTask) => {

    db.query(
        'SELECT year_level, verification_status AS status, g.created_at FROM users u LEFT JOIN grades g ON g.scholar_id = u.scholar_id AND g.semester = ? AND g.academic_year = ? WHERE u.scholar_id = ? ORDER BY g.created_at DESC LIMIT 1',
        [semester, academic_year, scholar_id],
        (userErr, userRows) => {
            if (userErr) {
                return res.status(500).json({ error: 'Error resolving scholar scale' });
            }

            const yearLevel = userRows?.[0]?.year_level || '';
            const gradeScale = resolveGradeScale(yearLevel);

            for (const subj of subjects) {
                if (!subj.subject_name || !subj.units || subj.grade === undefined) {
                    return res.status(400).json({ error: 'Each subject needs subject_name, units, and grade' });
                }
                const g = parseFloat(subj.grade);
                const validForScale = gradeScale === 'college'
                    ? (!isNaN(g) && g >= 1.00 && g <= 5.00)
                    : (!isNaN(g) && g >= 75 && g <= 100);

                if (!validForScale) {
                    return res.status(400).json({
                        error: gradeScale === 'college'
                            ? `Invalid grade for ${subj.subject_name}. Must be 1.00-5.00.`
                            : `Invalid grade for ${subj.subject_name}. Must be 75-100 for K-12.`,
                    });
                }
            }

            const existingStatus = userRows?.[0]?.status || null;
            const existingIsForCurrentTask = userRows?.[0]?.created_at
                && new Date(userRows[0].created_at).getTime() >= new Date(assignedTask.created_at || 0).getTime();

            if (existingStatus && existingIsForCurrentTask && existingStatus !== 'rejected') {
                return res.status(409).json({
                    error: `You have already submitted grades for ${semester} AY ${academic_year}. This semester is locked.`,
                });
            }

            const insertRows = () => {
                const values = subjects.map(s => [
                    scholar_id, semester, academic_year, s.subject_name,
                    parseInt(s.units), parseFloat(s.grade), gradeScale, proofPath, 'pending',
                ]);

                const insertSql = `
                    INSERT INTO grades (scholar_id, semester, academic_year, subject_name, units, grade, grade_scale, proof_path, verification_status)
                    VALUES ?
                `;

                db.query(insertSql, [values], (insertErr) => {
                    if (insertErr) {
                        return res.status(500).json({ error: 'Error saving grades' });
                    }

                    getComplianceSettings((settingsErr, settings) => {
                        if (!settingsErr && settings) {
                            const failingPredicate = (subjectGrade) => {
                                const grade = parseFloat(subjectGrade);
                                if (Number.isNaN(grade)) return false;
                                if (gradeScale === 'college') return grade > 3.00;
                                return grade < 75;
                            };

                            const failingSubjects = subjects.filter(s => failingPredicate(s.grade));
                            if (failingSubjects.length > 0) {
                                const points = failingSubjects.length * (settings.quality_drop_deduction ?? 4);
                                calculateCurrentCompliance(scholar_id, (calcErr, currentCompliance) => {
                                    if (!calcErr && typeof currentCompliance === 'number') {
                                        logComplianceIncident(
                                            scholar_id,
                                            'failing_grade_submitted',
                                            points,
                                            currentCompliance,
                                            clampCompliance(currentCompliance - points),
                                            `Submitted ${failingSubjects.length} failing grade row(s) for ${semester} ${academic_year}.`
                                        );
                                    }
                                });
                            }
                        }
                    });

                    const totalUnits = subjects.reduce((sum, s) => sum + parseInt(s.units), 0);
                    const weightedSum = subjects.reduce((sum, s) => sum + parseInt(s.units) * parseFloat(s.grade), 0);
                    const gwa = totalUnits > 0 ? parseFloat((weightedSum / totalUnits).toFixed(2)) : null;

                    res.status(201).json({
                        message: 'Grades submitted successfully and locked for this semester.',
                        semester, academic_year, gwa,
                        status: gwa !== null
                            ? (gradeScale === 'college' ? (gwa <= 3.00 ? 'passed' : 'failed') : (gwa >= 75 ? 'passed' : 'failed'))
                            : 'pending',
                    });
                });
            };

            if (existingStatus === 'rejected' || (existingStatus && !existingIsForCurrentTask)) {
                db.query(
                    'DELETE FROM grades WHERE scholar_id = ? AND semester = ? AND academic_year = ?',
                    [scholar_id, semester, academic_year],
                    (delErr) => {
                        if (delErr) return res.status(500).json({ error: 'Error clearing previous rejected submission' });
                        insertRows();
                    }
                );
            } else {
                insertRows();
            }
        }
    );
};

// APPROVE / REJECT AN ENTIRE SEMESTER'S GRADES SUBMISSION (Staff/Admin/Officer)
// Grades are stored ONE ROW PER SUBJECT (no single submission id), so a
// review updates every row that belongs to this scholar+semester+academic_year
// together, in one UPDATE.
exports.reviewGrades = (req, res) => {
    const { scholar_id, semester, academic_year, status, staff_comment } = req.body;

    if (!scholar_id || !semester || !academic_year || !status) {
        return res.status(400).json({ error: 'scholar_id, semester, academic_year, and status are required' });
    }

    const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
    const validStatuses = ['approved', 'rejected', 'pending'];
    if (!validStatuses.includes(normalizedStatus)) {
        return res.status(400).json({ error: 'Invalid status. Must be approved, rejected, or pending' });
    }

    const sql = `
        UPDATE grades
        SET verification_status = ?,
            officer_comment = ?,
            finalized_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END,
            export_available_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END,
            finalization_batch_id = CASE WHEN ? = 'approved' THEN ? ELSE NULL END
        WHERE scholar_id = ? AND semester = ? AND academic_year = ?
    `;
    const exportBatchId = normalizedStatus === 'approved' ? randomUUID() : null;
    db.query(sql, [normalizedStatus, staff_comment || null, normalizedStatus, normalizedStatus, normalizedStatus, exportBatchId, scholar_id, semester, academic_year], (err, result) => {
        if (err) {
            console.error('Error reviewing grades:', err);
            return res.status(500).json({ error: 'Error reviewing grades' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'No matching grades submission found for that scholar/semester/year' });
        }
        res.json({ message: 'Grades reviewed successfully' });
    });
};

// GET ALL GRADES (Staff/Admin/Officer) - grouped per scholar per semester,
// same GWA computation as getGrades(), just across ALL scholars.
exports.getAllGrades = (req, res) => {
    const conditions = [];
    const values = [];
    if (req.user.role === 'staff') {
        conditions.push(`EXISTS (
            SELECT 1 FROM scholar_group_members scoped_members
            JOIN scholar_groups scoped_groups ON scoped_groups.id = scoped_members.group_id
            WHERE scoped_members.scholar_id = g.scholar_id
              AND scoped_groups.assigned_staff_id = ?
        )`);
        values.push(req.user.id);
    }
    applyOfficerYearLevelFilter(req, conditions, values, 'u.year_level').then(() => {
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT g.*, g.verification_status AS status, g.officer_comment AS staff_comment, u.full_name
            FROM grades g
            LEFT JOIN users u ON g.scholar_id = u.scholar_id
            ${where}
            ORDER BY g.created_at DESC
        `;

        db.query(sql, values, (err, data) => {
            if (err) return res.status(500).json({ error: 'Error fetching grades' });

            const semMap = {};
            data.forEach(row => {
                const key = `${row.scholar_id}|${row.semester}|${row.academic_year}`;
                if (!semMap[key]) {
                    semMap[key] = {
                        scholar_id: row.scholar_id,
                        full_name: row.full_name,
                        semester: row.semester,
                        academic_year: row.academic_year,
                        proof_path: row.proof_path,
                        submitted_at: row.created_at,
                        subjects: [],
                        total_units: 0,
                        weighted_sum: 0,
                    };
                }
                semMap[key].subjects.push({
                    subject_name: row.subject_name,
                    units: row.units,
                    grade: parseFloat(row.grade),
                });
                semMap[key].total_units += row.units;
                semMap[key].weighted_sum += row.units * parseFloat(row.grade);
            });

            const grouped = Object.values(semMap).map(s => ({
                ...s,
                gwa: s.total_units > 0 ? parseFloat((s.weighted_sum / s.total_units).toFixed(2)) : null,
                status: s.total_units > 0
                    ? (s.weighted_sum / s.total_units) <= 3.00 ? 'passed' : 'failed'
                    : 'pending',
            }));

            res.json(grouped);
        });
    }).catch((err) => {
        console.error('Failed to scope grades to assigned scholars:', err);
        res.status(500).json({ error: 'Unable to verify scholar access.' });
    });
};

// ============================================================
// NAIVE BAYES ML EVALUATION
// Calls the Python Flask microservice (ml_service.py) to evaluate
// a scholar letter using the trained Naive Bayes model.
// Returns same shape as buildEval() so the frontend doesn't change.
// ============================================================
// ============================================================
// NAIVE BAYES ML EVALUATION — RUBRIC-BASED HYBRID SCORING
// Follows exact same formula as the Excel spreadsheet:
// Date(5%) + Body(70%) + Documentation(25%) = Evaluated Grade
//
// Body breakdown (70% total, 14% each):
//   Paragraph Structure, Academic, Self-Improvement, Family, Difficulty
//
// Documentation breakdown (25% total, 12.5% each):
//   Document/Picture, Caption
// ============================================================
exports.evaluateLetterML = async (req, res) => {
    return res.status(410).json({ error: 'AI evaluation has been permanently disabled for data privacy.' });
/*
    const {
        letter_text,
        media_count = 0,
        captions_complete = false,
        has_date = true,
    } = req.body;

    if (!letter_text || letter_text.trim().length < 10) {
        return res.status(400).json({ error: 'Missing or too short letter_text' });
    }

    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001/evaluate';

    try {
        // ── Call Flask Naive Bayes microservice ──
        const mlRes = await fetch(ML_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ letter_text: letter_text.trim() }),
            signal: AbortSignal.timeout(8000),
        });

        if (!mlRes.ok) throw new Error(`ML service responded with status ${mlRes.status}`);
        const ml = await mlRes.json();

        const words = letter_text.trim().split(/\s+/).filter(Boolean).length;
        const t = letter_text.toLowerCase();
        const sentences = letter_text.split(/[.!?]/).filter(s => s.trim().length > 5).length;

        // ── 1. DATE SCORE (5%) ──
        // Check if letter has a proper date format
        const hasProperDate = has_date &&
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(t) &&
            /\b(20\d{2})\b/.test(t);
        const dateScore = hasProperDate ? 100 : 0;

        // ── 2. BODY OF LETTER SCORES (70% total, 14% each) ──

        // Paragraph Structure — rule-based (ML doesn't directly measure this)
        let paragraphScore = 0;
        const paragraphs = letter_text.split(/\n\n+/).filter(p => p.trim().length > 20).length;
        if (paragraphs >= 3)      paragraphScore = 100; // intro, body, conclusion
        else if (paragraphs >= 2) paragraphScore = 75;
        else if (words >= 100)    paragraphScore = 50;
        else if (words >= 50)     paragraphScore = 25;
        else                      paragraphScore = 0;

        // Academic, Self-Improvement, Family, Difficulty — from Naive Bayes ML
        const academicScore        = ml.category_scores?.academic         ?? 0;
        const selfImprovementScore = ml.category_scores?.self_improvement ?? 0;
        const familyScore          = ml.category_scores?.family           ?? 0;
        const difficultyScore      = ml.category_scores?.difficulty       ?? 0;

        // Apply word count penalty to ML scores for very short letters
        const wordPenaltyFactor = words < 30 ? 0.1 : words < 50 ? 0.3 : words < 100 ? 0.6 : 1.0;

        const adjustedAcademic        = Math.round(academicScore        * wordPenaltyFactor);
        const adjustedSelfImprovement = Math.round(selfImprovementScore * wordPenaltyFactor);
        const adjustedFamily          = Math.round(familyScore          * wordPenaltyFactor);
        const adjustedDifficulty      = Math.round(difficultyScore      * wordPenaltyFactor);

        // ── 3. DOCUMENTATION SCORES (25% total, 12.5% each) ──

        // Document/Picture score
        let pictureScore = 0;
        if (media_count >= 2)      pictureScore = 100; // rubric requires at least 2
        else if (media_count === 1) pictureScore = 50;
        else                        pictureScore = 0;

        // Caption score
        const captionScore = media_count === 0 ? 0 : captions_complete ? 100 : 50;

        // ── 4. EVALUATED GRADE (exact same formula as Excel spreadsheet) ──
        // = (Date×5 + Para×14 + Academic×14 + Self×14 + Family×14 + Difficulty×14 + Picture×12.5 + Caption×12.5) / 100
        const overallScore = Math.round(
            (dateScore             * 5   +
             paragraphScore        * 14  +
             adjustedAcademic      * 14  +
             adjustedSelfImprovement * 14 +
             adjustedFamily        * 14  +
             adjustedDifficulty    * 14  +
             pictureScore          * 12.5 +
             captionScore          * 12.5) / 100
        );

        // ── 5. RISK LEVEL ──
        let riskLevel, riskColor, riskLabel, accepted, qualityStatus;
        if (overallScore >= 90) {
            riskLevel = 'accepted'; riskColor = '#16a34a'; riskLabel = 'Excellent';
            accepted = true; qualityStatus = 'accepted';
        } else if (overallScore >= 75) {
            riskLevel = 'accepted'; riskColor = '#16a34a'; riskLabel = 'Good';
            accepted = true; qualityStatus = 'accepted';
        } else if (overallScore >= 50) {
            riskLevel = 'medium'; riskColor = '#d97706'; riskLabel = 'Needs Improvement';
            accepted = false; qualityStatus = 'medium_risk';
        } else {
            riskLevel = 'high'; riskColor = '#ef4444'; riskLabel = 'Non-Compliant';
            accepted = false; qualityStatus = 'high_risk';
        }

        const toneLabel = overallScore >= 80 ? 'Strong' : overallScore >= 60 ? 'Moderate' : 'Informal';
        const toneColor = overallScore >= 80 ? '#16a34a' : overallScore >= 60 ? '#d97706' : '#ef4444';
        const sentimentLabel = overallScore >= 75 ? 'Positive' : overallScore >= 50 ? 'Neutral' : 'Negative';
        const sentimentScore = (overallScore - 50) / 50;

        return res.json({
            // Same shape as buildEval()
            overallScore,
            reportScore:  Math.round(
                (dateScore * 5 + paragraphScore * 14 + adjustedAcademic * 14 +
                 adjustedSelfImprovement * 14 + adjustedFamily * 14 + adjustedDifficulty * 14) / 79
            ),
            mediaScore: Math.round((pictureScore * 12.5 + captionScore * 12.5) / 25),
            toneLabel,
            toneColor,
            riskLevel,
            riskColor,
            riskLabel,
            accepted,
            qualityStatus,
            sentimentLabel,
            sentimentScore,

            // Full rubric breakdown (for UI display)
            rubric: {
                date:              { score: dateScore,                  weight: 5   },
                paragraph:         { score: paragraphScore,             weight: 14  },
                academic:          { score: adjustedAcademic,           weight: 14  },
                self_improvement:  { score: adjustedSelfImprovement,    weight: 14  },
                family:            { score: adjustedFamily,             weight: 14  },
                difficulty:        { score: adjustedDifficulty,         weight: 14  },
                picture:           { score: pictureScore,               weight: 12.5 },
                caption:           { score: captionScore,               weight: 12.5 },
            },

            // Raw ML output
            ml: {
                academic_detected:            ml.academic_detected,
                academic_probability:         ml.academic_probability,
                self_improvement_detected:    ml.self_improvement_detected,
                self_improvement_probability: ml.self_improvement_probability,
                family_detected:              ml.family_detected,
                family_probability:           ml.family_probability,
                difficulty_detected:          ml.difficulty_detected,
                difficulty_probability:       ml.difficulty_probability,
                compliance_label:             ml.compliance_label,
                compliance_probabilities:     ml.compliance_probabilities,
                category_scores:              ml.category_scores,
            },

            source: 'naive_bayes',
        });

    } catch (err) {
        console.error('ML service error:', err.message);
        return res.status(503).json({
            error: 'ML service unavailable',
            fallback: true,
            message: 'Naive Bayes service is offline. Use rule-based scoring as fallback.',
        });
    }
};
*/
};

// Generate or return existing generated PDF for a submission (Officer on-demand)
exports.getOrGenerateSubmissionPdf = async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing submission id' });

    // Validate id is an integer-like value early to avoid unnecessary DB work
    if (!Number.isInteger(Number(id))) return res.status(400).json({ error: 'Invalid submission id' });

    try {
        const rows = await new Promise((resolve, reject) => {
            db.query(
                `SELECT s.generated_pdf_path, s.scholar_id, s.submission_type, u.year_level
                 FROM submissions s
                 LEFT JOIN users u ON u.scholar_id = s.scholar_id
                 WHERE s.id = ? LIMIT 1`,
                [id],
                (err, result) => err ? reject(err) : resolve(result)
            );
        });
        if (!rows.length) return res.status(404).json({ error: 'Submission not found.' });

        const submission = rows[0];
        let allowed = req.user.role === 'admin';
        if (req.user.role === 'officer' && submission.submission_type === 'letter') {
            const levels = await getAssignedYearLevels(req.user.id);
            allowed = levels.some((level) => normalizeYearLevel(level) === normalizeYearLevel(submission.year_level));
        }
        await logPrivacyAccess(req, {
            action: allowed ? 'VIEW_DOCUMENT' : 'DENIED_ACCESS',
            resourceType: 'letter',
            resourceId: id,
            status: allowed ? 'allowed' : 'denied',
        });
        if (!allowed) return res.status(403).json({ error: 'You are not authorized to access this submission PDF.' });

        const existing = submission.generated_pdf_path || null;
        if (existing) {
            const isRemote = existing.startsWith('http://') || existing.startsWith('https://');
            if (isRemote || existing.includes('res.cloudinary.com')) return res.json({ path: existing });

            const rel = existing.startsWith('/') ? existing.slice(1) : existing;
            const abs = path.resolve(process.cwd(), rel);
            if (fs.existsSync(abs)) {
                console.log(`Using cached PDF for submission ${id}: ${abs}`);
                return res.json({ path: existing });
            }
        }

        const publicPath = await letterPdfGenerator.generateLetterPdf(id);
        return res.json({ path: publicPath });
    } catch (err) {
        console.error('Failed to access or generate submission PDF:', err);
        return res.status(500).json({ error: 'Failed to access or generate submission PDF.' });
    }
};

exports.downloadMonthlyLetterPdfs = async (req, res) => {
    const requestedIds = req.body?.submissionIds;
    if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one monthly letter.' });
    }

    const ids = [...new Set(requestedIds.map(Number))];
    if (ids.length > 500 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
        return res.status(400).json({ error: 'The selected monthly letter list is invalid.' });
    }

    try {
        const [rows] = await db.promise().query(
            `SELECT s.id, s.generated_pdf_path, s.letter_content, s.status, s.submission_type, u.full_name
             FROM submissions s
             INNER JOIN users u ON u.scholar_id = s.scholar_id
             WHERE s.id IN (?) AND s.status = 'approved' AND s.submission_type = 'letter'`,
            [ids]
        );

        if (rows.length !== ids.length) {
            return res.status(400).json({ error: 'Only approved monthly letter submissions can be exported.' });
        }

        const archive = archiver('zip', { zlib: { level: 6 } });
        const failures = [];
        archive.on('warning', warning => console.warn('Monthly letter ZIP warning:', warning.message));
        archive.on('error', archiveError => {
            console.error('Monthly letter ZIP error:', archiveError);
            if (!res.destroyed) res.destroy(archiveError);
        });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="monthly-letters-${new Date().toISOString().slice(0, 10)}.zip"`);
        archive.pipe(res);

        const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
        const readPdfPath = async filePath => {
            if (/^https:\/\//i.test(filePath)) {
                const parsed = new URL(filePath);
                if (parsed.hostname !== 'res.cloudinary.com') throw new Error('Unsupported PDF storage host.');
                const response = await fetch(parsed);
                if (!response.ok) throw new Error('Stored PDF could not be retrieved.');
                return Buffer.from(await response.arrayBuffer());
            }

            const relativePath = String(filePath).replace(/^\/?uploads[\\/]/i, '');
            if (!relativePath.startsWith('generated-letters/')) throw new Error('Invalid generated PDF path.');
            const localPath = path.resolve(uploadsRoot, relativePath);
            if (!localPath.startsWith(`${uploadsRoot}${path.sep}`)) throw new Error('Invalid generated PDF path.');
            return fs.promises.readFile(localPath);
        };

        for (const row of rows) {
            try {
                let pdfBuffer = null;
                if (row.generated_pdf_path) {
                    try {
                        pdfBuffer = await readPdfPath(row.generated_pdf_path);
                    } catch {
                        pdfBuffer = null;
                    }
                }
                if (!pdfBuffer) {
                    const generatedPath = await letterPdfGenerator.generateLetterPdf(row.id);
                    pdfBuffer = await readPdfPath(generatedPath);
                }

                const safeName = String(row.full_name || `Scholar-${row.id}`).replace(/[^a-z0-9._-]+/gi, '_');
                archive.append(pdfBuffer, { name: `${safeName}_Monthly_Letter_${row.id}.pdf` });
            } catch (pdfError) {
                console.error(`Monthly letter PDF export failed for submission ${row.id}:`, pdfError);
                failures.push(`Submission ${row.id} (${row.full_name || 'Scholar'}): ${pdfError.message}`);
            }
        }

        if (failures.length) archive.append(Buffer.from(failures.join('\n')), { name: 'download-errors.txt' });
        if (!rows.length || failures.length === rows.length) {
            archive.append(Buffer.from('No monthly letter PDFs could be generated.'), { name: 'README.txt' });
        }
        await archive.finalize();
    } catch (error) {
        console.error('Bulk monthly letter PDF export failed:', error);
        if (!res.headersSent) return res.status(500).json({ error: 'Unable to create the monthly letter archive.' });
        if (!res.destroyed) res.destroy(error);
    }
};

exports.submitGradesResumable = async (req, res) => {
    const uploadId = String(req.body.resumable_upload_id || '');
    if (!uploadId) return res.status(400).json({ error: 'A completed resumable proof upload is required' });
    try {
        req.file = await consumeCompleted(uploadId, req.user.scholar_id);
        await submitGrades(req, res);
        await removeSession(uploadId);
    } catch (error) {
        return res.status(error.statusCode || 500).json({ error: error.message || 'Could not use resumable proof upload' });
    }
};

const registerRetentionDocuments = async (scholarId, submissionId, files, categoryByField = {}) => {
    for (const file of files) {
        if (!file?.path || file.fieldname === 'media') continue;
        const category = categoryByField[file.fieldname] || file.fieldname || 'other';
        await new Promise((resolve) => {
            db.query(
                `INSERT INTO documents (scholar_id, category, file_name, file_path, file_size, mime_type, status, retention_until, source_submission_id)
                 VALUES (?, ?, ?, ?, ?, ?, 'Pending', DATE_ADD(NOW(), INTERVAL 5 YEAR), ?)`,
                [scholarId, category, file.originalname || `${category}-${submissionId}`, file.path, file.size || null, file.mimetype || null, submissionId],
                (err) => {
                    if (err) console.error('Retention document registry error:', err.message);
                    resolve();
                }
            );
        });
    }
};