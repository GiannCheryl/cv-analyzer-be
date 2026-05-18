const jwt = require("jsonwebtoken");
const { pool } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "your_default_secret_key";

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Akses ditolak. Token tidak ditemukan." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user exists in database
    const [users] = await pool.execute(
      "SELECT id, name, email, created_at FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Token tidak valid. User tidak ditemukan." });
    }

    req.user = users[0];
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token tidak valid." });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token sudah expired. Silakan login kembali." });
    }
    return res.status(500).json({ error: "Terjadi kesalahan autentikasi." });
  }
};

module.exports = { authMiddleware, JWT_SECRET };
