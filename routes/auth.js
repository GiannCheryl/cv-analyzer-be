const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../db");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
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
    const result = await db.run(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );

    req.session.userId = result.lastID;
    res.status(201).json({
      message: "Registrasi berhasil!",
      user: { id: result.lastID, name, email },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat registrasi." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email dan password wajib diisi." });
    }

    const users = await db.all("SELECT id, name, email, password FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: "Email atau password salah." });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Email atau password salah." });
    }

    req.session.userId = user.id;
    res.json({
      message: "Login berhasil!",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat login." });
  }
});

router.get("/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Belum login." });
    }
    const users = await db.all("SELECT id, name, email, created_at FROM users WHERE id = ?", [req.session.userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: "User tidak ditemukan." });
    }
    res.json({ user: users[0] });
  } catch (err) {
    res.status(500).json({ error: "Terjadi kesalahan." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Gagal logout." });
    }
    res.json({ message: "Logout berhasil." });
  });
});

module.exports = router;