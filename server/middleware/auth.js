function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

function requireOwner(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  if (req.session.role !== 'owner') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

module.exports = { requireAuth, requireOwner };
