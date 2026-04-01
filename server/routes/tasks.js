const express = require('express');
const db = require('../database');
const { requireAuth, requireOwner } = require('../middleware/auth');
const router = express.Router();

// GET /api/tasks - todas las tareas (owners) o las propias (employees)
router.get('/', requireAuth, (req, res) => {
  let tasks;
  if (req.session.role === 'owner') {
    tasks = db.prepare(`
      SELECT t.*, p.name as project_name, u.name as assigned_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      ORDER BY t.created_at DESC
    `).all();
  } else {
    tasks = db.prepare(`
      SELECT t.*, p.name as project_name, u.name as assigned_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.assigned_to = ?
      ORDER BY t.created_at DESC
    `).all(req.session.userId);
  }
  res.json(tasks);
});

// GET /api/tasks/mine
router.get('/mine', requireAuth, (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, p.name as project_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.assigned_to = ?
    ORDER BY t.priority DESC, t.deadline ASC
  `).all(req.session.userId);
  res.json(tasks);
});

// POST /api/tasks
router.post('/', requireOwner, (req, res) => {
  const { project_id, assigned_to, title, description, priority, deadline } = req.body;
  if (!title || !project_id) return res.status(400).json({ error: 'Título y proyecto son requeridos' });

  const result = db.prepare(
    `INSERT INTO tasks (project_id, assigned_to, title, description, priority, deadline)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(project_id, assigned_to || null, title, description || null, priority || 'medium', deadline || null);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

  // Notificar al asignado
  if (assigned_to) {
    const notify = req.app.get('notify');
    notify(assigned_to, {
      type: 'task_assigned',
      message: `Te asignaron la tarea: ${title}`,
      referenceType: 'task',
      referenceId: task.id
    });
  }

  res.status(201).json(task);
});

// PUT /api/tasks/:id
router.put('/:id', requireAuth, (req, res) => {
  const { status, title, description, assigned_to, priority, deadline } = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

  // Employees solo pueden cambiar el status de sus propias tareas
  if (req.session.role !== 'owner' && task.assigned_to !== req.session.userId) {
    return res.status(403).json({ error: 'No podés modificar esta tarea' });
  }

  db.prepare(
    `UPDATE tasks SET status = COALESCE(?, status), title = COALESCE(?, title),
     description = COALESCE(?, description), assigned_to = COALESCE(?, assigned_to),
     priority = COALESCE(?, priority), deadline = COALESCE(?, deadline),
     updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(status, title, description, assigned_to, priority, deadline, req.params.id);

  // Notificar si la tarea se completó
  if (status === 'done' && task.status !== 'done') {
    const notifyOwners = req.app.get('notifyOwners');
    notifyOwners({
      type: 'task_completed',
      message: `Tarea completada: ${task.title}`,
      referenceType: 'task',
      referenceId: task.id
    });
  }

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// GET /api/tasks/:id/comments
router.get('/:id/comments', requireAuth, (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name
    FROM task_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'El comentario no puede estar vacío' });

  const result = db.prepare(
    'INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)'
  ).run(req.params.id, req.session.userId, content);

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name
    FROM task_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(comment);
});

module.exports = router;
