const express = require('express');
const db = require('../database');
const { requireAuth, requireOwner } = require('../middleware/auth');
const router = express.Router();

// GET /api/projects
router.get('/', requireAuth, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, c.name as client_name
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

// GET /api/projects/:id
router.get('/:id', requireAuth, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, c.name as client_name
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
  res.json(project);
});

// POST /api/projects
router.post('/', requireOwner, (req, res) => {
  const { client_id, name, description, budget, deadline } = req.body;
  if (!name || !client_id) return res.status(400).json({ error: 'Nombre y cliente son requeridos' });

  const result = db.prepare(
    `INSERT INTO projects (client_id, name, description, budget, start_date, deadline)
     VALUES (?, ?, ?, ?, DATE('now'), ?)`
  ).run(client_id, name, description || null, budget || 0, deadline || null);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);

  const notifyOwners = req.app.get('notifyOwners');
  notifyOwners({
    type: 'new_project',
    message: `Nuevo proyecto: ${name}`,
    referenceType: 'project',
    referenceId: project.id
  });

  res.status(201).json(project);
});

// PUT /api/projects/:id
router.put('/:id', requireOwner, (req, res) => {
  const { name, description, budget, cost, status, deadline } = req.body;

  db.prepare(
    `UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description),
     budget = COALESCE(?, budget), cost = COALESCE(?, cost),
     status = COALESCE(?, status), deadline = COALESCE(?, deadline)
     WHERE id = ?`
  ).run(name, description, budget, cost, status, deadline, req.params.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  res.json(project);
});

module.exports = router;
