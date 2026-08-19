const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');
const nodemailer = require('nodemailer');
const letterPdfGenerator = require('../services/letterPdfGenerator');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { normalizeSubmissionValue } = require('../utils/submissionPayload');
const { logComplianceIncident, clampCompliance, getComplianceSettings, calculateCurrentCompliance, resolveGradeScale } = require('../utils/complianceLogger');

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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

// HELPER: Convert an in-memory file buffer to Gemini's expected format.
// Used only for the /analyze preview routes (memoryStorage - never touches disk or Cloudinary).
const bufferToGenerativePart = (buffer, mimeType) => {
    return {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType
        }
    };
};

// ANALYZE REPORT CARD (preview only, not saved anywhere)
exports.analyzeReportCard = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const filePart = bufferToGenerativePart(req.file.buffer, req.file.mimetype);

        const prompt = `
            Analyze this document. Check if it is a valid Report Card or Grade Sheet.
            Extract the following and return ONLY a JSON object, no other text:
            {
                "valid": true or false,
                "has_grades": true or false,
                "student_name": "name or null",
                "gwa": number or null,
                "grades": [{"subject": "name", "grade": number}],
                "school": "school name or null",
                "reason": "brief explanation"
            }
        `;

        const result = await model.generateContent([prompt, filePart]);
        const text = result.response.text();
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        res.json(parsed);
    } catch (err) {
        console.error('Gemini error:', err);
        res.status(500).json({ error: 'Error analyzing document' });
    }
};

// ANALYZE COR (preview only, not saved anywhere)
exports.analyzeCor = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const filePart = bufferToGenerativePart(req.file.buffer, req.file.mimetype);

        const prompt = `
            Analyze this document. Check if it is a valid Certificate of Registration (COR).
            Return ONLY a JSON object, no other text:
            {
                "valid": true or false,
                "is_enrolled": true or false,
                "student_name": "name or null",
                "school": "school name or null",
                "course": "course or null",
                "school_year": "school year or null",
                "reason": "brief explanation"
            }
        `;

        const result = await model.generateContent([prompt, filePart]);
        const text = result.response.text();
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        res.json(parsed);
    } catch (err) {
        console.error('Gemini error:', err);
        res.status(500).json({ error: 'Error analyzing document' });
    }
};

