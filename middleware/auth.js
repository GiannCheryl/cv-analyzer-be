const jwt = require('jsonwebtoken');

// Hardcode secret untuk demo/skripsi
const SECRET = process.env.SESSION_SECRET || "cv-analyzer-secret-key-gianina-2024-skripsi-minimal-32-chars";

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid atau sudah expired.' });
  }
}

module.exports = authenticate;