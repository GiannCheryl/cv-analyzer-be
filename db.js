const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ✅ FIX: Gunakan path absolut atau dari environment variable
const dbDir = process.env.DATABASE_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'database.sqlite');
console.log("📁 Database path:", dbPath);  // Debug log

const db = new Database(dbPath);

// Mode WAL untuk performa lebih baik
db.pragma('journal_mode = WAL');

// Wrapper dengan Promise supaya cocok dengan app.js kamu
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(params);
      resolve({ lastID: result.lastInsertRowid, changes: result.changes });
    } catch (err) {
      reject(err);
    }
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(params);
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(params);
      resolve(row || null);
    } catch (err) {
      reject(err);
    }
  });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS analysis_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          file_name TEXT NOT NULL,
          job_desc TEXT NOT NULL,
          domain TEXT NOT NULL,
          match_score REAL NOT NULL,
          match_percentage INTEGER NOT NULL,
          auto_summary TEXT,
          skills_analysis TEXT,
          cv_summary TEXT,
          role_compatibility TEXT,
          action_plan TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      console.log("✅ Database initialized at:", dbPath);
      resolve();
    } catch (err) {
      console.error("❌ Database error:", err.message);
      reject(err);
    }
  });
}

module.exports = { db: { run, all, get }, initDatabase };