// ANALYZE LETTER (NLP Sentiment)
exports.analyzeLetter = async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `
            Analyze the sentiment and quality of this scholar's monthly report letter.
            Return ONLY a JSON object, no other text:
            {
                "sentiment": "Very Positive" or "Positive" or "Neutral" or "Negative" or "Very Negative",
                "score": number between -1 and 1,
                "word_count": number,
                "has_sufficient_content": true or false,
                "key_concerns": ["list of concerns if any"],
                "summary": "brief summary of the letter",
                "reason": "explanation of sentiment"
            }

            Letter: "${text}"
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const clean = responseText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        res.json(parsed);
    } catch (err) {
        console.error('Gemini error:', err);
        res.status(500).json({ error: 'Error analyzing letter' });
    }
};

// GET LETTERS FOR CORRESPONDENCE EVALUATOR
exports.getLetters = (req, res) => {
    const sql = `
        SELECT
            s.id,
            s.scholar_id,
            s.letter_content,
            s.quality_score,
            s.quality_status,
            s.sentiment_score,
            s.sentiment_label,
            s.status,
            s.officer_comment AS staff_comment,
            s.submitted_at,
            u.full_name,
            u.year_level
        FROM submissions s
        LEFT JOIN users u ON s.scholar_id = u.scholar_id
        WHERE s.submission_type = 'letter'
        ORDER BY s.submitted_at DESC
    `;

    db.query(sql, (err, rows) => {
        if (err) {
            console.error('Error fetching letters:', err);
            const detailObj = {
                message: err && err.message ? err.message : null,
                code: err && err.code ? err.code : null,
                sqlMessage: err && err.sqlMessage ? err.sqlMessage : null,
                sqlState: err && err.sqlState ? err.sqlState : null,
                errno: err && err.errno ? err.errno : null,
            };
            return res.status(500).json({ error: 'Error fetching letters', detail: detailObj });
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
        const reportCardPath = req.files?.['report_card']?.[0]?.path || null;
        const corPath = req.files?.['cor']?.[0]?.path || null;
        const mediaFiles = req.files?.['media'] || [];

        const resolvedType = normalizeSubmissionType(submission_type, {
            hasLetter: !!(letter_content && letter_content.trim()),
            hasReportCard: !!reportCardPath,
            hasCor: !!corPath,
        });

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
            report_card_path: normalizeSubmissionValue(reportCardPath),
            cor_path: normalizeSubmissionValue(corPath),
            service_activity: normalizeSubmissionValue(service_activity),
            service_hours: normalizeSubmissionValue(service_hours),
            service_date: normalizeSubmissionValue(service_date),
            // quality_score/quality_status are only meaningful for 'letter' type
            quality_score: resolvedType === 'letter' ? normalizeSubmissionValue(quality_score) : null,
            quality_status: resolvedType === 'letter' ? normalizeQualityStatus(normalizeSubmissionValue(quality_status)) : null,
        };

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
                report_card_path, cor_path, service_activity, service_hours,
                service_date, quality_score, quality_status, status, officer_comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                normalizedPayload.report_card_path,
                normalizedPayload.cor_path,
                normalizedPayload.service_activity,
                normalizedPayload.service_hours,
                normalizedPayload.service_date,
                normalizedPayload.quality_score,
                normalizedPayload.quality_status,
                'pending',   // status - always starts fresh, regardless of any earlier rejected row
                null,        // officer_comment - always starts empty, old officer feedback stays only on the old row
            ], (err, result) => {
                if (err) {
                    console.error('DB error saving submission:', err);
                    return res.status(500).json({ error: 'Error saving submission' });
                }

                const submissionId = result.insertId;

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
                        const mediaSql = "INSERT INTO submission_media (submission_id, file_path, description) VALUES ?";
                        db.query(mediaSql, [mediaValues], (mediaErr) => {
                            if (mediaErr) console.error('Media save error:', mediaErr);
                        });
                    }
                }

                if (resolvedType === 'letter') {
                    letterPdfGenerator.generateLetterPdf(submissionId)
                        .then((publicPath) => {
                            console.log(`Generated PDF for submission ${submissionId}: ${publicPath}`);
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
    } catch (err) {
        console.error('Submit error:', err);
        res.status(500).json({ error: 'Server error' });
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
        // Basic safety check: only allow proxying actual Cloudinary URLs
        if (!url.includes('res.cloudinary.com')) {
            return res.status(400).json({ error: 'Invalid file source' });
        }

        const remoteRes = await fetch(url, { redirect: 'follow' });

        if (!remoteRes.ok) {
            return res.status(remoteRes.status).json({ error: 'File not found on Cloudinary' });
        }

        const contentType = remoteRes.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('content-type', contentType);
        res.setHeader('content-disposition', 'inline'); // "inline" = preview in browser, not force-download

        res.send(Buffer.from(await remoteRes.arrayBuffer()));
    } catch (err) {
        console.error('Preview proxy error:', err);
        res.status(500).json({ error: 'Unable to preview file' });
    }
};

// GET SUBMISSIONS BY SCHOLAR
// Scholar can only fetch their OWN history; Staff/Admin can fetch any scholar's history.
exports.getHistory = (req, res) => {
    const { scholar_id } = req.params;

    const isOwner = req.user.role === 'scholar' && req.user.scholar_id === scholar_id;
    const isStaffOrAdmin = ['officer'].includes(req.user.role);

    if (!isOwner && !isStaffOrAdmin) {
        return res.status(403).json({ message: 'Access denied: insufficient role' });
    }

    const sql = `
        SELECT s.*,
        s.officer_comment AS staff_comment,
        GROUP_CONCAT(sm.file_path) as media_paths,
        GROUP_CONCAT(sm.description) as media_descriptions
        FROM submissions s
        LEFT JOIN submission_media sm ON s.id = sm.submission_id
        WHERE s.scholar_id = ?
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
    const sql = `
        SELECT s.*, s.officer_comment AS staff_comment, u.full_name, u.scholar_id as sid,
        GROUP_CONCAT(sm.file_path) as media_paths
        FROM submissions s
        LEFT JOIN users u ON s.scholar_id = u.scholar_id
        LEFT JOIN submission_media sm ON s.id = sm.submission_id
        GROUP BY s.id
        ORDER BY s.submitted_at DESC
    `;
    db.query(sql, (err, data) => {
        if (err) return res.status(500).json({ error: 'Error fetching submissions' });
        res.json(data);
    });
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
        SELECT g.*, g.verification_status AS status, g.officer_comment AS staff_comment, u.full_name
        FROM grades g
        LEFT JOIN users u ON g.scholar_id = u.scholar_id
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

            const scholars = {};

            const ensureScholar = (scholar_id, full_name) => {
                if (!scholars[scholar_id]) {
                    scholars[scholar_id] = {
                        scholar_id,
                        full_name: full_name || null,
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
                return scholars[scholar_id];
            };

            // --- group submissions rows by scholar + type ---
            submissions.forEach(row => {
                const bucket = ensureScholar(row.scholar_id, row.full_name);

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
            gradeRows.forEach(row => {
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
                const bucket = ensureScholar(sem.scholar_id, sem.full_name);
                bucket.grades.push({
                    ...sem,
                    gwa: sem.total_units > 0 ? parseFloat((sem.weighted_sum / sem.total_units).toFixed(2)) : null,
                    academic_status: sem.total_units > 0
                        ? (sem.weighted_sum / sem.total_units) <= 3.00 ? 'passed' : 'failed'
                        : 'pending',
                });
            });

            res.json(Object.values(scholars));
        });
    });
};

