import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

function getDoctorClauseRalan(dc: string | null): { sql: string; params: any[] } {
  if (!dc) return { sql: "1=1", params: [] };
  return {
    sql: `rp.kd_dokter = ? AND (
      NOT EXISTS (SELECT 1 FROM jadwal WHERE kd_dokter = ?)
      OR EXISTS (
        SELECT 1 FROM jadwal j
        WHERE j.kd_dokter = rp.kd_dokter
          AND j.hari_kerja = ELT(DAYOFWEEK(rp.tgl_registrasi), 'AKHAD','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU')
          AND j.kd_poli = rp.kd_poli
      )
    )`,
    params: [dc, dc],
  };
}

function getDoctorClauseRanap(dc: string | null): { sql: string; params: any[] } {
  if (!dc) return { sql: "1=1", params: [] };
  return {
    sql: "EXISTS (SELECT 1 FROM dpjp_ranap dp WHERE dp.no_rawat = rp.no_rawat AND dp.kd_dokter = ?)",
    params: [dc],
  };
}

async function getDoctorCode(req: AuthRequest): Promise<string | null> {
  const [rows] = await pool.execute("SELECT doctor_code FROM app_users WHERE id = ?", [req.user!.id]);
  const dr = (rows as any[])[0];
  return dr?.doctor_code || null;
}

