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

assert.ok(
  controllerContent.includes('under_review') && controllerContent.includes('returned') && controllerContent.includes("s.finalized_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END"),
  'approved submissions should move directly from manual validation to Reports'
);

assert.ok(
  controllerContent.includes("s.export_available_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END") &&
    controllerContent.includes("export_available_at = CASE WHEN ? = 'approved' THEN NOW() ELSE NULL END") &&
    controllerContent.includes('SET finalized_at = NOW(), export_available_at = NOW(), finalization_batch_id = ?') &&
    !controllerContent.includes('DATE_ADD(NOW(), INTERVAL 7 DAY)'),
  'approved submissions and grades should be exportable immediately'
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

console.log('submissionWorkflowLifecycleRegression test passed');
