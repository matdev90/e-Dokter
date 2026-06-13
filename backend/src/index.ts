import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { initAppTables } from "./db";
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
const isProd = !FRONTEND_URL || FRONTEND_URL === `http://localhost:${PORT}`;

app.use(cors({ origin: FRONTEND_URL || `http://localhost:${PORT}`, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use("/uploads", express.static(path.join(import.meta.dir, "../uploads")));

// In production, serve the built frontend
if (isProd) {
  const distPath = path.join(import.meta.dir, "../../frontend/dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }
}

app.get("/ping", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/resume-ralan", resumeRalanRoutes);
app.use("/api/resume-ranap", resumeRanapRoutes);
app.use("/api/operasi", operasiRoutes);
app.use("/api/resume", resumeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/icd10/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const pattern = `%${q}%`;
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

app.get("/api/icd9/search", async (req, res) => {
  try {
    const q = (req.query.q as string) || "";
    const pattern = `%${q}%`;
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

// SPA fallback — serve index.html for any non-API route (production only)
if (isProd) {
  const distPath = path.join(import.meta.dir, "../../frontend/dist");
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    app.get("*", (_req, res) => res.sendFile(indexPath));
  }
}

initAppTables()
  .then(() => {
    console.log("App tables initialized");
    app.listen(PORT, () => {
      console.log(`e-Dokter API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("App tables initialization failed:", err);
    process.exit(1);
  });
