const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../database');
const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.userName = user.name;

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// GET /api/auth/me - usuario actual
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(req.session.userId);

  res.json(user);
});

module.exports = router;
