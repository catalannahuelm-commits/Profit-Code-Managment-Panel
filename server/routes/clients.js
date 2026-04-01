const express = require('express');
const db = require('../database');
const { requireAuth, requireOwner } = require('../middleware/auth');
const router = express.Router();

// GET /api/clients
router.get('/', requireAuth, (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY updated_at DESC').all();
  res.json(clients);
});

// GET /api/clients/:id
router.get('/:id', requireAuth, (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(client);
});

// POST /api/clients
router.post('/', requireOwner, (req, res) => {
  const { name, company, email, phone, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

  const result = db.prepare(
    `INSERT INTO clients (name, company, email, phone, notes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(name, company || null, email || null, phone || null, notes || null);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);

  // Notificar a owners
  const notifyOwners = req.app.get('notifyOwners');
  notifyOwners({
    type: 'new_client',
    message: `Nuevo cliente: ${name}`,
    referenceType: 'client',
    referenceId: client.id
  });

  res.status(201).json(client);
});

// PUT /api/clients/:id
router.put('/:id', requireOwner, (req, res) => {
  const { name, company, email, phone, pipeline_stage, notes } = req.body;

  db.prepare(
    `UPDATE clients SET name = COALESCE(?, name), company = COALESCE(?, company),
     email = COALESCE(?, email), phone = COALESCE(?, phone),
     pipeline_stage = COALESCE(?, pipeline_stage), notes = COALESCE(?, notes),
     updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(name, company, email, phone, pipeline_stage, notes, req.params.id);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  res.json(client);
});

// DELETE /api/clients/:id
router.delete('/:id', requireOwner, (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
