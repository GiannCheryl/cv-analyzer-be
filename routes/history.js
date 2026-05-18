const express = require("express");
const { db } = require("../db");

const router = express.Router();

const requireAuth = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Akses ditolak. Silakan login terlebih dahulu." });
  }
  const users = await db.all("SELECT id, name, email FROM users WHERE id = ?", [req.session.userId]);
  if (users.length === 0) {
    return res.status(401).json({ error: "User tidak valid." });
  }
  req.user = users[0];
  next();
};

router.get("/", requireAuth, async (req, res) => {
  try {
    const history = await db.all(
      `SELECT id, file_name, job_desc, domain, match_score, match_percentage, 
        auto_summary, skills_analysis, cv_summary, role_compatibility, 
        action_plan, created_at 
      FROM analysis_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC`,
      [req.user.id]
    );

    const parsedHistory = history.map(item => ({
      ...item,
      skills_analysis: item.skills_analysis ? JSON.parse(item.skills_analysis) : null,
      cv_summary: item.cv_summary ? JSON.parse(item.cv_summary) : null,
      role_compatibility: item.role_compatibility ? JSON.parse(item.role_compatibility) : null,
      action_plan: item.action_plan ? JSON.parse(item.action_plan) : null,
    }));

    res.json({ history: parsedHistory });
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ error: "Gagal memuat riwayat analisis." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      file_name, job_desc, domain, match_score, match_percentage,
      auto_summary, skills_analysis, cv_summary, role_compatibility, action_plan,
    } = req.body;

    const result = await db.run(
      `INSERT INTO analysis_history 
        (user_id, file_name, job_desc, domain, match_score, match_percentage, 
         auto_summary, skills_analysis, cv_summary, role_compatibility, action_plan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, file_name, job_desc, domain, match_score, match_percentage,
        auto_summary, JSON.stringify(skills_analysis), JSON.stringify(cv_summary),
        JSON.stringify(role_compatibility), JSON.stringify(action_plan),
      ]
    );

    res.status(201).json({
      message: "Analisis berhasil disimpan ke riwayat",
      historyId: result.lastID,
    });
  } catch (err) {
    console.error("Save history error:", err);
    res.status(500).json({ error: "Gagal menyimpan riwayat analisis." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const items = await db.all(
      "SELECT id FROM analysis_history WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: "Riwayat tidak ditemukan." });
    }

    await db.run("DELETE FROM analysis_history WHERE id = ?", [id]);
    res.json({ message: "Riwayat berhasil dihapus." });
  } catch (err) {
    console.error("Delete history error:", err);
    res.status(500).json({ error: "Gagal menghapus riwayat." });
  }
});

module.exports = router;