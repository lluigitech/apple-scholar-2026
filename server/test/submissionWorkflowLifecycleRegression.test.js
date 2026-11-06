const fs = require('fs');
const path = require('path');
const assert = require('assert');

const controllerContent = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'submissionController.js'),
  'utf8'
);
const officerControllerContent = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'officerController.js'),
  'utf8'
);
const taskBoardContent = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Officer', 'TaskAssignment', 'TaskAssignmentBoard.jsx'),
  'utf8'
);
const submissionRoutesContent = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'submissionRoutes.js'),
  'utf8'
);
const scholarSubmissionContent = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scholar', 'Submission.jsx'),
  'utf8'
);
const scholarGradesContent = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'components', 'Scholar', 'SubmissionPage', 'ScholarGrades.jsx'),
  'utf8'
);
const scholarChecklistContent = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'scholarChecklist.js'),
  'utf8'
);
const scholarTaskListContent = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scholar', 'RequirementsChecklist.jsx'),
  'utf8'
);
const scholarDashboardContent = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Scholar', 'ScholarDashboard.jsx'),
  'utf8'
);
const adminTaskBoardContent = fs.readFileSync(
  path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Admin', 'AdminTaskAssignmentBoard.jsx'),
  'utf8'
);
const notificationHelpersContent = fs.readFileSync(
  path.join(__dirname, '..', 'utils', 'notifyHelpers.js'),
  'utf8'
);

assert.ok(
  controllerContent.includes('under_review') &&
    controllerContent.includes('returned') &&
    controllerContent.includes('s.finalized_at = NULL') &&
    controllerContent.includes("s.export_available_at = CASE WHEN ? = 'approved' THEN DATE_ADD(NOW(), INTERVAL 3 DAY) ELSE NULL END"),
  'approved submissions should remain in Manual Validation for three days before Reports'
);

assert.ok(
  controllerContent.includes("gradeRows: gradeRows.filter(row => isAssignedYearLevel(row.year_level))") &&
    controllerContent.includes('year_level: row.year_level') &&
    !controllerContent.includes("gradeRows: []"),
  'Officer Manual Validation should include grades only for assigned year levels'
);

assert.ok(
  submissionRoutesContent.includes("router.put('/review/:id', verifyToken, requireRole(['officer']") &&
    submissionRoutesContent.includes("router.put('/grades/review', verifyToken, requireRole(['officer'])") &&
    submissionRoutesContent.includes("router.get('/scholar-view', verifyToken, requireRole(['officer']") &&
    controllerContent.includes("if (req.user.role !== 'officer')") &&
    controllerContent.includes("if (req.user?.role !== 'officer')"),
  'all compliance review decisions should be Officer-only; Admin access remains read-only'
);

assert.ok(
  controllerContent.includes("s.status IN ('pending', 'under_review')") &&
    controllerContent.includes("AND verification_status = 'pending'") &&
    controllerContent.includes('AND finalized_at IS NULL') &&
    controllerContent.includes('officer_year_level_assignments oya') &&
    controllerContent.includes("conditions.push('g.finalized_at IS NOT NULL')"),
  'Officer review should only update pending, unfinalized submissions within assigned year levels'
);

assert.ok(
  controllerContent.includes("s.export_available_at = CASE WHEN ? = 'approved' THEN DATE_ADD(NOW(), INTERVAL 3 DAY) ELSE NULL END") &&
    controllerContent.includes("export_available_at = CASE WHEN ? = 'approved' THEN DATE_ADD(NOW(), INTERVAL 3 DAY) ELSE NULL END") &&
    controllerContent.includes('SET finalized_at = NOW(), export_available_at = NOW(), finalization_batch_id = ?') &&
    controllerContent.includes('WHERE s.finalized_at IS NOT NULL') &&
    controllerContent.includes('WHERE g.finalized_at IS NOT NULL') &&
    controllerContent.includes("INTERVAL 3 DAY"),
  'approved submissions and grades should become report/export records after three days'
);

assert.ok(
  !controllerContent.includes('archiveExpiredApprovals'),
  'submission lifecycle should not automatically archive approved submissions'
);

assert.ok(
  officerControllerContent.includes('const missingTasks = assigned.filter') &&
    officerControllerContent.includes('return !Number.isNaN(dueDate.getTime()) && dueDate < today') &&
    officerControllerContent.includes("task.type === 'Report Card' && record.submission_type === 'grades'"),
  'task completion should mark unsubmitted overdue requirements missing without cross-matching grades'
);

