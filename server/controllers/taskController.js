const db = require('../config/db');
const { getAssignedYearLevels, getAllAssignedYearLevels } = require('../utils/officerAssignments');
const { buildTaskComplianceHTML } = require('../services/taskComplianceTemplate');
const { generateReportPdf } = require('../services/reportPdfService');

const parseTargetLevels = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeYearLevel = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, ' ');
  const aliases = {
    'grade 7': 'grade 7', 'grade7': 'grade 7', 'grade 8': 'grade 8', 'grade8': 'grade 8',
    'grade 9': 'grade 9', 'grade9': 'grade 9', 'grade 10': 'grade 10', 'grade10': 'grade 10',
    'grade 11': 'grade 11', 'grade11': 'grade 11', 'grade 12': 'grade 12', 'grade12': 'grade 12',
    'college 1': 'college 1', '1st year': 'college 1', '1st year college': 'college 1',
    'college 2': 'college 2', '2nd year': 'college 2', '2nd year college': 'college 2',
    'college 3': 'college 3', '3rd year': 'college 3', '3rd year college': 'college 3',
    'college 4': 'college 4', '4th year': 'college 4', '4th year college': 'college 4',
    'college 5': 'college 5', '5th year': 'college 5', '5th year college': 'college 5',
  };
  return aliases[normalized] || normalized;
};

const getAssignedOfficers = (targetLevels) => new Promise((resolve, reject) => {
  if (!Array.isArray(targetLevels) || targetLevels.length === 0) return resolve([]);
  db.query(
    `SELECT DISTINCT u.id, u.full_name, u.scholar_id, oya.year_level
     FROM officer_year_level_assignments oya
     JOIN users u ON u.id = oya.officer_id
    WHERE u.role = 'officer' AND u.status = 'active'
     ORDER BY u.full_name, oya.year_level`,
      (err, rows) => err ? reject(err) : resolve(rows.filter(row => targetLevels.some(level => normalizeYearLevel(level) === normalizeYearLevel(row.year_level))))
  );
});

const visibleToUser = async (req, task) => {
  const targetLevels = parseTargetLevels(task.target_year_levels);
  if (!targetLevels?.length || ['admin', 'staff'].includes(req.user?.role)) return true;

  if (req.user?.role === 'officer') {
    const assignedLevels = await getAssignedYearLevels(req.user.id);
    return targetLevels.some(level => assignedLevels.some(assigned => normalizeYearLevel(level) === normalizeYearLevel(assigned)));
  }

  if (req.user?.role === 'scholar') {
    return new Promise((resolve, reject) => {
      db.query('SELECT year_level FROM users WHERE id = ? AND role = \'scholar\'', [req.user.id], (err, rows) => {
        if (err) return reject(err);
        resolve(Boolean(
          rows[0]?.year_level
          && targetLevels.some(level => normalizeYearLevel(level) === normalizeYearLevel(rows[0].year_level))
        ));
      });
    });
  }

  return false;
};

exports.getAllTasks = async (req, res) => {
  const sql = `
    SELECT t.id, t.title, t.type, t.due_date, t.recurring, t.instructions, t.source,
           t.created_by, t.created_by_role, u.full_name AS created_by_name,
           t.target_year_levels, t.is_active, t.created_at, t.updated_at
    FROM tasks t
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.is_active = 1
    ORDER BY t.created_at DESC
  `;
  db.query(sql, async (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error fetching tasks' });
    try {
      const visibleTasks = await Promise.all(rows.map(async task => {
        const targetLevels = parseTargetLevels(task.target_year_levels) || [];
        const assignedOfficers = await getAssignedOfficers(targetLevels);
        return {
          task: {
            ...task,
            assigned_officers: assignedOfficers,
            assigned_officer_names: [...new Set(assignedOfficers.map(officer => officer.full_name))],
          },
          visible: await visibleToUser(req, task),
        };
      }));
      res.json(visibleTasks.filter(item => item.visible).map(item => item.task));
    } catch (visibilityError) {
      res.status(500).json({ error: 'Error resolving task visibility', detail: visibilityError.message });
    }
  });
};

exports.getTask = async (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM tasks WHERE id = ? AND is_active = 1', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error fetching task' });
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    visibleToUser(req, rows[0])
      .then(isVisible => {
        if (!isVisible) return res.status(404).json({ error: 'Task not found' });
        res.json(rows[0]);
      })
      .catch(visibilityError => res.status(500).json({ error: 'Error resolving task visibility', detail: visibilityError.message }));
  });
};

