import { Router } from "express";
import { pool } from "../db";
import { authenticate, authorize, AuthRequest, logAudit } from "../middleware/auth";

const router = Router();

function padMikro(id: string | number): string {
  return String(id).padStart(6, "0");
}

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const search = (req.query.search as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    let rows: any[];
    let total: number;

    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&');
      const pattern = `%${escaped}%`;
      const [dataRows] = await pool.execute(
        `SELECT no_rkm_medis, nm_pasien, no_ktp, jk, tmp_lahir, tgl_lahir, alamat, no_tlp, gol_darah, tgl_daftar
         FROM pasien
         WHERE nm_pasien LIKE ? OR no_ktp LIKE ? OR no_rkm_medis LIKE ?
         ORDER BY tgl_daftar DESC
         LIMIT ? OFFSET ?`,
        [pattern, pattern, pattern, String(limit), String(offset)]
      );
      rows = dataRows as any[];

      const [countRows] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM pasien WHERE nm_pasien LIKE ? OR no_ktp LIKE ? OR no_rkm_medis LIKE ?`,
        [pattern, pattern, pattern]
      );
      total = (countRows as any[])[0].cnt;
    } else {
      const [dataRows] = await pool.execute(
        `SELECT no_rkm_medis, nm_pasien, no_ktp, jk, tmp_lahir, tgl_lahir, alamat, no_tlp, gol_darah, tgl_daftar
         FROM pasien
         ORDER BY tgl_daftar DESC
         LIMIT ? OFFSET ?`,
        [String(limit), String(offset)]
      );
      rows = dataRows as any[];

      const [countRows] = await pool.execute("SELECT COUNT(*) as cnt FROM pasien");
      total = (countRows as any[])[0].cnt;
    }

    const patients = rows.map((r: any) => ({
      id: r.no_rkm_medis,
      medicalRecordNumber: r.no_rkm_medis,
      nik: r.no_ktp,
      name: r.nm_pasien,
      birthDate: r.tgl_lahir ? r.tgl_lahir.toISOString().split("T")[0] : null,
      gender: r.jk === "L" ? "male" : r.jk === "P" ? "female" : null,
      address: r.alamat,
      phone: r.no_tlp,
      bloodType: r.gol_darah === "-" ? null : r.gol_darah,
      allergies: null,
      createdAt: r.tgl_daftar ? r.tgl_daftar.toISOString().split("T")[0] : null,
    }));

    return res.json({
      data: patients,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List patients error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const mrn = padMikro(req.params.id);
    const [rows] = await pool.execute(
      `SELECT p.no_rkm_medis, p.nm_pasien, p.no_ktp, p.jk, p.tmp_lahir, p.tgl_lahir,
              p.alamat, p.no_tlp, p.gol_darah, p.tgl_daftar, p.umur
       FROM pasien p
       WHERE p.no_rkm_medis = ?`,
      [mrn]
    );
    const patients = rows as any[];
    if (patients.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const p = patients[0];

    const [recRows] = await pool.execute(
      `SELECT pm.no_rawat, pm.tanggal, pm.kd_dokter, d.nm_dokter,
              pm.keluhan_utama, pm.rps, pm.diagnosis, pm.tata,
              pm.td, pm.nadi, pm.rr, pm.suhu, pm.spo, pm.bb, pm.tb
       FROM penilaian_medis_ralan pm
       LEFT JOIN dokter d ON pm.kd_dokter = d.kd_dokter
       WHERE pm.no_rawat IN (SELECT no_rawat FROM reg_periksa WHERE no_rkm_medis = ?)
       ORDER BY pm.tanggal DESC`,
      [mrn]
    );
    const records = (recRows as any[]).map((r: any) => ({
      id: r.no_rawat,
      visitDate: r.tanggal,
      doctorId: r.kd_dokter,
      doctorName: r.nm_dokter,
      subjective: r.keluhan_utama,
      objective: r.rps,
      assessment: r.diagnosis,
      plan: r.tata,
      diagnosisCode: null,
      diagnosisDescription: null,
      isLocked: false,
      createdAt: r.tanggal,
    }));

    const patient = {
      id: p.no_rkm_medis,
      medicalRecordNumber: p.no_rkm_medis,
      nik: p.no_ktp,
      name: p.nm_pasien,
      birthDate: p.tgl_lahir ? p.tgl_lahir.toISOString().split("T")[0] : null,
      gender: p.jk === "L" ? "male" : p.jk === "P" ? "female" : null,
      address: p.alamat,
      phone: p.no_tlp,
      bloodType: p.gol_darah === "-" ? null : p.gol_darah,
      allergies: null,
      createdAt: p.tgl_daftar ? p.tgl_daftar.toISOString().split("T")[0] : null,
      records,
      attachments: [],
    };

    return res.json(patient);
  } catch (error) {
    console.error("Get patient error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, authorize("doctor", "assistant", "admin"), async (req: AuthRequest, res) => {
  try {
    const { name, nik, birthDate, gender, address, phone, bloodType } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const [maxRows] = await pool.execute("SELECT MAX(CAST(no_rkm_medis AS UNSIGNED)) as max_id FROM pasien");
    const nextId = ((maxRows as any[])[0].max_id || 0) + 1;
    const mrn = padMikro(nextId);

    const jk = gender === "male" ? "L" : gender === "female" ? "P" : null;
    const golDarah = bloodType || "-";

    await pool.execute(
      `INSERT INTO pasien (no_rkm_medis, nm_pasien, no_ktp, jk, tgl_lahir, alamat, no_tlp, gol_darah, tgl_daftar, umur)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?)`,
      [mrn, name, nik || null, jk, birthDate || null, address || null, phone || null, golDarah, ""]
    );

    const [rows] = await pool.execute(
      `SELECT no_rkm_medis, nm_pasien, no_ktp, jk, tgl_lahir, alamat, no_tlp, gol_darah, tgl_daftar
       FROM pasien WHERE no_rkm_medis = ?`,
      [mrn]
    );
    const p = (rows as any[])[0];

    await logAudit({
      userId: req.user!.id,
      action: "create_patient",
      entityType: "patient",
      entityId: mrn,
      details: `Created patient: ${name}`,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      id: p.no_rkm_medis,
      medicalRecordNumber: p.no_rkm_medis,
      nik: p.no_ktp,
      name: p.nm_pasien,
      birthDate: p.tgl_lahir ? p.tgl_lahir.toISOString().split("T")[0] : null,
      gender: p.jk === "L" ? "male" : p.jk === "P" ? "female" : null,
      address: p.alamat,
      phone: p.no_tlp,
      bloodType: p.gol_darah === "-" ? null : p.gol_darah,
      allergies: null,
      createdAt: p.tgl_daftar ? p.tgl_daftar.toISOString().split("T")[0] : null,
    });
  } catch (error) {
    console.error("Create patient error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", authenticate, authorize("doctor", "assistant"), async (req: AuthRequest, res) => {
  try {
    const mrn = padMikro(req.params.id);
    const { name, nik, birthDate, gender, address, phone, bloodType } = req.body;

    const [rows] = await pool.execute("SELECT no_rkm_medis FROM pasien WHERE no_rkm_medis = ?", [mrn]);
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const jk = gender ? (gender === "male" ? "L" : gender === "female" ? "P" : null) : undefined;

    await pool.execute(
      `UPDATE pasien SET nm_pasien = ?, no_ktp = ?, jk = COALESCE(?, jk), tgl_lahir = ?, alamat = ?, no_tlp = ?, gol_darah = ?
       WHERE no_rkm_medis = ?`,
      [
        name ?? (rows as any[])[0].nm_pasien,
        nik ?? null,
        jk ?? null,
        birthDate ?? null,
        address ?? null,
        phone ?? null,
        bloodType ?? "-",
        mrn,
      ]
    );

    const [updRows] = await pool.execute(
      `SELECT no_rkm_medis, nm_pasien, no_ktp, jk, tgl_lahir, alamat, no_tlp, gol_darah, tgl_daftar
       FROM pasien WHERE no_rkm_medis = ?`,
      [mrn]
    );
    const p = (updRows as any[])[0];

    await logAudit({
      userId: req.user!.id,
      action: "update_patient",
      entityType: "patient",
      entityId: mrn,
      details: `Updated patient: ${p.nm_pasien}`,
      ipAddress: req.ip,
    });

    return res.json({
      id: p.no_rkm_medis,
      medicalRecordNumber: p.no_rkm_medis,
      nik: p.no_ktp,
      name: p.nm_pasien,
      birthDate: p.tgl_lahir ? p.tgl_lahir.toISOString().split("T")[0] : null,
      gender: p.jk === "L" ? "male" : p.jk === "P" ? "female" : null,
      address: p.alamat,
      phone: p.no_tlp,
      bloodType: p.gol_darah === "-" ? null : p.gol_darah,
      allergies: null,
      createdAt: p.tgl_daftar ? p.tgl_daftar.toISOString().split("T")[0] : null,
    });
  } catch (error) {
    console.error("Update patient error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
