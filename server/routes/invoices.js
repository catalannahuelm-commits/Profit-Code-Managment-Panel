const express = require('express');
const db = require('../database');
const { requireOwner } = require('../middleware/auth');
const router = express.Router();

// GET /api/invoices
router.get('/', requireOwner, (req, res) => {
  const invoices = db.prepare(`
    SELECT i.*, c.name as client_name, p.name as project_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN projects p ON i.project_id = p.id
    ORDER BY i.created_at DESC
  `).all();
  res.json(invoices);
});

// POST /api/invoices
router.post('/', requireOwner, (req, res) => {
  const { project_id, amount, due_date, description } = req.body;
  if (!project_id || !amount) return res.status(400).json({ error: 'Proyecto y monto son requeridos' });

  // Obtener client_id del proyecto
  const project = db.prepare('SELECT client_id FROM projects WHERE id = ?').get(project_id);
  if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const result = db.prepare(
    `INSERT INTO invoices (project_id, client_id, amount, due_date, description)
     VALUES (?, ?, ?, ?, ?)`
  ).run(project_id, project.client_id, amount, due_date || null, description || null);

  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, p.name as project_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN projects p ON i.project_id = p.id
    WHERE i.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(invoice);
});

// PUT /api/invoices/:id
router.put('/:id', requireOwner, (req, res) => {
  const { status, paid_date } = req.body;

  if (status === 'paid') {
    db.prepare(
      `UPDATE invoices SET status = 'paid', paid_date = COALESCE(?, DATE('now')) WHERE id = ?`
    ).run(paid_date, req.params.id);

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    const notifyOwners = req.app.get('notifyOwners');
    notifyOwners({
      type: 'payment_received',
      message: `Pago recibido: $${invoice.amount}`,
      referenceType: 'invoice',
      referenceId: invoice.id
    });
  } else {
    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, req.params.id);
  }

  const invoice = db.prepare(`
    SELECT i.*, c.name as client_name, p.name as project_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN projects p ON i.project_id = p.id
    WHERE i.id = ?
  `).get(req.params.id);

  res.json(invoice);
});

// GET /api/expenses
router.get('/expenses', requireOwner, (req, res) => {
  const expenses = db.prepare(`
    SELECT e.*, p.name as project_name
    FROM expenses e
    LEFT JOIN projects p ON e.project_id = p.id
    ORDER BY e.date DESC
  `).all();
  res.json(expenses);
});

// POST /api/expenses
router.post('/expenses', requireOwner, (req, res) => {
  const { project_id, description, amount, category, date } = req.body;
  if (!description || !amount) return res.status(400).json({ error: 'Descripción y monto son requeridos' });

  const result = db.prepare(
    `INSERT INTO expenses (project_id, description, amount, category, date)
     VALUES (?, ?, ?, ?, ?)`
  ).run(project_id || null, description, amount, category || 'other', date || new Date().toISOString().split('T')[0]);

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(expense);
});

module.exports = router;
