const db = require('../database');

function setupSockets(io) {
  // Mapa de userId -> socketId para saber quién está conectado
  const connectedUsers = new Map();

  // Middleware: validar session antes de conectar
  io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.userId) {
      next();
    } else {
      next(new Error('No autorizado'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.request.session.userId;

    connectedUsers.set(userId, socket.id);
    console.log(`Usuario ${userId} conectado`);

    socket.on('disconnect', () => {
      if (userId) {
        connectedUsers.delete(userId);
        console.log(`Usuario ${userId} desconectado`);
      }
    });

    // Marcar notificación como leída
    socket.on('notification:read', (notificationId) => {
      db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
        .run(notificationId, userId);
    });

    // Marcar todas como leídas
    socket.on('notifications:read-all', () => {
      db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?')
        .run(userId);
    });
  });

  // Función para enviar notificación a un usuario específico
  function notify(userId, notification) {
    // Guardar en la DB
    const result = db.prepare(
      `INSERT INTO notifications (user_id, type, message, reference_type, reference_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId, notification.type, notification.message,
          notification.referenceType || null, notification.referenceId || null);

    // Enviar en tiempo real si está conectado
    const socketId = connectedUsers.get(userId);
    if (socketId) {
      io.to(socketId).emit('notification', {
        id: result.lastInsertRowid,
        ...notification,
        read: 0,
        created_at: new Date().toISOString()
      });
    }
  }

  // Notificar a todos los owners
  function notifyOwners(notification) {
    const owners = db.prepare("SELECT id FROM users WHERE role = 'owner'").all();
    owners.forEach(owner => notify(owner.id, notification));
  }

  return { notify, notifyOwners, connectedUsers };
}

module.exports = setupSockets;
