const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../db");
const authenticate = require("../middleware/auth");

const router = express.Router();

function generateToken(userId) {
  const SECRET = process.env.SESSION_SECRET || "cv-analyzer-secret-key-gianina-2024-skripsi-minimal-32-chars";
  return jwt.sign({ userId }, SECRET, { expiresIn: '7d' });
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    console.log("📝 Register attempt:", { name, email });

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nama, email, dan password wajib diisi." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password minimal 6 karakter." });
    }

    const existingUsers = await db.all("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "Email sudah terdaftar. Silakan login." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("🔑 Password hashed:", hashedPassword.substring(0, 20) + "...");

    const result = await db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    console.log("✅ User inserted, ID:", result.lastID);

    // FIX: Jangan kirim token! User harus login manual
    res.status(201).json({
      message: "Registrasi berhasil! Silakan login.",
      user: { id: result.lastID, name, email },
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat registrasi.", detail: err.message });
  }
});

// LOGIN — FIX: Debug logging
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log("🔐 Login attempt:", email);

    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi." });
    }

    const users = await db.all("SELECT id, name, email, password FROM users WHERE email = ?", [email]);
    console.log("📊 Users found:", users.length);

    if (users.length === 0) {
      return res.status(401).json({ error: "Email atau password salah." });
    }

    const user = users[0];
    console.log("👤 User found:", { id: user.id, email: user.email });
    console.log("🔑 Stored hash:", user.password.substring(0, 20) + "...");

    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log("✅ Password valid:", isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Email atau password salah." });
    }

    const token = generateToken(user.id);
    res.json({
      message: "Login berhasil!",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat login.", detail: err.message });
  }
});

// GET CURRENT USER (protected)
router.get("/me", authenticate, async (req, res) => {
  try {
    const users = await db.all("SELECT id, name, email, created_at FROM users WHERE id = ?", [req.userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: "User tidak ditemukan." });
    }
    res.json({ user: users[0] });
  } catch (err) {
    res.status(500).json({ error: "Terjadi kesalahan." });
  }
});

// LOGOUT
router.post("/logout", (req, res) => {
  res.json({ message: "Logout berhasil." });
});

// DEBUG: Cek semua user (HAPUS setelah fix!)
router.get("/debug/users", async (req, res) => {
  try {
    const users = await db.all("SELECT id, name, email, password, created_at FROM users");
    const maskedUsers = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      password_length: u.password ? u.password.length : 0,
      is_hashed: u.password && u.password.startsWith("$2") ? "✅ YES" : "❌ NO",
      created_at: u.created_at
    }));
    res.json({ users: maskedUsers, count: users.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;