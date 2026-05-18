process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
});

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const session = require("express-session");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { initDatabase } = require("./db");
const authRoutes = require("./routes/auth");
const historyRoutes = require("./routes/history");

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || "cv-analyzer-secret-key-change-this",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set true if using HTTPS
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Setup upload directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file PDF, DOC, atau DOCX yang diizinkan"));
    }
  },
});

// --------------------------------------------------
// Helper Functions
// --------------------------------------------------

async function extractPdfText(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(fileBuffer);
  return pdfData.text || "";
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

async function extractDocText(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || "";
  } catch (error) {
    throw new Error("Gagal membaca file DOC. Silakan convert ke DOCX atau PDF.");
  }
}

async function extractTextFromFile(filePath, mimetype) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return await extractPdfText(filePath);
  else if (ext === ".docx") return await extractDocxText(filePath);
  else if (ext === ".doc") return await extractDocText(filePath);
  throw new Error("Format file tidak didukung");
}

function arrayIntersectCaseInsensitive(a = [], b = []) {
  const lowerB = b.map((x) => ("" + x).toLowerCase().trim());
  return (a || []).filter((x) => lowerB.includes(("" + x).toLowerCase().trim()));
}

function calculateMatchScore(matched, total) {
  if (!total || total === 0) return 0;
  return Math.min(1, matched / total);
}

// --------------------------------------------------
// Domain Keywords
// --------------------------------------------------
const DOMAIN_KEYWORDS = {
  IT: {
    keywords: ["programming","coding","software","developer","engineer","javascript","python","java","react","node","database","cloud","devops","frontend","backend","fullstack","api","web","mobile","app"],
    hardSkills: ["JavaScript","Python","Java","React","Node.js","SQL","Git","AWS","Docker","Kubernetes"],
    softSkills: ["Problem Solving","Debugging","Team Collaboration","Agile","Communication"],
  },
  MARKETING: {
    keywords: ["marketing","brand","campaign","digital","social media","seo","content","advertising","market research","customer","sales","promotion","analytics","engagement"],
    hardSkills: ["SEO","Google Analytics","Social Media Marketing","Content Creation","Email Marketing","Copywriting","Adobe Creative Suite","CRM","Market Research"],
    softSkills: ["Creativity","Communication","Strategic Thinking","Analytical Skills","Adaptability"],
  },
  DESIGN: {
    keywords: ["design","graphic","ui","ux","visual","creative","illustration","branding","portfolio","art","layout","typography","color","prototype"],
    hardSkills: ["Figma","Adobe Photoshop","Adobe Illustrator","Sketch","UI/UX Design","Prototyping","Wireframing","Design Systems","Typography"],
    softSkills: ["Creativity","Attention to Detail","Communication","Time Management","Client Relations"],
  },
  ACCOUNTING_FINANCE: {
    keywords: ["accounting","finance","financial","audit","tax","bookkeeping","budget","reporting","analysis","banking","investment","excel","spreadsheet"],
    hardSkills: ["Financial Reporting","Excel","Accounting Software","Tax Preparation","Budgeting","Financial Analysis","QuickBooks","SAP","Auditing"],
    softSkills: ["Attention to Detail","Analytical Thinking","Integrity","Organization","Communication"],
  },
  EDUCATION: {
    keywords: ["teacher","education","teaching","instructor","professor","lecturer","curriculum","student","learning","academic","school","university","training","tutor"],
    hardSkills: ["Curriculum Development","Lesson Planning","Classroom Management","Assessment Design","Educational Technology","Subject Matter Expertise","Online Teaching"],
    softSkills: ["Communication","Patience","Leadership","Empathy","Organization","Adaptability"],
  },
  HEALTHCARE: {
    keywords: ["medical","healthcare","nurse","doctor","patient","clinical","hospital","pharmacy","therapy","treatment","diagnosis","care"],
    hardSkills: ["Patient Care","Medical Records","Clinical Procedures","EMR Systems","Medical Terminology","CPR","First Aid"],
    softSkills: ["Empathy","Communication","Attention to Detail","Stress Management","Teamwork"],
  },
  ENGINEERING: {
    keywords: ["engineering","engineer","mechanical","electrical","civil","structural","design","cad","manufacturing","construction","technical","blueprint"],
    hardSkills: ["AutoCAD","SolidWorks","Technical Drawing","Project Management","Quality Control","MATLAB","3D Modeling"],
    softSkills: ["Problem Solving","Analytical Thinking","Teamwork","Project Management","Communication"],
  },
  BUSINESS: {
    keywords: ["business","management","administration","operations","strategy","leadership","project","planning","coordination","office","executive","admin"],
    hardSkills: ["Project Management","Microsoft Office","Data Analysis","Strategic Planning","Budget Management","CRM","ERP Systems"],
    softSkills: ["Leadership","Communication","Decision Making","Problem Solving","Time Management","Negotiation"],
  },
  HR: {
    keywords: ["hr","human resources","recruitment","hiring","talent","employee","payroll","benefits","training","development","onboarding"],
    hardSkills: ["Recruitment","HRIS","Payroll Management","Labor Law","Performance Management","Training Development","ATS"],
    softSkills: ["Communication","Empathy","Conflict Resolution","Discretion","Interpersonal Skills"],
  },
  LEGAL: {
    keywords: ["legal","law","attorney","lawyer","paralegal","contract","litigation","compliance","regulatory","counsel"],
    hardSkills: ["Legal Research","Contract Drafting","Case Management","Compliance","Legal Writing","Litigation Support"],
    softSkills: ["Analytical Thinking","Attention to Detail","Communication","Negotiation","Ethics"],
  },
};

