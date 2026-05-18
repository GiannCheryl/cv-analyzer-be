const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  console.log('=== AUTH DEBUG ===');
  console.log('Auth header:', authHeader ? 'ADA' : 'TIDAK ADA');
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Token length:', token?.length);
  console.log('Token first 30 chars:', token?.substring(0, 30));

  try {
    console.log('SESSION_SECRET exists:', !!process.env.SESSION_SECRET);
    console.log('SESSION_SECRET length:', process.env.SESSION_SECRET?.length);
    console.log('SESSION_SECRET first 20 chars:', process.env.SESSION_SECRET?.substring(0, 20));
    
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);
    console.log('✅ VERIFY SUCCESS! userId:', decoded.userId);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('❌ VERIFY FAILED:', err.message);
    console.error('❌ Error name:', err.name);
    console.error('❌ Token received:', token?.substring(0, 50));
    return res.status(401).json({ error: 'Token invalid atau sudah expired.' });
  }
}

module.exports = authenticate;