assert.ok(
  !officerControllerContent.includes("WHERE ${conditions.join(' AND ')} AND finalized_at IS NOT NULL AND status = 'approved'"),
  'monthly submissions should not duplicate the status/finalized filters in the WHERE clause'
);

assert.ok(
  controllerContent.includes('findLatestAssignedTask') &&
    controllerContent.includes('no active task assigned by the administrator') &&
    controllerContent.includes('You already submitted this requirement for the current task') &&
  controllerContent.includes('existingIsForCurrentTask') &&
    controllerContent.includes("status IN ('rejected', 'returned', 'needs_revision', 'needs-revision')"),
  'requirement submissions should require an assigned task and allow replacement only after rejection/revision or a newer task'
);

assert.ok(
  controllerContent.includes('t.due_date < CURRENT_DATE()') &&
    controllerContent.includes('Number(assignedTask.deadline_passed) === 1') &&
    controllerContent.includes('The deadline for this task has passed. Submissions are closed.'),
  'late requirement submissions should be rejected by the server after the due date'
);

assert.ok(
  controllerContent.includes('exports.getScholarTaskDeadlines') &&
    submissionRoutesContent.includes("router.get('/deadlines', verifyToken, requireRole(['scholar'])"),
  'the authenticated scholar deadline endpoint should use the server task-deadline checks'
);

assert.ok(
  scholarSubmissionContent.includes('This task is closed. Late submissions are not accepted.') &&
    scholarSubmissionContent.includes('disabled={deadlineBlocked}') &&
      !controllerContent.includes('Number(effectiveScore) < 75'),
    'a low-scoring monthly letter should remain submittable for Officer review'
);

assert.ok(
  scholarGradesContent.includes('This task is closed. Late submissions are not accepted.') &&
    scholarGradesContent.includes('disabled={submitting || checkingDeadline || !taskDeadline?.assigned || taskDeadline.closed'),
  'the Scholar Grades submission control should be disabled for closed or unverified tasks'
);

assert.ok(
  scholarChecklistContent.includes('const duePassed = isPastDue(dueDate)') &&
    scholarChecklistContent.includes("? 'closed'") &&
    scholarTaskListContent.includes("{ key: 'closed', label: 'Closed'") &&
    scholarDashboardContent.includes("{ label: 'Closed', detail: 'Late submissions are not accepted'"),
  'overdue uncompleted portal tasks should display under Closed in Scholar task lists'
);

assert.ok(
  adminTaskBoardContent.includes("'Other Documents'") &&
    taskBoardContent.includes("'Other Documents'") &&
    scholarChecklistContent.includes("'Other Documents': 'other'") &&
    controllerContent.includes("other: 'Other Documents'") &&
    controllerContent.includes("const taskTypes = ['letter', 'report_card', 'cor', 'other']"),
  'Other Documents tasks should be supported across Admin, Officer, Scholar, and deadline enforcement'
);

assert.ok(
  officerControllerContent.includes("'other documents': { submissionType: 'other', requirement: 'Other Documents' }") &&
    officerControllerContent.includes("'Other Documents': 'other'") &&
    notificationHelpersContent.includes("'Other Documents': 'other'"),
  'Other Documents tasks should be included in Officer task completion and deadline notifications'
);

assert.ok(
  taskBoardContent.includes("return isPastDue(task.dueDate) ? 'closed' : 'pending'") &&
    taskBoardContent.includes("closed: { label: 'Closed'"),
  'unfinished tasks past their due date should display as Closed in the officer task board'
);

const gradesSubmitStart = controllerContent.indexOf('exports.submitGrades =');
const gradesDeadlineCheck = controllerContent.indexOf(
  'Number(assignedTask.deadline_passed) === 1',
  gradesSubmitStart
);
const gradesCloudUpload = controllerContent.indexOf('uploadBufferToCloudinary(req.file)', gradesSubmitStart);
assert.ok(
  gradesSubmitStart !== -1 &&
    gradesDeadlineCheck > gradesSubmitStart &&
    gradesCloudUpload > gradesDeadlineCheck,
  'late report-card submissions should be rejected before proof files are uploaded'
);

console.log('submissionWorkflowLifecycleRegression test passed');
