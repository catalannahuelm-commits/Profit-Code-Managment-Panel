const express = require('express');
const db = require('../database');
const { requireOwner } = require('../middleware/auth');
const router = express.Router();

// GET /api/team/workload
router.get('/workload', requireOwner, (req, res) => {
  const workload = db.prepare(`
    SELECT
      u.id,
      u.name,
      u.role,
      COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress,
      COUNT(CASE WHEN t.status = 'done' THEN 1 END) as done,
      COUNT(t.id) as total
    FROM users u
    LEFT JOIN tasks t ON t.assigned_to = u.id
    GROUP BY u.id
    ORDER BY u.name
  `).all();

  res.json(workload);
});

module.exports = router;
