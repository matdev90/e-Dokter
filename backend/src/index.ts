import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { pool } from "./db";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import authRoutes from "./routes/auth";
import patientRoutes from "./routes/patients";
import recordRoutes from "./routes/records";
import attachmentRoutes from "./routes/attachments";
import userRoutes from "./routes/users";
import auditRoutes from "./routes/audit";
import resumeRalanRoutes from "./routes/resume-ralan";
import resumeRanapRoutes from "./routes/resume-ranap";
import operasiRoutes from "./routes/operasi";
import resumeRoutes from "./routes/resume";
import dashboardRoutes from "./routes/dashboard";
import notificationRoutes from "./routes/notifications";

const app = express();
const PORT = parseInt(process.env.PORT || "4000");
const FRONTEND_URL = process.env.FRONTEND_URL || "";

app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: FRONTEND_URL || `http://localhost:${PORT}`, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Terlalu banyak percobaan login. Coba lagi 15 menit." },
  standardHeaders: true,
  legacyHeaders: false,
});

const distPath = path.join(__dirname, "../../frontend/dist");

const apiRouter = express.Router();
apiRouter.use("/auth/login", loginLimiter);
apiRouter.use("/auth", authRoutes);
apiRouter.use("/patients", patientRoutes);
apiRouter.use("/records", recordRoutes);
apiRouter.use("/attachments", attachmentRoutes);
apiRouter.use("/users", userRoutes);
apiRouter.use("/audit-logs", auditRoutes);
apiRouter.use("/resume-ralan", resumeRalanRoutes);
apiRouter.use("/resume-ranap", resumeRanapRoutes);
apiRouter.use("/operasi", operasiRoutes);
apiRouter.use("/resume", resumeRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/notifications", notificationRoutes);

apiRouter.get("/icd10/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const sq = q.replace(/[%_]/g, '\\$&');
    const pattern = `%${sq}%`;
    const [rows] = await pool.execute(
      `SELECT kd_penyakit AS code, nm_penyakit AS description
       FROM penyakit
       WHERE kd_penyakit LIKE ? OR nm_penyakit LIKE ?
       ORDER BY nm_penyakit
       LIMIT 30`,
      [pattern, pattern]
    );
    return res.json(rows);
  } catch (error) {
    console.error("ICD-10 search error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

apiRouter.get("/icd9/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const sq = q.replace(/[%_]/g, '\\$&');
    const pattern = `%${sq}%`;
    const [rows] = await pool.execute(
      `SELECT kode AS code, deskripsi_panjang AS description
       FROM icd9
       WHERE kode LIKE ? OR deskripsi_panjang LIKE ?
       ORDER BY deskripsi_panjang
       LIMIT 30`,
      [pattern, pattern]
    );
    return res.json(rows);
  } catch (error) {
    console.error("ICD-9 search error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.use("/api", apiRouter);
app.use("/e-dokter/api", apiRouter);

app.get("/ping", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

if (fs.existsSync(distPath)) {
  app.use("/e-dokter", express.static(distPath));

  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    app.get("/e-dokter/*", (_req, res) => res.sendFile(indexPath));
  }
}

app.get("/", (_req, res) => res.redirect("/e-dokter/"));

app.listen(PORT, () => {
  console.log(`e-Dokter API running on http://localhost:${PORT}`);
});
