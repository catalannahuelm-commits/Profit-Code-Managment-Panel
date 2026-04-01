const express = require('express');
const db = require('../database');
const { requireOwner } = require('../middleware/auth');
const router = express.Router();

// GET /api/dashboard
router.get('/', requireOwner, (req, res) => {
  // Ingresos del mes (facturas pagadas)
  const monthIncome = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM invoices
    WHERE status = 'paid'
    AND strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now')
  `).get();

  // Gastos del mes
  const monthExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
  `).get();

  // Proyectos activos
  const activeProjects = db.prepare(`
    SELECT COUNT(*) as count FROM projects WHERE status = 'active'
  `).get();

  // Pipeline
  const pipeline = db.prepare(`
    SELECT pipeline_stage, COUNT(*) as count
    FROM clients
    GROUP BY pipeline_stage
  `).all();

  // Ingresos y gastos últimos 6 meses
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', paid_date) as month, SUM(amount) as total
    FROM invoices
    WHERE status = 'paid'
    AND paid_date >= DATE('now', '-6 months')
    GROUP BY month
    ORDER BY month
  `).all();

  const monthlyExpenses = db.prepare(`
    SELECT strftime('%Y-%m', date) as month, SUM(amount) as total
    FROM expenses
    WHERE date >= DATE('now', '-6 months')
    GROUP BY month
    ORDER BY month
  `).all();

  // Facturas pendientes/vencidas
  const pendingInvoices = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM invoices
    WHERE status IN ('pending', 'sent', 'overdue')
  `).get();

  res.json({
    income: monthIncome.total,
    expenses: monthExpenses.total,
    profit: monthIncome.total - monthExpenses.total,
    activeProjects: activeProjects.count,
    pipeline: pipeline,
    monthlyRevenue,
    monthlyExpenses,
    pendingInvoices: pendingInvoices.total
  });
});

// GET /api/dashboard/weekly-summary (para n8n)
router.get('/weekly-summary', requireOwner, (req, res) => {
  const weekIncome = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM invoices WHERE status = 'paid'
    AND paid_date >= DATE('now', '-7 days')
  `).get();

  const tasksCompleted = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE status = 'done'
    AND updated_at >= DATE('now', '-7 days')
  `).get();

  const newClients = db.prepare(`
    SELECT COUNT(*) as count FROM clients
    WHERE created_at >= DATE('now', '-7 days')
  `).get();

  res.json({
    weekIncome: weekIncome.total,
    tasksCompleted: tasksCompleted.count,
    newClients: newClients.count
  });
});

module.exports = router;
