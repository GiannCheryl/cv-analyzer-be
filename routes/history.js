const express = require("express");
const { pool } = require("../db");

const router = express.Router();

// Session auth middleware (inline)
const requireAuth = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Akses ditolak. Silakan login terlebih dahulu." });
  }

  // Get user info and attach to req
  const [users] = await pool.execute(
    "SELECT id, name, email FROM users WHERE id = ?",
    [req.session.userId]
  );

  if (users.length === 0) {
    return res.status(401).json({ error: "User tidak valid." });
  }

  req.user = users[0];
  next();
};

// Get all history for logged in user
router.get("/", requireAuth, async (req, res) => {
  try {
    const [history] = await pool.execute(
      `SELECT 
        id, file_name, job_desc, domain, match_score, match_percentage, 
        auto_summary, skills_analysis, cv_summary, role_compatibility, 
        action_plan, created_at 
      FROM analysis_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Parse JSON fields
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

// Save new analysis to history
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      file_name,
      job_desc,
      domain,
      match_score,
      match_percentage,
      auto_summary,
      skills_analysis,
      cv_summary,
      role_compatibility,
      action_plan,
    } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO analysis_history 
        (user_id, file_name, job_desc, domain, match_score, match_percentage, 
         auto_summary, skills_analysis, cv_summary, role_compatibility, action_plan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        file_name,
        job_desc,
        domain,
        match_score,
        match_percentage,
        auto_summary,
        JSON.stringify(skills_analysis),
        JSON.stringify(cv_summary),
        JSON.stringify(role_compatibility),
        JSON.stringify(action_plan),
      ]
    );

    res.status(201).json({
      message: "Analisis berhasil disimpan ke riwayat",
      historyId: result.insertId,
    });
  } catch (err) {
    console.error("Save history error:", err);
    res.status(500).json({ error: "Gagal menyimpan riwayat analisis." });
  }
});

// Delete history item
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const [items] = await pool.execute(
      "SELECT id FROM analysis_history WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: "Riwayat tidak ditemukan." });
    }

    await pool.execute(
      "DELETE FROM analysis_history WHERE id = ?",
      [id]
    );

    res.json({ message: "Riwayat berhasil dihapus." });
  } catch (err) {
    console.error("Delete history error:", err);
    res.status(500).json({ error: "Gagal menghapus riwayat." });
  }
});

module.exports = router;
