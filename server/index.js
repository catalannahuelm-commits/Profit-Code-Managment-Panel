require('dotenv').config();
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Inicializar base de datos (crea tablas al importar)
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
});
app.use(sessionMiddleware);

// Compartir sesión con Socket.io
io.engine.use(sessionMiddleware);

// Archivos estáticos
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/team', require('./routes/team'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/badges', require('./routes/badges'));

// Setup Socket.io
const { notify, notifyOwners } = require('./sockets/notifications')(io);

// Ruta de notificaciones
app.get('/api/notifications', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'No autorizado' });
  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.session.userId);
  res.json(notifications);
});

// Hacer notify disponible en las rutas
app.set('notify', notify);
app.set('notifyOwners', notifyOwners);

// SPA fallback - cualquier ruta que no sea API devuelve index.html
app.get('{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Profit Code corriendo en http://localhost:${PORT}`);
});
