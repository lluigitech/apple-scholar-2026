const db = require('../config/db');

exports.getAllTasks = (req, res) => {
  const sql = `SELECT id, title, type, due_date, recurring, instructions, source, created_by, created_by_role, is_active, created_at, updated_at FROM tasks WHERE is_active = 1 ORDER BY created_at DESC`;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error fetching tasks' });
    res.json(rows);
  });
};

exports.getTask = (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM tasks WHERE id = ? AND is_active = 1', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error fetching task' });
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  });
};

exports.createTask = (req, res) => {
  const { title, type, dueDate, recurring, instructions, source } = req.body;
  if (!title || !type) return res.status(400).json({ error: 'Missing required fields: title and type' });

  const createdBy = req.user && req.user.id ? req.user.id : null;
  const createdRole = req.user && req.user.role ? req.user.role : null;

  const sql = `INSERT INTO tasks (title, type, due_date, recurring, instructions, source, created_by, created_by_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [title, type, dueDate || null, recurring || null, instructions || null, source || 'manual', createdBy, createdRole], (err, result) => {
    if (err) return res.status(500).json({ error: 'Error creating task', detail: err.message });
    db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId], (qErr, rows) => {
      if (qErr) return res.status(500).json({ error: 'Error fetching created task' });
      res.status(201).json(rows[0]);
    });
  });
};

exports.updateTask = (req, res) => {
  const { id } = req.params;
  const { title, type, dueDate, recurring, instructions, is_active } = req.body;
  const sql = `UPDATE tasks SET title = ?, type = ?, due_date = ?, recurring = ?, instructions = ?, is_active = ? WHERE id = ?`;
  db.query(sql, [title, type, dueDate || null, recurring || null, instructions || null, is_active === undefined ? 1 : (is_active ? 1 : 0), id], (err, result) => {
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