// APPROVE / REJECT SUBMISSION (Staff/Admin/Officer)
// Works for ANY submission_type (letter, report_card, cor, other) since they're
// all just rows in `submissions` with their own id.
exports.reviewSubmission = (req, res) => {
    const { id } = req.params;
    const { status, staff_comment } = req.body;

    const sql = "UPDATE submissions SET status = ?, officer_comment = ? WHERE id = ?";
    db.query(sql, [status, staff_comment, id], (err) => {
        if (err) return res.status(500).json({ error: 'Error updating submission' });
        res.json({ message: 'Submission reviewed successfully' });

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

                    const subject = status === 'approved'
                        ? 'Your submission has been approved'
                        : status === 'rejected'
                            ? 'Your submission has been returned for revision'
                            : `Submission status: ${status}`;

                    const text = status === 'approved'
                        ? `Hello ${user.full_name || ''},\n\nYour ${sub.submission_type || 'submission'} has been approved by staff.\n\nThank you.`
                        : status === 'rejected'
                            ? `Hello ${user.full_name || ''},\n\nYour ${sub.submission_type || 'submission'} was returned for revision.\n\nComment from staff: ${staff_comment || 'No comment provided.'}`
                            : `Hello ${user.full_name || ''},\n\nThe status of your submission has been updated to: ${status}.\n\nComment: ${staff_comment || 'No comment provided.'}`;

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
                                status,
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

    const isOwner = req.user.role === 'scholar' && req.user.scholar_id === scholar_id;
    const isStaffOrAdmin = ['officer'].includes(req.user.role);

    if (!isOwner && !isStaffOrAdmin) {
        return res.status(403).json({
            message: 'Access denied: insufficient role',
            debug_reqUser: req.user,
            debug_urlScholarId: scholar_id,
        });
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
            semMap[key].total_units += row.units;
            semMap[key].weighted_sum += row.units * parseFloat(row.grade);
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

    const isOwner = req.user.role === 'scholar' && req.user.scholar_id === scholar_id;
    const isStaffOrAdmin = ['officer'].includes(req.user.role);

    if (!isOwner && !isStaffOrAdmin) {
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
// req.file.path is the Cloudinary secure URL for the proof photo.
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

    const proofPath = req.file.path;

    db.query(
        'SELECT year_level, verification_status AS status FROM users u LEFT JOIN grades g ON g.scholar_id = u.scholar_id AND g.semester = ? AND g.academic_year = ? WHERE u.scholar_id = ? LIMIT 1',
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

            if (existingStatus && existingStatus !== 'rejected') {
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

            if (userRows?.[0]?.status === 'rejected') {
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
        SET verification_status = ?, officer_comment = ?
        WHERE scholar_id = ? AND semester = ? AND academic_year = ?
    `;
    db.query(sql, [normalizedStatus, staff_comment || null, scholar_id, semester, academic_year], (err, result) => {
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
    const sql = `
        SELECT g.*, g.verification_status AS status, g.officer_comment AS staff_comment, u.full_name
        FROM grades g
        LEFT JOIN users u ON g.scholar_id = u.scholar_id
        ORDER BY g.created_at DESC
    `;

    db.query(sql, (err, data) => {
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
            riskLevel = 'accepted'; riskColor = '#16a34a'; riskLabel = 'Excellent Compliance';
            accepted = true; qualityStatus = 'accepted';
        } else if (overallScore >= 75) {
            riskLevel = 'accepted'; riskColor = '#16a34a'; riskLabel = 'Good Compliance';
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

// Generate or return existing generated PDF for a submission (Officer on-demand)
exports.getOrGenerateSubmissionPdf = async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing submission id' });

    // Validate id is an integer-like value early to avoid unnecessary DB work
    if (!Number.isInteger(Number(id))) return res.status(400).json({ error: 'Invalid submission id' });

    try {
        // First check DB for existing path
        db.query('SELECT generated_pdf_path FROM submissions WHERE id = ? LIMIT 1', [id], async (err, rows) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            const existing = rows?.[0]?.generated_pdf_path || null;

            if (existing) {
                const isRemote = existing.startsWith('http://') || existing.startsWith('https://');
                if (isRemote || existing.includes('res.cloudinary.com')) {
                    return res.json({ path: existing });
                }

                // ensure file exists on disk. Keep the 'uploads' segment — strip a leading slash if present.
                const rel = existing.startsWith('/') ? existing.slice(1) : existing;
                const abs = path.resolve(process.cwd(), rel);
                if (fs.existsSync(abs)) {
                    console.log(`Using cached PDF for submission ${id}: ${abs}`);
                    return res.json({ path: existing });
                }
            }

            // Generate anew
            try {
                const publicPath = await letterPdfGenerator.generateLetterPdf(id);
                return res.json({ path: publicPath });
            } catch (genErr) {
                console.error('PDF generation error:', genErr);
                return res.status(500).json({ error: 'Failed to generate PDF', detail: String(genErr) });
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
};