function detectJobDomain(jdText) {
  const text = jdText.toLowerCase();
  const scores = {};
  for (const [domain, data] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const keyword of data.keywords) {
      if (text.includes(keyword.toLowerCase())) score++;
    }
    scores[domain] = score;
  }
  let maxScore = 0;
  let detectedDomain = "GENERAL";
  for (const [domain, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedDomain = domain;
    }
  }
  return maxScore > 0 ? detectedDomain : "GENERAL";
}

// --------------------------------------------------
// Prompts
// --------------------------------------------------
const PHASE1_SYSTEM_PROMPT = `
Anda adalah AI Skill Extractor yang bekerja untuk SEMUA bidang profesional.
Tugas: Ekstrak hard skills dan soft skills dari CV dan Job Description.

DEFINISI UNIVERSAL:
- HARD SKILLS: Keterampilan teknis spesifik yang bisa dipelajari dan diukur
- SOFT SKILLS: Keterampilan interpersonal dan karakteristik personal

WAJIB output JSON persis seperti ini:
{
  "cv_hard_skills": [],
  "cv_soft_skills": [],
  "jd_hard_skills": [],
  "jd_soft_skills": []
}

ATURAN:
- TIDAK BOLEH memberi opini atau score
- TIDAK BOLEH menambahkan field lain
- Gunakan format skill yang standar industri
- Jika skill tidak ditemukan, return array kosong
`;

const NORMALIZER_SYSTEM_PROMPT = `
Normalize semua nama skill ke format standar industri.
Aturan Normalisasi Universal:
- Standarisasi nama teknologi: "ReactJS" -> "React", "NodeJS" -> "Node.js"
- Standarisasi software: "MS Excel" -> "Excel", "Photoshop CC" -> "Photoshop"
- Jangan hapus skill, jangan tambah skill baru
- Jangan gabungkan skill yang berbeda

Output wajib JSON:
{
  "cv_hard_skills": [],
  "cv_soft_skills": [],
  "jd_hard_skills": [],
  "jd_soft_skills": []
}
`;

const PHASE2_SYSTEM_PROMPT = `
Anda adalah HR Analyst & Career Consultant Universal untuk SEMUA bidang.

Output JSON wajib:
{
  "cv_summary": {
    "education": [],
    "skills": [],
    "certifications": [],
    "projects": [],
    "experience": []
  },
  "role_compatibility": [{"role": "", "reason": ""}],
  "action_plan": []
}

Aturan:
1. cv_summary: Ringkas faktual dari CV (maksimal 3-5 item per kategori)
2. role_compatibility: Berikan 3 posisi yang COCOK dengan CV kandidat
3. action_plan: ARRAY STRING dengan 4-6 langkah konkret untuk meningkatkan kelayakan
4. Setiap elemen action_plan HARUS berupa STRING, bukan object
5. Tidak boleh menambahkan field baru
6. Output harus valid JSON
`;

