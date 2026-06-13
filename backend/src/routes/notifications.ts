import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const [drRows] = await pool.execute(
      "SELECT doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const dr = (drRows as any[])[0];
    const dc = dr?.doctor_code || "";

    // 1. Belum Resume Ralan (hari ini)
    const [[ralanRes]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM reg_periksa rp
       JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN resume_pasien res ON rp.no_rawat = res.no_rawat
       WHERE rp.status_lanjut = 'Ralan'
         AND rp.tgl_registrasi = CURDATE()
         AND rp.kd_dokter = ?
         AND res.no_rawat IS NULL`,
      [dc]
    ) as any;

    // 2. Belum Resume Ranap (bulan ini, DPJP)
    const [[ranapRes]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM reg_periksa rp
       JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
       JOIN dpjp_ranap dp ON rp.no_rawat = dp.no_rawat AND dp.kd_dokter = ?
       LEFT JOIN resume_pasien_ranap res ON rp.no_rawat = res.no_rawat
       WHERE rp.status_lanjut = 'Ranap'
         AND DATE_FORMAT(rp.tgl_registrasi, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
         AND res.no_rawat IS NULL`,
      [dc]
    ) as any;

    // 3. Operasi sudah lewat tapi belum laporan (doctor sebagai operator)
    const [opRows] = await pool.execute(
      `SELECT o.no_rawat, o.tgl_operasi, rp.no_rkm_medis, p.nm_pasien,
              d.nm_dokter AS operator
       FROM operasi o
       JOIN reg_periksa rp ON o.no_rawat = rp.no_rawat
       JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON o.operator1 = d.kd_dokter
       LEFT JOIN laporan_operasi lo ON o.no_rawat = lo.no_rawat AND o.tgl_operasi = lo.tanggal
       WHERE (o.operator1 = ? OR o.operator2 = ? OR o.operator3 = ?)
         AND o.tgl_operasi <= NOW()
         AND lo.no_rawat IS NULL
       ORDER BY o.tgl_operasi DESC
       LIMIT 20`,
      [dc, dc, dc]
    );

    return res.json({
      belum_resume_ralan: Number((ralanRes as any)?.total || 0),
      belum_resume_ranap: Number((ranapRes as any)?.total || 0),
      belum_laporan_operasi: opRows,
      total_belum_laporan_operasi: (opRows as any[]).length,
    });
  } catch (error) {
    console.error("Notifications error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