exports.exportTaskPdf = async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const { rows = [] } = req.body || {};
    if (!taskId || !Array.isArray(rows)) return res.status(400).json({ error: 'Invalid task export request' });

    db.query(`
      SELECT t.*, u.full_name AS created_by_name
      FROM tasks t LEFT JOIN users u ON u.id = t.created_by
      WHERE t.id = ? AND t.is_active = 1
    `, [taskId], async (err, taskRows) => {
      if (err) return res.status(500).json({ error: 'Error loading task' });
      if (!taskRows.length || !(await visibleToUser(req, taskRows[0]))) return res.status(404).json({ error: 'Task not found' });

      db.query('SELECT full_name FROM users WHERE id = ? LIMIT 1', [req.user.id], async (userErr, users) => {
        if (userErr || !users.length) return res.status(401).json({ error: 'Authenticated account could not be resolved' });
        const task = taskRows[0];
        const targetYearLevels = parseTargetLevels(task.target_year_levels) || [];
        const html = buildTaskComplianceHTML({
          task: {
            ...task,
            dueDate: task.due_date || 'No due date',
            targetYearLevels,
          },
          rows: rows.map(row => ({
            scholar_id: String(row.scholar_id || ''),
            scholar_name: String(row.scholar_name || ''),
            latest_status: String(row.latest_status || ''),
            submission_count: Number(row.submission_count || 0),
            latest_submitted_at: String(row.latest_submitted_at || ''),
            officer_feedback: String(row.officer_feedback || ''),
          })),
          certifiedByName: users[0].full_name,
        });
        const pdf = await generateReportPdf(html);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="task-compliance-${taskId}.pdf"`);
        res.send(pdf);
      });
    });
  } catch (error) {
    console.error('Task PDF export error:', error);
    res.status(500).json({ error: 'Failed to generate task PDF' });
  }
};

exports.createTask = async (req, res) => {
  const { title, type, dueDate, recurring, instructions, source, targetYearLevels: requestedTargetYearLevels } = req.body;
  if (!title || !type) return res.status(400).json({ error: 'Missing required fields: title and type' });

  const createdBy = req.user && req.user.id ? req.user.id : null;
  const createdRole = req.user && req.user.role ? req.user.role : null;
  let targetYearLevels = null;

  if (createdRole === 'officer') {
    targetYearLevels = await getAssignedYearLevels(createdBy);
    if (!targetYearLevels.length) {
      return res.status(400).json({ error: 'You must have assigned year levels before creating a task' });
    }
  }
  if (createdRole === 'admin') {
    const requestedLevels = Array.isArray(requestedTargetYearLevels)
      ? [...new Set(requestedTargetYearLevels.map(String).map(level => level.trim()).filter(Boolean))]
      : [];
    const assignedLevels = await getAllAssignedYearLevels();
    const assignedLevelKeys = new Set(assignedLevels.map(normalizeYearLevel));
    targetYearLevels = requestedLevels.filter(level => assignedLevelKeys.has(normalizeYearLevel(level)));
    if (!targetYearLevels.length) {
      return res.status(400).json({ error: 'Select at least one year level with an assigned officer' });
    }
  }

  const sql = `INSERT INTO tasks (title, type, due_date, recurring, instructions, source, created_by, created_by_role, target_year_levels) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [title, type, dueDate || null, recurring || null, instructions || null, source || 'manual', createdBy, createdRole, targetYearLevels ? JSON.stringify(targetYearLevels) : null], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error creating task', detail: err.message });
    db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId], (qErr, rows) => {
      if (qErr) return res.status(500).json({ error: 'Error fetching created task' });
      res.status(201).json(rows[0]);
    });
  });
};

exports.updateTask = (req, res) => {
  const { id } = req.params;
  const { title, type, dueDate, recurring, instructions, is_active, source, targetYearLevels } = req.body;
  const sql = `UPDATE tasks SET title = ?, type = ?, due_date = ?, recurring = ?, instructions = ?, source = ?, target_year_levels = ?, is_active = ? WHERE id = ?`;
  db.query(sql, [title, type, dueDate || null, recurring || null, instructions || null, source || 'manual', JSON.stringify(Array.isArray(targetYearLevels) ? targetYearLevels : []), is_active === undefined ? 1 : (is_active ? 1 : 0), id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error updating task' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task updated' });
  });
};

exports.deleteTask = (req, res) => {
  const { id } = req.params;
  // Soft-delete
  db.query('UPDATE tasks SET is_active = 0 WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error deleting task' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task removed' });
  });
};

module.exports = exports;
