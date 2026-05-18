const mysql = require("mysql2/promise");
require("dotenv").config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cv_analyzer_db",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// Initialize database tables
async function initDatabase() {
  try {
    const connection = await pool.getConnection();

    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Analysis history table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        job_desc TEXT NOT NULL,
        domain VARCHAR(100) NOT NULL,
        match_score DECIMAL(5,2) NOT NULL,
        match_percentage INT NOT NULL,
        auto_summary TEXT,
        skills_analysis JSON,
        cv_summary JSON,
        role_compatibility JSON,
        action_plan JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log("Database tables initialized successfully");
    connection.release();
  } catch (err) {
    console.error("Database initialization error:", err.message);
    console.log("");
    console.log("Pastikan XAMPP MySQL sudah berjalan!");
    console.log("1. Buka XAMPP Control Panel");
    console.log("2. Klik Start pada module MySQL");
    console.log("3. Buat database cv_analyzer_db di phpMyAdmin");
    process.exit(1);
  }
}

module.exports = { pool, initDatabase };
