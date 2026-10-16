const PORTAL_TYPE_TO_SUBMISSION_TYPE = {
  'Monthly Report': 'letter',
  'Report Card': 'report_card',
  'COR Upload': 'cor',
};

const latestSubmissionOfType = (history, submissionType, taskCreatedAt) => {
  const taskTime = taskCreatedAt ? new Date(taskCreatedAt).getTime() : null;
  return (history || [])
    .filter((item) => item.submission_type === submissionType
      && (taskTime === null || new Date(item.submitted_at || 0).getTime() >= taskTime))
    .slice()
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0] || null;
};

const latestGradeSubmission = (grades, taskCreatedAt) => {
  const taskTime = taskCreatedAt ? new Date(taskCreatedAt).getTime() : null;
  return (Array.isArray(grades) ? grades : [])
    .filter((grade) => taskTime === null || new Date(grade.submitted_at || 0).getTime() >= taskTime)
    .slice()
    .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0] || null;
};

const normalizeReviewStatus = (item) => String(
  item?.status || item?.verification_status || item?.quality_status || ''
).trim().toLowerCase();

const isApprovedReviewStatus = (item) => ['approved', 'accepted', 'completed', 'complied'].includes(normalizeReviewStatus(item));

export const buildScholarChecklist = ({ duties = [], history = [], grades = [], tasks = [] }) => {
  const dutyItems = duties.map((duty) => ({
    id: `duty-${duty.id}`,
    title: duty.title,
    type: 'Duty Participation',
    description: duty.description || `Attend duty at ${duty.location || 'assigned location'}`,
    done: duty.computed_status === 'completed',
    completedAt: duty.computed_status === 'completed' ? duty.marked_at || duty.duty_date : null,
    route: '/scholar/duties',
    status: duty.computed_status || 'pending',
    dueDate: duty.duty_date,
    staffComment: null,
  }));

  const taskItems = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task && (task.source === 'manual' || typeof task.id === 'number' || typeof task.id === 'string'))
    .map((task) => {
      const submissionType = PORTAL_TYPE_TO_SUBMISSION_TYPE[task.type];
      const latest = submissionType
        ? submissionType === 'report_card'
          ? latestGradeSubmission(grades, task.created_at)
          : latestSubmissionOfType(history, submissionType, task.created_at)
        : null;
      const rawStatus = normalizeReviewStatus(latest) || null;
      const done = isApprovedReviewStatus(latest);
      const isGoogleClassroom = String(task.source || '').toLowerCase() === 'google_classroom';
      const dueDate = task.due_date || null;
      const duePassed = dueDate && new Date(dueDate).getTime() < Date.now();
      const status = done
        ? 'completed'
        : rawStatus === 'rejected'
          ? 'rejected'
          : latest
            ? 'pending_review'
              : duePassed
              ? 'missing'
              : 'pending';

      return {
        id: `portal-${task.id}`,
        title: task.title || 'Task',
        type: task.type || 'Task',
        description: task.instructions || '',
        createdByName: task.created_by_name || task.created_by || 'System',
        createdByRole: task.created_by_role || '',
        createdAt: task.created_at || '',
        done,
        completedAt: done ? latest?.approved_at || latest?.reviewed_at || latest?.submitted_at || null : null,
        route: isGoogleClassroom ? null : (task.route || '/scholar/submission'),
        status,
        dueDate,
        staffComment: rawStatus === 'rejected' ? (latest?.staff_comment || null) : null,
        source: task.source || 'manual',
      };
    });

  return [...dutyItems, ...taskItems];
};