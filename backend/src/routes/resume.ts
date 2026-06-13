import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/penjab", authenticate, async (_req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT kd_pj, png_jawab FROM penjab WHERE png_jawab != '-' ORDER BY png_jawab"
    );
    return res.json(rows);
  } catch (error) {
    console.error("Get penjab error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const jenis = req.query.jenis as string || "";
    const q = req.query.q as string || "";
    const today = new Date().toISOString().slice(0, 10);
    const tgl_from = req.query.tgl_from as string || today;
    const tgl_to = req.query.tgl_to as string || today;
    const pj = req.query.pj as string || "";

    const dc = await (async () => {
      const [rows] = await pool.execute("SELECT doctor_code FROM app_users WHERE id = ?", [req.user!.id]);
      const dr = (rows as any[])[0];
      return dr?.doctor_code || null;
    })();

    const queries: string[] = [];
    const countQueries: string[] = [];
    const allParams: any[] = [];

    const buildRalan = () => {
      const conds: string[] = [];
      const p: any[] = [];
      if (dc) { conds.push("rp.kd_dokter = ?"); p.push(dc); }
      if (q) { conds.push("(p.nm_pasien LIKE ? OR rp.no_rawat LIKE ?)"); p.push(`%${q}%`, `%${q}%`); }
      if (tgl_from) { conds.push("reg.tgl_registrasi >= ?"); p.push(tgl_from); }
      if (tgl_to) { conds.push("reg.tgl_registrasi <= ?"); p.push(tgl_to); }
      if (pj) { conds.push("pj.kd_pj = ?"); p.push(pj); }
      const wc = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
      allParams.push(...p);
      queries.push(`
        SELECT rp.no_rawat, 'Ralan' AS jenis_rawat, p.nm_pasien, p.no_rkm_medis, rp.kd_dokter, d.nm_dokter,
               COALESCE(pl.nm_poli, reg.kd_poli) AS poli, rp.keluhan_utama, rp.diagnosa_utama,
               reg.tgl_registrasi, NULL AS ruang_rawat, pj.png_jawab
        FROM resume_pasien rp
        LEFT JOIN reg_periksa reg ON rp.no_rawat = reg.no_rawat
        LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pl ON reg.kd_poli = pl.kd_poli
        LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        ${wc}
      `);
      countQueries.push(`
        SELECT COUNT(*) AS cnt FROM resume_pasien rp
        LEFT JOIN reg_periksa reg ON rp.no_rawat = reg.no_rawat
        LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        ${wc}
      `);
    };

    const buildRanap = () => {
      const conds: string[] = [];
      const p: any[] = [];
      if (dc) { conds.push("rpr.kd_dokter = ?"); p.push(dc); }
      if (q) { conds.push("(p.nm_pasien LIKE ? OR rpr.no_rawat LIKE ?)"); p.push(`%${q}%`, `%${q}%`); }
      if (tgl_from) { conds.push("reg.tgl_registrasi >= ?"); p.push(tgl_from); }
      if (tgl_to) { conds.push("reg.tgl_registrasi <= ?"); p.push(tgl_to); }
      if (pj) { conds.push("pj.kd_pj = ?"); p.push(pj); }
      const wc = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
      allParams.push(...p);
      queries.push(`
        SELECT rpr.no_rawat, 'Ranap' AS jenis_rawat, p.nm_pasien, p.no_rkm_medis, rpr.kd_dokter, d.nm_dokter,
               COALESCE(b.nm_bangsal, '') AS poli, rpr.keluhan_utama, rpr.diagnosa_utama,
               reg.tgl_registrasi,
               (SELECT CONCAT(ki.kd_kamar, ' - ', b2.nm_bangsal) FROM kamar_inap ki JOIN kamar k2 ON ki.kd_kamar = k2.kd_kamar JOIN bangsal b2 ON k2.kd_bangsal = b2.kd_bangsal WHERE ki.no_rawat = rpr.no_rawat ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC LIMIT 1) AS ruang_rawat,
               pj.png_jawab
        FROM resume_pasien_ranap rpr
        LEFT JOIN reg_periksa reg ON rpr.no_rawat = reg.no_rawat
        LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rpr.kd_dokter = d.kd_dokter
        LEFT JOIN kamar_inap ki ON rpr.no_rawat = ki.no_rawat
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        ${wc}
      `);
      countQueries.push(`
        SELECT COUNT(*) AS cnt FROM resume_pasien_ranap rpr
        LEFT JOIN reg_periksa reg ON rpr.no_rawat = reg.no_rawat
        LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        ${wc}
      `);
    };

    if (!jenis || jenis === "ralan") buildRalan();
    if (!jenis || jenis === "ranap") buildRanap();

    if (queries.length === 0) {
      return res.json({ data: [], total: 0, page: 1, totalPages: 0 });
    }

    const unionQuery = queries.join(" UNION ALL ");
    const countQuery = `SELECT SUM(cnt) AS total FROM (${countQueries.join(" UNION ALL ")}) sub`;

    const [countRows] = await pool.execute(countQuery, allParams.length > 0 ? allParams : []) as any;
    const total = Number(countRows[0]?.total || 0);

    const queryAll = `${unionQuery} ORDER BY tgl_registrasi DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await pool.execute(queryAll, allParams.length > 0 ? allParams : []);

    return res.json({
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("List resume error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const [drRows] = await pool.execute("SELECT doctor_code FROM app_users WHERE id = ?", [req.user!.id]);
    const dr = (drRows as any[])[0];
    const dc = dr?.doctor_code || null;

    const today = new Date().toISOString().slice(0, 10);
    const tgl_from = req.query.tgl_from as string || today;
    const tgl_to = req.query.tgl_to as string || today;
    const pj = req.query.pj as string || "";

    const dcRalan = dc ? `AND rp.kd_dokter = ?` : "";
    const dcRanap = dc ? `AND rpr.kd_dokter = ?` : "";
    const paramsRalan: any[] = dc ? [dc] : [];
    const paramsRanap: any[] = dc ? [dc] : [];

    const dateCondsRalan: string[] = [];
    if (tgl_from) dateCondsRalan.push("reg.tgl_registrasi >= ?");
    if (tgl_to) dateCondsRalan.push("reg.tgl_registrasi <= ?");
    const dateFilterStrRalan = dateCondsRalan.length ? `AND ${dateCondsRalan.join(" AND ")}` : "";
    if (tgl_from) paramsRalan.push(tgl_from);
    if (tgl_to) paramsRalan.push(tgl_to);

    const pjFilterRalan = pj ? "AND pj.kd_pj = ?" : "";
    if (pj) paramsRalan.push(pj);

    const dateCondsRanap: string[] = [];
    if (tgl_from) dateCondsRanap.push("reg.tgl_registrasi >= ?");
    if (tgl_to) dateCondsRanap.push("reg.tgl_registrasi <= ?");
    const dateFilterStrRanap = dateCondsRanap.length ? `AND ${dateCondsRanap.join(" AND ")}` : "";
    if (tgl_from) paramsRanap.push(tgl_from);
    if (tgl_to) paramsRanap.push(tgl_to);

    const pjFilterRanap = pj ? "AND pj.kd_pj = ?" : "";
    if (pj) paramsRanap.push(pj);

    const [ralanRows] = await pool.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pj.png_jawab LIKE '%BPJS%' THEN 1 ELSE 0 END) AS bpjs,
        SUM(CASE WHEN pj.png_jawab NOT LIKE '%BPJS%' OR pj.png_jawab IS NULL THEN 1 ELSE 0 END) AS umum,
        COUNT(*) AS sudah_resume,
        0 AS belum_resume,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat) THEN 1 ELSE 0 END) AS laporan_operasi,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat) AND NOT EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat) THEN 1 ELSE 0 END) AS belum_laporan_operasi
      FROM resume_pasien rp
      LEFT JOIN reg_periksa reg ON rp.no_rawat = reg.no_rawat
      LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
      WHERE 1=1 ${dcRalan} ${dateFilterStrRalan} ${pjFilterRalan}`,
      paramsRalan
    ) as any;

    const [ranapRows] = await pool.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pj.png_jawab LIKE '%BPJS%' THEN 1 ELSE 0 END) AS bpjs,
        SUM(CASE WHEN pj.png_jawab NOT LIKE '%BPJS%' AND pj.png_jawab IS NOT NULL AND pj.png_jawab != '-' THEN 1 ELSE 0 END) AS umum,
        COUNT(*) AS sudah_resume,
        0 AS belum_resume,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rpr.no_rawat) THEN 1 ELSE 0 END) AS laporan_operasi,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rpr.no_rawat) AND NOT EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rpr.no_rawat) THEN 1 ELSE 0 END) AS belum_laporan_operasi
      FROM resume_pasien_ranap rpr
      LEFT JOIN reg_periksa reg ON rpr.no_rawat = reg.no_rawat
      LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
      WHERE 1=1 ${dcRanap} ${dateFilterStrRanap} ${pjFilterRanap}`,
      paramsRanap
    ) as any;

    const r = (ralanRows[0] || {});
    const ra = (ranapRows[0] || {});

    return res.json({
      ralan: {
        total: Number(r.total || 0),
        bpjs: Number(r.bpjs || 0),
        umum: Number(r.umum || 0),
        sudah_resume: Number(r.sudah_resume || 0),
        belum_resume: Number(r.belum_resume || 0),
        laporan_operasi: Number(r.laporan_operasi || 0),
        belum_laporan_operasi: Number(r.belum_laporan_operasi || 0),
      },
      ranap: {
        total: Number(ra.total || 0),
        bpjs: Number(ra.bpjs || 0),
        umum: Number(ra.umum || 0),
        bpjs_umum: Number(ra.bpjs || 0) + Number(ra.umum || 0),
        sudah_resume: Number(ra.sudah_resume || 0),
        belum_resume: Number(ra.belum_resume || 0),
        laporan_operasi: Number(ra.laporan_operasi || 0),
        belum_laporan_operasi: Number(ra.belum_laporan_operasi || 0),
      },
    });
  } catch (error) {
    console.error("Resume stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:no_rawat", authenticate, async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.params.no_rawat;

    const [ralanRows] = await pool.execute(
      `SELECT rp.*, p.nm_pasien, p.no_rkm_medis, p.no_ktp, p.tgl_lahir, p.jk, d.nm_dokter,
              reg.tgl_registrasi, 'Ralan' AS jenis_rawat,
              pl.nm_poli
       FROM resume_pasien rp
       LEFT JOIN reg_periksa reg ON rp.no_rawat = reg.no_rawat
       LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
       LEFT JOIN poliklinik pl ON reg.kd_poli = pl.kd_poli
       WHERE rp.no_rawat = ?`,
      [no_rawat]
    );

    if ((ralanRows as any[]).length > 0) {
      return res.json({ ...(ralanRows as any[])[0], jenis_rawat: "Ralan" });
    }

    const [ranapRows] = await pool.execute(
      `SELECT rpr.*, p.nm_pasien, p.no_rkm_medis, p.no_ktp, p.tgl_lahir, p.jk, d.nm_dokter,
              reg.tgl_registrasi, 'Ranap' AS jenis_rawat,
              b.nm_bangsal AS nm_poli,
              (SELECT CONCAT(ki.kd_kamar, ' - ', b2.nm_bangsal) FROM kamar_inap ki JOIN kamar k2 ON ki.kd_kamar = k2.kd_kamar JOIN bangsal b2 ON k2.kd_bangsal = b2.kd_bangsal WHERE ki.no_rawat = rpr.no_rawat ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC LIMIT 1) AS ruang_rawat
       FROM resume_pasien_ranap rpr
       LEFT JOIN reg_periksa reg ON rpr.no_rawat = reg.no_rawat
       LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON rpr.kd_dokter = d.kd_dokter
       LEFT JOIN kamar_inap ki ON rpr.no_rawat = ki.no_rawat
       LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
       LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
       WHERE rpr.no_rawat = ?`,
      [no_rawat]
    );

    if ((ranapRows as any[]).length > 0) {
      return res.json({ ...(ranapRows as any[])[0], jenis_rawat: "Ranap" });
    }

    return res.status(404).json({ error: "Resume not found" });
  } catch (error) {
    console.error("Get resume detail error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:no_rawat", authenticate, async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.params.no_rawat;

    const [ralanRows] = await pool.execute("SELECT 1 FROM resume_pasien WHERE no_rawat = ?", [no_rawat]);
    if ((ralanRows as any[]).length > 0) {
      await pool.execute("DELETE FROM resume_pasien WHERE no_rawat = ?", [no_rawat]);
      return res.json({ message: "Resume Ralan deleted" });
    }

    const [ranapRows] = await pool.execute("SELECT 1 FROM resume_pasien_ranap WHERE no_rawat = ?", [no_rawat]);
    if ((ranapRows as any[]).length > 0) {
      await pool.execute("DELETE FROM resume_pasien_ranap WHERE no_rawat = ?", [no_rawat]);
      return res.json({ message: "Resume Ranap deleted" });
    }

    return res.status(404).json({ error: "Resume not found" });
  } catch (error) {
    console.error("Delete resume error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
