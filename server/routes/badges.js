const express = require('express');
const db = require('../database');
const router = express.Router();

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autorizado' });
  next();
}

router.use(auth);

// Badge definitions
const AUTO_BADGES = [
  { key: 'first_task', title: 'Primera Tarea', desc: 'Completaste tu primera tarea', icon: '🎯', color: '#7B6CF6', tier: 'bronze' },
  { key: 'task_5', title: 'Productivo', desc: 'Completaste 5 tareas', icon: '⚡', color: '#F5A623', tier: 'bronze' },
  { key: 'task_10', title: 'Máquina', desc: 'Completaste 10 tareas', icon: '🔥', color: '#E74C3C', tier: 'silver' },
  { key: 'task_25', title: 'Imparable', desc: 'Completaste 25 tareas', icon: '💎', color: '#00CEC9', tier: 'gold' },
  { key: 'first_client', title: 'Primer Cliente', desc: 'Agregaste tu primer cliente', icon: '🤝', color: '#1DB954', tier: 'bronze' },
  { key: 'clients_5', title: 'Networker', desc: 'Tenés 5 clientes en cartera', icon: '🌐', color: '#4A90D9', tier: 'silver' },
  { key: 'clients_10', title: 'Magnate', desc: '10 clientes en cartera', icon: '👑', color: '#F5A623', tier: 'gold' },
  { key: 'first_invoice', title: 'Primer Cobro', desc: 'Cobraste tu primera factura', icon: '💰', color: '#1DB954', tier: 'bronze' },
  { key: 'revenue_50k', title: 'Medio Camino', desc: 'Facturaste $50.000', icon: '📈', color: '#7B6CF6', tier: 'silver' },
  { key: 'revenue_100k', title: '100K Club', desc: 'Facturaste $100.000', icon: '🏆', color: '#F5A623', tier: 'gold' },
  { key: 'first_project', title: 'Primer Proyecto', desc: 'Creaste tu primer proyecto', icon: '📁', color: '#4A90D9', tier: 'bronze' },
  { key: 'projects_5', title: 'Constructor', desc: '5 proyectos creados', icon: '🏗️', color: '#E84393', tier: 'silver' },
  { key: 'early_bird', title: 'Madrugador', desc: 'Miembro desde el primer mes', icon: '🌅', color: '#F5A623', tier: 'gold' },
  { key: 'team_player', title: 'Jugador de Equipo', desc: 'Asignaste tareas a otros', icon: '🤜', color: '#00CEC9', tier: 'bronze' },
];

// GET /api/badges/catalog
router.get('/catalog', (req, res) => {
  res.json(AUTO_BADGES);
});

// GET /api/badges/user (current user)
router.get('/user', (req, res) => {
  const userId = req.session.userId;

  return getBadgesForUser(userId, res);
});

// GET /api/badges/user/:id
router.get('/user/:id', (req, res) => {
  const userId = req.params.id;

  return getBadgesForUser(userId, res);
});

function getBadgesForUser(userId, res) {

  const autoBadges = db.prepare('SELECT badge_key, unlocked_at FROM user_badges WHERE user_id = ?').all(userId);
  const manualBadges = db.prepare(`
    SELECT mb.*, u.name as given_by_name
    FROM manual_badges mb
    JOIN users u ON u.id = mb.given_by
    WHERE mb.user_id = ?
    ORDER BY mb.created_at DESC
  `).all(userId);

  // Enrich auto badges with catalog info
  const unlocked = autoBadges.map(b => {
    const def = AUTO_BADGES.find(d => d.key === b.badge_key);
    return def ? { ...def, unlocked_at: b.unlocked_at, type: 'auto' } : null;
  }).filter(Boolean);

  const manual = manualBadges.map(b => ({
    id: b.id,
    title: b.title,
    icon: b.icon,
    color: b.color,
    reason: b.reason,
    given_by_name: b.given_by_name,
    created_at: b.created_at,
    type: 'manual'
  }));

  res.json({ unlocked, manual, catalog: AUTO_BADGES });
}

// POST /api/badges/check - recalculate badges for current user
router.post('/check', (req, res) => {
  const userId = req.session.userId;
  const newBadges = [];

  // Tasks completed
  const tasksDone = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE assigned_to = ? AND status = ?').get(userId, 'done')?.c || 0;
  if (tasksDone >= 1) tryUnlock(userId, 'first_task', newBadges);
  if (tasksDone >= 5) tryUnlock(userId, 'task_5', newBadges);
  if (tasksDone >= 10) tryUnlock(userId, 'task_10', newBadges);
  if (tasksDone >= 25) tryUnlock(userId, 'task_25', newBadges);

  // Clients
  const clientCount = db.prepare('SELECT COUNT(*) as c FROM clients').get()?.c || 0;
  if (clientCount >= 1) tryUnlock(userId, 'first_client', newBadges);
  if (clientCount >= 5) tryUnlock(userId, 'clients_5', newBadges);
  if (clientCount >= 10) tryUnlock(userId, 'clients_10', newBadges);

  // Invoices paid
  const paidCount = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE status = ?').get('paid')?.c || 0;
  if (paidCount >= 1) tryUnlock(userId, 'first_invoice', newBadges);

  // Revenue
  const revenue = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = ?').get('paid')?.total || 0;
  if (revenue >= 50000) tryUnlock(userId, 'revenue_50k', newBadges);
  if (revenue >= 100000) tryUnlock(userId, 'revenue_100k', newBadges);

  // Projects
  const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get()?.c || 0;
  if (projectCount >= 1) tryUnlock(userId, 'first_project', newBadges);
  if (projectCount >= 5) tryUnlock(userId, 'projects_5', newBadges);

  // Team player - assigned tasks to others
  const assigned = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE assigned_to IS NOT NULL AND assigned_to != ?').get(userId)?.c || 0;
  if (assigned >= 1) tryUnlock(userId, 'team_player', newBadges);

  // Early bird
  const user = db.prepare('SELECT created_at FROM users WHERE id = ?').get(userId);
  if (user) {
    const created = new Date(user.created_at);
    const now = new Date();
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) tryUnlock(userId, 'early_bird', newBadges);
  }

  res.json({ new: newBadges, total: newBadges.length });
});

function tryUnlock(userId, badgeKey, newBadges) {
  const exists = db.prepare('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_key = ?').get(userId, badgeKey);
  if (!exists) {
    db.prepare('INSERT INTO user_badges (user_id, badge_key) VALUES (?, ?)').run(userId, badgeKey);
    const def = AUTO_BADGES.find(b => b.key === badgeKey);
    if (def) newBadges.push(def);
  }
}

// POST /api/badges/give - owner gives manual badge
router.post('/give', (req, res) => {
  if (req.session.role !== 'owner') return res.status(403).json({ error: 'Solo dueños pueden dar insignias' });

  const { user_id, title, icon, color, reason } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: 'Usuario y título son requeridos' });

  const result = db.prepare('INSERT INTO manual_badges (user_id, given_by, title, icon, color, reason) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user_id, req.session.userId, title, icon || '⭐', color || '#F5A623', reason || null);

  const badge = db.prepare('SELECT mb.*, u.name as given_by_name FROM manual_badges mb JOIN users u ON u.id = mb.given_by WHERE mb.id = ?')
    .get(result.lastInsertRowid);
  res.json(badge);
});

// DELETE /api/badges/manual/:id
router.delete('/manual/:id', (req, res) => {
  if (req.session.role !== 'owner') return res.status(403).json({ error: 'Solo dueños pueden eliminar insignias' });
  db.prepare('DELETE FROM manual_badges WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
