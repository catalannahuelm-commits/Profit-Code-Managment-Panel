const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const router = express.Router();

function auth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autorizado' });
  next();
}

router.use(auth);

// Upload config
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.session.userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// GET /api/profile
router.get('/', (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, avatar, bio, phone, created_at FROM users WHERE id = ?')
    .get(req.session.userId);
  res.json(user);
});

// PUT /api/profile
router.put('/', (req, res) => {
  const { name, email, bio, phone } = req.body;
  const userId = req.session.userId;

  if (!name || !email) return res.status(400).json({ error: 'Nombre y email son requeridos' });

  // Check email uniqueness
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
  if (existing) return res.status(400).json({ error: 'Ese email ya está en uso' });

  db.prepare('UPDATE users SET name = ?, email = ?, bio = ?, phone = ? WHERE id = ?')
    .run(name, email, bio || null, phone || null, userId);

  req.session.userName = name;
  const user = db.prepare('SELECT id, name, email, role, avatar, bio, phone FROM users WHERE id = ?').get(userId);
  res.json(user);
});

// PUT /api/profile/password
router.put('/password', async (req, res) => {
  const { current, password } = req.body;
  if (!current || !password) return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
  if (password.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);
  const valid = await bcrypt.compare(current, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

  const hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.session.userId);
  res.json({ ok: true });
});

// POST /api/profile/avatar
router.post('/avatar', (req, res) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al subir imagen' });
    if (!req.file) return res.status(400).json({ error: 'No se envió imagen' });

    // Delete old avatar
    const old = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.session.userId);
    if (old?.avatar) {
      const oldPath = path.join(__dirname, '..', '..', 'public', old.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.session.userId);
    res.json({ avatar: avatarUrl });
  });
});

// --- NOTES ---

// GET /api/profile/notes
router.get('/notes', (req, res) => {
  const notes = db.prepare('SELECT * FROM user_notes WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.session.userId);
  res.json(notes);
});

// POST /api/profile/notes
router.post('/notes', (req, res) => {
  const { title, content, color } = req.body;
  const result = db.prepare('INSERT INTO user_notes (user_id, title, content, color) VALUES (?, ?, ?, ?)')
    .run(req.session.userId, title || '', content || '', color || '#7B6CF6');
  const note = db.prepare('SELECT * FROM user_notes WHERE id = ?').get(result.lastInsertRowid);
  res.json(note);
});

// PUT /api/profile/notes/:id
router.put('/notes/:id', (req, res) => {
  const { title, content, color } = req.body;
  const note = db.prepare('SELECT * FROM user_notes WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!note) return res.status(404).json({ error: 'Nota no encontrada' });

  db.prepare('UPDATE user_notes SET title = ?, content = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
    .run(title ?? note.title, content ?? note.content, color ?? note.color, req.params.id, req.session.userId);
  const updated = db.prepare('SELECT * FROM user_notes WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/profile/notes/:id
router.delete('/notes/:id', (req, res) => {
  const result = db.prepare('DELETE FROM user_notes WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.session.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Nota no encontrada' });
  res.json({ ok: true });
});

module.exports = router;
