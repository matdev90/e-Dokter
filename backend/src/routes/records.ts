import { Router } from "express";
import { pool } from "../db";
import { authenticate, authorize, AuthRequest, logAudit } from "../middleware/auth";

const router = Router();

router.get("/patient/:patientId", authenticate, async (req: AuthRequest, res) => {
  try {
    const mrn = req.params.patientId.padStart(6, "0");

    const [rows] = await pool.execute(
      `SELECT pm.no_rawat, pm.tanggal, pm.kd_dokter, d.nm_dokter,
              pm.keluhan_utama, pm.rps, pm.rpd, pm.rpk, pm.rpo,
              pm.diagnosis, pm.tata,
              pm.td, pm.nadi, pm.rr, pm.suhu, pm.spo, pm.bb, pm.tb,
              pm.alergi, pm.kesadaran, pm.gcs
       FROM penilaian_medis_ralan pm
       LEFT JOIN dokter d ON pm.kd_dokter = d.kd_dokter
       WHERE pm.no_rawat IN (SELECT no_rawat FROM reg_periksa WHERE no_rkm_medis = ?)
       ORDER BY pm.tanggal DESC`,
      [mrn]
    );
    const records = (rows as any[]).map((r: any) => {
      const vitals = [
        r.td ? `TD: ${r.td}` : null,
        r.nadi ? `Nadi: ${r.nadi}` : null,
        r.rr ? `RR: ${r.rr}` : null,
        r.suhu ? `Suhu: ${r.suhu}` : null,
        r.spo ? `SPO2: ${r.spo}` : null,
        r.bb ? `BB: ${r.bb}` : null,
        r.tb ? `TB: ${r.tb}` : null,
        r.kesadaran ? `Kesadaran: ${r.kesadaran}` : null,
      ].filter(Boolean).join("\n");
      const rpsText = r.rps || null;
      const objective = rpsText ? (vitals ? `${vitals}\n${rpsText}` : rpsText) : vitals || null;
      return {
        id: r.no_rawat,
        patientId: mrn,
        doctorId: r.kd_dokter,
        visitDate: r.tanggal,
        subjective: r.keluhan_utama,
        objective,
        assessment: r.diagnosis,
        plan: r.tata,
        diagnosisCode: null,
        diagnosisDescription: null,
        isLocked: false,
        doctorName: r.nm_dokter,
        createdAt: r.tanggal,
        updatedAt: r.tanggal,
        addendums: [],
        attachments: [],
      };
    });

    return res.json(records);
  } catch (error) {
    console.error("Get records error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const noRawat = req.params.id;
    const [rows] = await pool.execute(
      `SELECT pm.no_rawat, pm.tanggal, pm.kd_dokter, d.nm_dokter,
              pm.keluhan_utama, pm.rps, pm.rpd, pm.rpk, pm.rpo,
              pm.diagnosis, pm.tata,
              pm.td, pm.nadi, pm.rr, pm.suhu, pm.spo, pm.bb, pm.tb,
              pm.alergi, pm.kesadaran, pm.gcs
       FROM penilaian_medis_ralan pm
       LEFT JOIN dokter d ON pm.kd_dokter = d.kd_dokter
       WHERE pm.no_rawat = ?`,
      [noRawat]
    );
    const recs = rows as any[];
    if (recs.length === 0) {
      return res.status(404).json({ error: "Record not found" });
    }

    const r = recs[0];
    const vitals = [
      r.td ? `TD: ${r.td}` : null,
      r.nadi ? `Nadi: ${r.nadi}` : null,
      r.rr ? `RR: ${r.rr}` : null,
      r.suhu ? `Suhu: ${r.suhu}` : null,
      r.spo ? `SPO2: ${r.spo}` : null,
      r.bb ? `BB: ${r.bb}` : null,
      r.tb ? `TB: ${r.tb}` : null,
      r.kesadaran ? `Kesadaran: ${r.kesadaran}` : null,
    ].filter(Boolean).join("\n");
    const rpsText = r.rps || null;
    const objective = rpsText ? (vitals ? `${vitals}\n${rpsText}` : rpsText) : vitals || null;
    return res.json({
      id: r.no_rawat,
      doctorId: r.kd_dokter,
      visitDate: r.tanggal,
      subjective: r.keluhan_utama,
      objective,
      assessment: r.diagnosis,
      plan: r.tata,
      diagnosisCode: null,
      diagnosisDescription: null,
      isLocked: false,
      doctorName: r.nm_dokter,
      createdAt: r.tanggal,
      updatedAt: r.tanggal,
      addendums: [],
      attachments: [],
    });
  } catch (error) {
    console.error("Get record error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const { patientId, subjective, objective, assessment, plan, diagnosisCode, diagnosisDescription } = req.body;
    if (!patientId) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    const mrn = String(patientId).padStart(6, "0");

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;

    const [seqRows] = await pool.execute(
      `SELECT COUNT(*) as cnt FROM reg_periksa WHERE tgl_registrasi = CURDATE()`
    );
    const seq = ((seqRows as any[])[0].cnt || 0) + 1;
    const noRawat = `${dateStr}/${String(seq).padStart(6, "0")}`;

    const kdDokter = req.user!.doctor_code || "D0000028";

    await pool.execute(
      `INSERT INTO reg_periksa (no_rawat, tgl_registrasi, jam_reg, kd_dokter, no_rkm_medis, kd_poli, stts_daftar, status_lanjut, kd_pj, status_bayar, status_poli)
       VALUES (?, CURDATE(), CURTIME(), ?, ?, 'PU', 'Baru', 'Ralan', 'A67', 'Belum Bayar', 'Baru')`,
      [noRawat, kdDokter, mrn]
    );

    const anamnesis = objective ? "Alloanamnesis" : "Autoanamnesis";
    const td = objective ? objective.split("\n")[0]?.replace("TD: ", "") || "" : "";
    const nadi = objective ? objective.split("\n").find((l: string) => l.startsWith("Nadi:"))?.replace("Nadi: ", "") || "" : "";
    const rr = objective ? objective.split("\n").find((l: string) => l.startsWith("RR:"))?.replace("RR: ", "") || "" : "";
    const suhu = objective ? objective.split("\n").find((l: string) => l.startsWith("Suhu:"))?.replace("Suhu: ", "") || "" : "";
    const spo = objective ? objective.split("\n").find((l: string) => l.startsWith("SPO2:"))?.replace("SPO2: ", "") || "" : "";
    const bb = objective ? objective.split("\n").find((l: string) => l.startsWith("BB:"))?.replace("BB: ", "") || "" : "";
    const tb = objective ? objective.split("\n").find((l: string) => l.startsWith("TB:"))?.replace("TB: ", "") || "" : "";

    await pool.execute(
      `INSERT INTO penilaian_medis_ralan
       (no_rawat, tanggal, kd_dokter, anamnesis, hubungan, keluhan_utama, rps, rpd, rpk, rpo, diagnosis, tata, td, nadi, rr, suhu, spo, bb, tb, keadaan, kesadaran, gcs, alergi,
        kepala, gigi, tht, thoraks, abdomen, genital, ekstremitas, kulit, ket_fisik, ket_lokalis, penunjang, konsulrujuk)
       VALUES (?, NOW(), ?, ?, '-', ?, ?, '-', '-', '-', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Sehat', 'Compos Mentis', '', '-',
        'Normal','Normal','Normal','Normal','Normal','Normal','Normal','Normal','','','', '-')`,
      [noRawat, kdDokter, anamnesis, subjective || "", objective || "", assessment || "", plan || "",
       td, nadi, rr, suhu, spo, bb, tb]
    );

    if (diagnosisCode) {
      await pool.execute(
        "INSERT INTO diagnosa_pasien (no_rawat, kd_penyakit, status, prioritas) VALUES (?, ?, 'Ralan', 1)",
        [noRawat, diagnosisCode]
      );
    }

    await logAudit({
      userId: req.user!.id,
      action: "create_record",
      entityType: "medical_record",
      entityId: noRawat,
      details: `Created medical record for patient ${mrn}`,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      id: noRawat,
      patientId: mrn,
      doctorId: kdDokter,
      visitDate: now.toISOString(),
      subjective,
      objective,
      assessment,
      plan,
      diagnosisCode: diagnosisCode || null,
      diagnosisDescription: diagnosisDescription || null,
      isLocked: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Create record error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const noRawat = req.params.id;
    const [rows] = await pool.execute("SELECT no_rawat FROM penilaian_medis_ralan WHERE no_rawat = ?", [noRawat]);
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: "Record not found" });
    }

    const { subjective, objective, assessment, plan, diagnosisCode, diagnosisDescription } = req.body;

    const td = objective ? objective.split("\n").find((l: string) => l.startsWith("TD:"))?.replace("TD: ", "") || "" : "";
    const nadi = objective ? objective.split("\n").find((l: string) => l.startsWith("Nadi:"))?.replace("Nadi: ", "") || "" : "";

    await pool.execute(
      `UPDATE penilaian_medis_ralan SET
        keluhan_utama = COALESCE(?, keluhan_utama),
        rps = COALESCE(?, rps),
        diagnosis = COALESCE(?, diagnosis),
        tata = COALESCE(?, tata),
        td = COALESCE(?, td),
        nadi = COALESCE(?, nadi)
       WHERE no_rawat = ?`,
      [subjective || null, objective || null, assessment || null, plan || null, td || null, nadi || null, noRawat]
    );

    if (diagnosisCode) {
      await pool.execute(
        "DELETE FROM diagnosa_pasien WHERE no_rawat = ? AND status = 'Ralan'",
        [noRawat]
      );
      await pool.execute(
        "INSERT INTO diagnosa_pasien (no_rawat, kd_penyakit, status, prioritas) VALUES (?, ?, 'Ralan', 1)",
        [noRawat, diagnosisCode]
      );
    }

    await logAudit({
      userId: req.user!.id,
      action: "update_record",
      entityType: "medical_record",
      entityId: noRawat,
      details: "Updated medical record",
      ipAddress: req.ip,
    });

    return res.json({ id: noRawat, message: "Updated" });
  } catch (error) {
    console.error("Update record error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/lock", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const noRawat = req.params.id;
    const [rows] = await pool.execute("SELECT no_rawat FROM penilaian_medis_ralan WHERE no_rawat = ?", [noRawat]);
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: "Record not found" });
    }

    await logAudit({
      userId: req.user!.id,
      action: "lock_record",
      entityType: "medical_record",
      entityId: noRawat,
      details: "Locked medical record",
      ipAddress: req.ip,
    });

    return res.json({ id: noRawat, isLocked: true });
  } catch (error) {
    console.error("Lock record error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/addendum", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const noRawat = req.params.id;
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const [rows] = await pool.execute("SELECT no_rawat FROM penilaian_medis_ralan WHERE no_rawat = ?", [noRawat]);
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: "Record not found" });
    }

    const addendumId = `ADD-${noRawat}-${Date.now()}`;

    await logAudit({
      userId: req.user!.id,
      action: "add_addendum",
      entityType: "medical_record",
      entityId: noRawat,
      details: "Added addendum to record",
      ipAddress: req.ip,
    });

    return res.status(201).json({ id: addendumId, medicalRecordId: noRawat, doctorId: req.user!.id, content, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error("Addendum error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