router.get("/doctor-stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const dc = await getDoctorCode(req);
    const ralan = getDoctorClauseRalan(dc);
    const ranap = getDoctorClauseRanap(dc);

    const [[hariIni]] = await pool.execute(`
      SELECT
        SUM(status_lanjut = 'Ralan') AS ralan,
        SUM(status_lanjut = 'Ranap') AS ranap,
        COUNT(*) AS total
      FROM reg_periksa rp
      WHERE rp.tgl_registrasi = CURDATE() AND (${ralan.sql} OR ${ranap.sql})
    `, [...ralan.params, ...ranap.params]) as any;

    const [[bulanIni]] = await pool.execute(`
      SELECT
        SUM(status_lanjut = 'Ralan') AS ralan,
        SUM(status_lanjut = 'Ranap') AS ranap,
        COUNT(*) AS total
      FROM reg_periksa rp
      WHERE DATE_FORMAT(rp.tgl_registrasi, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') AND (${ralan.sql} OR ${ranap.sql})
    `, [...ralan.params, ...ranap.params]) as any;

    const [[tahunIni]] = await pool.execute(`
      SELECT
        SUM(status_lanjut = 'Ralan') AS ralan,
        SUM(status_lanjut = 'Ranap') AS ranap,
        COUNT(*) AS total
      FROM reg_periksa rp
      WHERE DATE_FORMAT(rp.tgl_registrasi, '%Y') = DATE_FORMAT(CURDATE(), '%Y') AND (${ralan.sql} OR ${ranap.sql})
    `, [...ralan.params, ...ranap.params]) as any;

    const [[totalKeseluruhan]] = await pool.execute(`
      SELECT
        SUM(status_lanjut = 'Ralan') AS ralan,
        SUM(status_lanjut = 'Ranap') AS ranap,
        COUNT(*) AS total
      FROM reg_periksa rp
      WHERE ${ralan.sql} OR ${ranap.sql}
    `, [...ralan.params, ...ranap.params]) as any;

    return res.json({
      hari_ini: { ralan: Number(hariIni?.ralan || 0), ranap: Number(hariIni?.ranap || 0), total: Number(hariIni?.total || 0) },
      bulan_ini: { ralan: Number(bulanIni?.ralan || 0), ranap: Number(bulanIni?.ranap || 0), total: Number(bulanIni?.total || 0) },
      tahun_ini: { ralan: Number(tahunIni?.ralan || 0), ranap: Number(tahunIni?.ranap || 0), total: Number(tahunIni?.total || 0) },
      total_keseluruhan: { ralan: Number(totalKeseluruhan?.ralan || 0), ranap: Number(totalKeseluruhan?.ranap || 0), total: Number(totalKeseluruhan?.total || 0) },
    });
  } catch (error) {
    console.error("Doctor stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/doctor-recent", authenticate, async (req: AuthRequest, res) => {
  try {
    const dc = await getDoctorCode(req);
    const ralan = getDoctorClauseRalan(dc);
    const ranap = getDoctorClauseRanap(dc);

    const [rows] = await pool.execute(`
      SELECT rp.no_rawat, rp.no_rkm_medis, p.nm_pasien, rp.tgl_registrasi,
             rp.status_lanjut, COALESCE(pol.nm_poli, rp.kd_poli) AS nm_poli,
             rp.kd_dokter, d.nm_dokter,
             CASE WHEN rp.status_lanjut = 'Ralan' THEN (SELECT COUNT(*) FROM resume_pasien WHERE no_rawat = rp.no_rawat)
                  ELSE (SELECT COUNT(*) FROM resume_pasien_ranap WHERE no_rawat = rp.no_rawat)
             END AS has_resume,
             (EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat)) AS has_operasi,
              (EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat AND laporan_operasi IS NOT NULL AND laporan_operasi != '') AND EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat)) AS has_laporan_operasi
      FROM reg_periksa rp
      JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
      LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
      WHERE ${ralan.sql} OR ${ranap.sql}
      ORDER BY rp.tgl_registrasi DESC, rp.jam_reg DESC
      LIMIT 5
    `, [...ralan.params, ...ranap.params]);

    return res.json(rows);
  } catch (error) {
    console.error("Doctor recent error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/doctor-monthly", authenticate, async (req: AuthRequest, res) => {
  try {
    const dc = await getDoctorCode(req);
    const ralan = getDoctorClauseRalan(dc);
    const ranap = getDoctorClauseRanap(dc);

    const [rows] = await pool.execute(`
      SELECT
        DATE_FORMAT(rp.tgl_registrasi, '%Y-%m') AS bulan,
        SUM(rp.status_lanjut = 'Ralan') AS ralan,
        SUM(rp.status_lanjut = 'Ranap') AS ranap,
        COUNT(*) AS total
      FROM reg_periksa rp
      WHERE rp.tgl_registrasi >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        AND (${ralan.sql} OR ${ranap.sql})
      GROUP BY DATE_FORMAT(rp.tgl_registrasi, '%Y-%m')
      ORDER BY bulan ASC
    `, [...ralan.params, ...ranap.params]);

    return res.json(rows);
  } catch (error) {
    console.error("Doctor monthly error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/doctor-poly-distribution", authenticate, async (req: AuthRequest, res) => {
  try {
    const dc = await getDoctorCode(req);
    const ralan = getDoctorClauseRalan(dc);

    const [rows] = await pool.execute(`
      SELECT COALESCE(pol.nm_poli, rp.kd_poli) AS nm_poli, COUNT(*) AS total
      FROM reg_periksa rp
      LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
      WHERE rp.status_lanjut = 'Ralan' AND ${ralan.sql}
      GROUP BY rp.kd_poli
      ORDER BY total DESC
      LIMIT 8
    `, ralan.params);

    return res.json(rows);
  } catch (error) {
    console.error("Doctor poly distribution error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/doctor-operasi-stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const dc = await getDoctorCode(req);

    const dcFilter = dc ? `AND (o.operator1 = ? OR o.operator2 = ? OR o.operator3 = ?)` : "";
    const dcParams = dc ? [dc, dc, dc] : [];

    const [[hariIni]] = await pool.execute(`
      SELECT COUNT(*) AS total,
             SUM(lo.no_rawat IS NOT NULL) AS sudah_laporan,
             SUM(lo.no_rawat IS NULL) AS belum_laporan
      FROM operasi o
      LEFT JOIN laporan_operasi lo ON o.no_rawat = lo.no_rawat AND o.tgl_operasi = lo.tanggal
      WHERE DATE(o.tgl_operasi) = CURDATE() ${dcFilter}
    `, dcParams) as any;

    const [[bulanIni]] = await pool.execute(`
      SELECT COUNT(*) AS total,
             SUM(lo.no_rawat IS NOT NULL) AS sudah_laporan,
             SUM(lo.no_rawat IS NULL) AS belum_laporan
      FROM operasi o
      LEFT JOIN laporan_operasi lo ON o.no_rawat = lo.no_rawat AND o.tgl_operasi = lo.tanggal
      WHERE DATE_FORMAT(o.tgl_operasi, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') ${dcFilter}
    `, dcParams) as any;

    const [[tahunIni]] = await pool.execute(`
      SELECT COUNT(*) AS total,
             SUM(lo.no_rawat IS NOT NULL) AS sudah_laporan,
             SUM(lo.no_rawat IS NULL) AS belum_laporan
      FROM operasi o
      LEFT JOIN laporan_operasi lo ON o.no_rawat = lo.no_rawat AND o.tgl_operasi = lo.tanggal
      WHERE DATE_FORMAT(o.tgl_operasi, '%Y') = DATE_FORMAT(CURDATE(), '%Y') ${dcFilter}
    `, dcParams) as any;

    const [[totalKeseluruhan]] = await pool.execute(`
      SELECT COUNT(*) AS total,
             SUM(lo.no_rawat IS NOT NULL) AS sudah_laporan,
             SUM(lo.no_rawat IS NULL) AS belum_laporan
      FROM operasi o
      LEFT JOIN laporan_operasi lo ON o.no_rawat = lo.no_rawat AND o.tgl_operasi = lo.tanggal
      WHERE 1=1 ${dcFilter}
    `, dcParams) as any;

    return res.json({
      hari_ini: { total: Number(hariIni?.total || 0), sudah_laporan: Number(hariIni?.sudah_laporan || 0), belum_laporan: Number(hariIni?.belum_laporan || 0) },
      bulan_ini: { total: Number(bulanIni?.total || 0), sudah_laporan: Number(bulanIni?.sudah_laporan || 0), belum_laporan: Number(bulanIni?.belum_laporan || 0) },
      tahun_ini: { total: Number(tahunIni?.total || 0), sudah_laporan: Number(tahunIni?.sudah_laporan || 0), belum_laporan: Number(tahunIni?.belum_laporan || 0) },
      total_keseluruhan: { total: Number(totalKeseluruhan?.total || 0), sudah_laporan: Number(totalKeseluruhan?.sudah_laporan || 0), belum_laporan: Number(totalKeseluruhan?.belum_laporan || 0) },
    });
  } catch (error) {
    console.error("Doctor operasi stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/doctor-top-obat", authenticate, async (req: AuthRequest, res) => {
  try {
    const dc = await getDoctorCode(req);
    if (!dc) return res.json([]);

    const [rows] = await pool.execute(`
      SELECT d.nama_brng, SUM(rd.jml) AS total, COUNT(*) AS frekuensi
      FROM resep_dokter rd
      JOIN databarang d ON rd.kode_brng = d.kode_brng
      JOIN resep_obat ro ON rd.no_resep = ro.no_resep
      JOIN reg_periksa rp ON ro.no_rawat = rp.no_rawat
      WHERE (rp.kd_dokter = ? OR EXISTS (SELECT 1 FROM dpjp_ranap dp WHERE dp.no_rawat = rp.no_rawat AND dp.kd_dokter = ?))
      GROUP BY rd.kode_brng
      ORDER BY total DESC
      LIMIT 10
    `, [dc, dc]);

    return res.json(rows);
  } catch (error) {
    console.error("Doctor top obat error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Keep original system-wide endpoints for admin
router.get("/stats", authenticate, async (_req, res) => {
  try {
    const [[{ total_pasien }]] = await pool.execute("SELECT COUNT(*) as total_pasien FROM pasien") as any;
    const [[{ total_dokter }]] = await pool.execute("SELECT COUNT(*) as total_dokter FROM dokter") as any;
    const [[{ total_ralan }]] = await pool.execute("SELECT COUNT(*) as total_ralan FROM reg_periksa WHERE status_lanjut = 'Ralan'") as any;
    const [[{ total_ranap }]] = await pool.execute("SELECT COUNT(*) as total_ranap FROM reg_periksa WHERE status_lanjut = 'Ranap'") as any;
    return res.json({ total_pasien, total_dokter, total_ralan, total_ranap });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/charts/monthly-visits", authenticate, async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DATE_FORMAT(tgl_registrasi, '%Y-%m') as bulan,
             SUM(status_lanjut = 'Ralan') as ralan,
             SUM(status_lanjut = 'Ranap') as ranap
      FROM reg_periksa
      WHERE tgl_registrasi >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(tgl_registrasi, '%Y-%m')
      ORDER BY bulan ASC
    `);
    return res.json(rows);
  } catch (error) {
    console.error("Monthly visits error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/charts/weekly-trend", authenticate, async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DATE_FORMAT(tgl_registrasi, '%Y-%m-%d') as tanggal, COUNT(*) as total
      FROM reg_periksa
      WHERE tgl_registrasi >= DATE_SUB(NOW(), INTERVAL 4 WEEK)
      GROUP BY DATE_FORMAT(tgl_registrasi, '%Y-%m-%d')
      ORDER BY tanggal ASC
    `);
    return res.json(rows);
  } catch (error) {
    console.error("Weekly trend error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/charts/service-metrics", authenticate, async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 'Ralan' as label, COUNT(*) as total,
             COUNT(DISTINCT kd_dokter) as dokter_aktif,
             COUNT(DISTINCT kd_poli) as poli_aktif
      FROM reg_periksa WHERE status_lanjut = 'Ralan'
      UNION ALL
      SELECT 'Ranap' as label, COUNT(*) as total,
             COUNT(DISTINCT kd_dokter) as dokter_aktif,
             COUNT(DISTINCT kd_poli) as poli_aktif
      FROM reg_periksa WHERE status_lanjut = 'Ranap'
    `);
    return res.json(rows);
  } catch (error) {
    console.error("Service metrics error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/charts/cumulative-registrations", authenticate, async (_req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DATE_FORMAT(tgl_registrasi, '%Y-%m-%d') as tanggal, COUNT(*) as daily
      FROM reg_periksa
      WHERE tgl_registrasi >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE_FORMAT(tgl_registrasi, '%Y-%m-%d')
      ORDER BY tanggal ASC
    `);
    return res.json(rows);
  } catch (error) {
    console.error("Cumulative error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;