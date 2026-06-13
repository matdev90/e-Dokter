import { Router } from "express";
import { pool } from "../db";
import { authenticate, authorize, AuthRequest, logAudit } from "../middleware/auth";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(import.meta.dir, "../../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf", ".dcm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported"));
    }
  },
});

const router = Router();

router.post("/upload", authenticate, authorize("doctor", "assistant"), upload.single("file"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { patientId, medicalRecordId, category } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: "Patient ID required" });
    }

    const mrn = String(patientId).padStart(6, "0");
    const noRawat = medicalRecordId || "-";

    await pool.execute(
      `INSERT INTO berkas_digital_perawatan (no_rawat, kode, lokasi_file)
       VALUES (?, ?, ?)`,
      [noRawat, category || "other", req.file.filename]
    );

    await logAudit({
      userId: req.user!.id,
      action: "upload_attachment",
      entityType: "attachment",
      entityId: req.file.filename,
      details: `Uploaded file: ${req.file.originalname}`,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      id: req.file.filename,
      patientId: mrn,
      medicalRecordId: noRawat,
      fileName: req.file.originalname,
      filePath: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      category: category || "other",
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT no_rawat, kode, lokasi_file FROM berkas_digital_perawatan WHERE lokasi_file = ?",
      [req.params.id]
    );
    const atts = rows as any[];
    if (atts.length === 0) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    const a = atts[0];
    return res.json({
      id: a.lokasi_file,
      medicalRecordId: a.no_rawat,
      filePath: a.lokasi_file,
    });
  } catch (error) {
    console.error("Get attachment error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/download", authenticate, async (req: AuthRequest, res) => {
  try {
    return res.download(path.join(UPLOAD_DIR, req.params.id));
  } catch (error) {
    console.error("Download error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