// --------------------------------------------------
// ROUTE: /analyze
// --------------------------------------------------
app.post("/analyze", upload.single("file"), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "Resume tidak diterima. Upload file PDF, DOC, atau DOCX." });
    }
    if (!req.body.job_desc || req.body.job_desc.trim() === "") {
      return res.status(400).json({ error: "Job description kosong. Silakan masukkan deskripsi pekerjaan." });
    }

    filePath = req.file.path;
    const jobDesc = req.body.job_desc.trim();

    console.log("Processing file:", req.file.originalname);

    let resumeText = "";
    try {
      resumeText = await extractTextFromFile(filePath, req.file.mimetype);
    } catch (extractError) {
      return res.status(400).json({ error: extractError.message });
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: "Tidak dapat membaca teks dari file. Pastikan file tidak terenkripsi atau corrupt." });
    }

    const detectedDomain = detectJobDomain(jobDesc);
    console.log("Detected Domain:", detectedDomain);

    // PHASE 1
    const phase1UserPrompt = `=== RESUME ===\n${resumeText}\n\n=== JOB DESCRIPTION ===\n${jobDesc}\n\nBidang Pekerjaan Terdeteksi: ${detectedDomain}\n\nEkstrak skills mengikuti aturan sistem prompt.`;

    const phase1Resp = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        temperature: 0,
        top_p: 1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PHASE1_SYSTEM_PROMPT },
          { role: "user", content: phase1UserPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const phase1 = JSON.parse(phase1Resp.data.choices[0].message.content);
    phase1.cv_hard_skills = phase1.cv_hard_skills || [];
    phase1.cv_soft_skills = phase1.cv_soft_skills || [];
    phase1.jd_hard_skills = phase1.jd_hard_skills || [];
    phase1.jd_soft_skills = phase1.jd_soft_skills || [];

    // PHASE 1.5 - Normalize
    const normalizerPrompt = `Data skill mentah:\n${JSON.stringify(phase1, null, 2)}\n\nNormalize sesuai instruksi.`;

    const normalizerResp = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: NORMALIZER_SYSTEM_PROMPT },
          { role: "user", content: normalizerPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const normalized = JSON.parse(normalizerResp.data.choices[0].message.content);
    phase1.cv_hard_skills = normalized.cv_hard_skills || [];
    phase1.cv_soft_skills = normalized.cv_soft_skills || [];
    phase1.jd_hard_skills = normalized.jd_hard_skills || [];
    phase1.jd_soft_skills = normalized.jd_soft_skills || [];

    // Backend Scoring
    const hardMatches = arrayIntersectCaseInsensitive(phase1.cv_hard_skills, phase1.jd_hard_skills);
    const softMatches = arrayIntersectCaseInsensitive(phase1.cv_soft_skills, phase1.jd_soft_skills);
    const hardMatchScore = calculateMatchScore(hardMatches.length, phase1.jd_hard_skills.length);
    const softMatchScore = calculateMatchScore(softMatches.length, phase1.jd_soft_skills.length);
    const finalScore = hardMatchScore * 0.7 + softMatchScore * 0.3;
    const normalizedScore = Math.min(1, Math.max(0, finalScore));

    const phase1_result = {
      cv_hard_skills: phase1.cv_hard_skills,
      cv_soft_skills: phase1.cv_soft_skills,
      jd_hard_skills: phase1.jd_hard_skills,
      jd_soft_skills: phase1.jd_soft_skills,
      hard_matches: hardMatches,
      soft_matches: softMatches,
      missing_hard_skills: phase1.jd_hard_skills.filter(
        (x) => !hardMatches.map((h) => h.toLowerCase()).includes(String(x).toLowerCase())
      ),
      missing_soft_skills: phase1.jd_soft_skills.filter(
        (x) => !softMatches.map((h) => h.toLowerCase()).includes(String(x).toLowerCase())
      ),
    };

    // PHASE 2
    const phase2Prompt = `PHASE1_RESULT:\n${JSON.stringify(phase1_result, null, 2)}\n\n=== RESUME ===\n${resumeText}\n\n=== JOB DESCRIPTION ===\n${jobDesc}\n\nBidang: ${detectedDomain}\nScore Kecocokan: ${(normalizedScore * 100).toFixed(0)}%\n\nIkuti sistem prompt untuk membuat JSON analisis lengkap.`;

    const phase2Resp = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        top_p: 1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PHASE2_SYSTEM_PROMPT },
          { role: "user", content: phase2Prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const phase2 = JSON.parse(phase2Resp.data.choices[0].message.content);

    // Normalize cv_summary
    if (phase2.cv_summary) {
      phase2.cv_summary.education = (phase2.cv_summary.education || []).map(e =>
        typeof e === "object"
          ? `${e.program || e.degree || ""} - ${e.institution || e.university || ""} ${e.graduation_date || e.year || ""} ${e.gpa ? "| IPK: " + e.gpa : ""}`.trim()
          : String(e)
      );
      phase2.cv_summary.experience = (phase2.cv_summary.experience || []).map(e =>
        typeof e === "object"
          ? `${e.job_title || e.title || e.position || ""} - ${e.company || e.organization || ""} ${e.duration || e.period || ""}`.trim()
          : String(e)
      );
      phase2.cv_summary.certifications = (phase2.cv_summary.certifications || []).map(e =>
        typeof e === "object"
          ? `${e.name || e.title || ""} ${e.issuer || e.institution || ""} ${e.year || e.date || ""}`.trim()
          : String(e)
      );
      phase2.cv_summary.projects = (phase2.cv_summary.projects || []).map(e =>
        typeof e === "object"
          ? `${e.name || e.title || ""}: ${e.description || e.detail || ""}`.trim()
          : String(e)
      );
      phase2.cv_summary.skills = (phase2.cv_summary.skills || []).map(e =>
        typeof e === "object" ? Object.values(e).filter(Boolean).join(", ") : String(e)
      );
    }

    // Cleanup file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Auto Summary
    let auto_summary = "";
    const scorePercent = normalizedScore * 100;
    let topRole = "posisi yang relevan";
    if (phase2.role_compatibility && phase2.role_compatibility.length > 0) {
      topRole = phase2.role_compatibility[0].role || topRole;
    }

    if (scorePercent >= 75) {
      auto_summary = `Kandidat memiliki kecocokan yang sangat kuat dengan ${topRole}. Mayoritas kemampuan teknis dan soft skills sudah sesuai dengan kebutuhan posisi.`;
    } else if (scorePercent >= 50) {
      const missingSkills = phase1_result.missing_hard_skills.slice(0, 3).join(", ");
      auto_summary = `Kandidat cukup relevan dengan ${topRole}, namun masih perlu meningkatkan kemampuan pada area seperti ${missingSkills || "skill teknis tertentu"}.`;
    } else if (scorePercent >= 30) {
      const missingSkills = phase1_result.missing_hard_skills.slice(0, 3).join(", ");
      auto_summary = `Kandidat memiliki beberapa skill dasar untuk ${topRole}, namun perlu pengembangan signifikan pada ${missingSkills || "beberapa area teknis"} untuk menjadi kompetitif.`;
    } else {
      auto_summary = `Kandidat saat ini kurang cocok dengan ${topRole}. Disarankan untuk mengikuti action plan yang diberikan untuk mengembangkan skill yang diperlukan.`;
    }

    return res.json({
      success: true,
      domain: detectedDomain,
      match_score: Number(normalizedScore.toFixed(2)),
      match_percentage: Math.round(normalizedScore * 100),
      auto_summary,
      skills_analysis: {
        hard_skill_matches: hardMatches,
        soft_skill_matches: softMatches,
        missing_hard_skills: phase1_result.missing_hard_skills,
        missing_soft_skills: phase1_result.missing_soft_skills,
        cv_hard_skills: phase1.cv_hard_skills,
        cv_soft_skills: phase1.cv_soft_skills,
        jd_hard_skills: phase1.jd_hard_skills,
        jd_soft_skills: phase1.jd_soft_skills,
      },
      cv_summary: phase2.cv_summary,
      role_compatibility: phase2.role_compatibility,
      action_plan: phase2.action_plan,
      metadata: {
        tokens_used: {
          phase1: phase1Resp.data.usage,
          normalizer: normalizerResp.data.usage,
          phase2: phase2Resp.data.usage,
        },
      },
    });
  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (err.response?.data?.error?.code === "rate_limit_exceeded") {
      return res.status(429).json({ error: "Sistem sedang sibuk. Silakan tunggu beberapa saat dan coba lagi.", detail: "Rate limit exceeded" });
    }
    return res.status(500).json({ error: "Internal server error", detail: err.response?.data || err.message });
  }
});

// --------------------------------------------------
// Auth Routes
// --------------------------------------------------
app.use("/api/auth", authRoutes);

// --------------------------------------------------
// History Routes
// --------------------------------------------------
app.use("/api/history", historyRoutes);

// --------------------------------------------------
// Health Check
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// --------------------------------------------------
// Error Handler
// --------------------------------------------------
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------
const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log("✅ Server running on port " + PORT);
  });
}).catch(err => {
  console.error("❌ Failed to start:", err);
  process.exit(1);
});
