import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest, logAudit } from "../middleware/auth";

const router = Router();

router.get("/stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const [drRows] = await pool.execute(
      "SELECT doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const dr = (drRows as any[])[0];

    let whereClause = "WHERE rp.status_lanjut = 'Ranap' AND DATE_FORMAT(rp.tgl_registrasi, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
    const params: any[] = [];

    if (dr?.doctor_code) {
      whereClause += " AND EXISTS (SELECT 1 FROM dpjp_ranap dp WHERE dp.no_rawat = rp.no_rawat AND dp.kd_dokter = ?)";
      params.push(dr.doctor_code);
    }

    const [rows] = await pool.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pj.png_jawab LIKE '%BPJS%' THEN 1 ELSE 0 END) AS bpjs,
        SUM(CASE WHEN pj.png_jawab NOT LIKE '%BPJS%' AND pj.png_jawab IS NOT NULL AND pj.png_jawab != '-' THEN 1 ELSE 0 END) AS umum,
        SUM(CASE WHEN res.no_rawat IS NOT NULL THEN 1 ELSE 0 END) AS sudah_resume,
        SUM(CASE WHEN res.no_rawat IS NULL THEN 1 ELSE 0 END) AS belum_resume,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat) THEN 1 ELSE 0 END) AS laporan_operasi,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat) AND NOT EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat) THEN 1 ELSE 0 END) AS belum_laporan_operasi
      FROM reg_periksa rp
      JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
      LEFT JOIN resume_pasien_ranap res ON rp.no_rawat = res.no_rawat
      ${whereClause}`,
      params
    );

    const r = (rows as any[])[0] || {};
    return res.json({
      total: Number(r.total || 0),
      bpjs: Number(r.bpjs || 0),
      umum: Number(r.umum || 0),
      bpjs_umum: Number(r.bpjs || 0) + Number(r.umum || 0),
      sudah_resume: Number(r.sudah_resume || 0),
      belum_resume: Number(r.belum_resume || 0),
      laporan_operasi: Number(r.laporan_operasi || 0),
      belum_laporan_operasi: Number(r.belum_laporan_operasi || 0),
    });
  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search-visit", authenticate, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;
    const tgl_from = (req.query.tgl_from as string) || "";
    const tgl_to = (req.query.tgl_to as string) || "";
    const kd_pj = (req.query.kd_pj as string) || "";
    const ruangan = (req.query.ruangan as string) || "";

    let whereClause = "WHERE rp.status_lanjut = 'Ranap'";
    const params: any[] = [];

    if (!tgl_from && !tgl_to) {
      whereClause += " AND DATE_FORMAT(rp.tgl_registrasi, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
    }

    const [drRows] = await pool.execute(
      "SELECT doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const dr = (drRows as any[])[0];
    if (dr?.doctor_code) {
      whereClause += " AND EXISTS (SELECT 1 FROM dpjp_ranap dp WHERE dp.no_rawat = rp.no_rawat AND dp.kd_dokter = ?)";
      params.push(dr.doctor_code);
    }

    if (q) {
      whereClause += " AND (p.nm_pasien LIKE ? OR rp.no_rkm_medis LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    if (tgl_from) {
      whereClause += " AND rp.tgl_registrasi >= ?";
      params.push(tgl_from);
    }
    if (tgl_to) {
      whereClause += " AND rp.tgl_registrasi <= ?";
      params.push(tgl_to);
    }
    if (kd_pj) {
      whereClause += " AND rp.kd_pj = ?";
      params.push(kd_pj);
    }
    if (ruangan) {
      whereClause += " AND latest_kamar.kd_kamar = ?";
      params.push(ruangan);
    }

    const kamarSubquery = `(
      SELECT ki.no_rawat, k.kd_kamar, CONCAT(k.kd_kamar, ' - ', b.nm_bangsal) AS nm_kamar,
             ki.tgl_keluar
      FROM kamar_inap ki
      JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      WHERE (ki.no_rawat, CONCAT(ki.tgl_masuk, ' ', ki.jam_masuk)) IN (
        SELECT no_rawat, MAX(CONCAT(tgl_masuk, ' ', jam_masuk))
        FROM kamar_inap
        GROUP BY no_rawat
      )
    ) latest_kamar`;

    const kamarJoin = ruangan
      ? `JOIN ${kamarSubquery} ON rp.no_rawat = latest_kamar.no_rawat`
      : `LEFT JOIN ${kamarSubquery} ON rp.no_rawat = latest_kamar.no_rawat`;

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM reg_periksa rp
       JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
       LEFT JOIN resume_pasien_ranap res ON rp.no_rawat = res.no_rawat
       ${kamarJoin}
       ${whereClause}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT rp.no_rawat, rp.tgl_registrasi, rp.jam_reg, rp.no_rkm_medis,
               p.nm_pasien, p.alamat, d.nm_dokter, rp.kd_poli, rp.status_lanjut,
               rp.stts, rp.status_bayar,
              latest_kamar.kd_kamar, latest_kamar.nm_kamar AS nm_bangsal,
              CASE WHEN res.no_rawat IS NOT NULL THEN 1 ELSE 0 END as has_resume,
              (EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat)) AS has_operasi,
               (EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat AND laporan_operasi IS NOT NULL AND laporan_operasi != '') AND EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat)) AS has_laporan_operasi,
              (EXISTS (SELECT 1 FROM booking_operasi WHERE no_rawat = rp.no_rawat)) AS has_booking_operasi,
              (SELECT CONCAT(tanggal, '|', jam_mulai, '|', status) FROM booking_operasi WHERE no_rawat = rp.no_rawat ORDER BY tanggal DESC, jam_mulai DESC LIMIT 1) AS booking_info
       FROM reg_periksa rp
       JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
       ${kamarJoin}
       LEFT JOIN resume_pasien_ranap res ON rp.no_rawat = res.no_rawat
       ${whereClause}
        ORDER BY rp.tgl_registrasi DESC, rp.jam_reg DESC
       LIMIT ? OFFSET ?`,
      [...params, String(limit), String(offset)]
    );

    return res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Search visit error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/by-visit/:no_rawat", authenticate, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, reg.kd_dokter, p.nm_pasien, p.no_ktp, p.tgl_lahir, p.jk, d.nm_dokter as nm_dokter_ranap
       FROM resume_pasien_ranap r
       LEFT JOIN reg_periksa reg ON r.no_rawat = reg.no_rawat
       LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
       WHERE r.no_rawat = ?`,
      [req.params.no_rawat]
    );

    const recs = rows as any[];
    if (recs.length === 0) {
      return res.status(404).json({ error: "Resume not found" });
    }

    return res.json(recs[0]);
  } catch (error) {
    console.error("Get resume error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      no_rawat, diagnosa_awal, alasan, keluhan_utama,
      pemeriksaan_fisik, jalannya_penyakit, pemeriksaan_penunjang,
      hasil_laborat, diagnosa_utama, kd_diagnosa_utama,
      diagnosa_sekunder, kd_diagnosa_sekunder, diagnosa_sekunder2, kd_diagnosa_sekunder2,
      diagnosa_sekunder3, kd_diagnosa_sekunder3, diagnosa_sekunder4, kd_diagnosa_sekunder4,
      prosedur_utama, kd_prosedur_utama, prosedur_sekunder, kd_prosedur_sekunder,
      prosedur_sekunder2, kd_prosedur_sekunder2, prosedur_sekunder3, kd_prosedur_sekunder3,
      tindakan_dan_operasi, obat_di_rs, edukasi, cara_keluar,
      ket_keluar, keadaan, ket_keadaan, dilanjutkan, ket_dilanjutkan,
      kontrol, alergi, diet, lab_belum, obat_pulang,
    } = req.body;

    if (!no_rawat) {
      return res.status(400).json({ error: "no_rawat is required" });
    }

    const [visitRows] = await pool.execute(
      "SELECT no_rawat FROM reg_periksa WHERE no_rawat = ?",
      [no_rawat]
    );
    if ((visitRows as any[]).length === 0) {
      return res.status(400).json({ error: "Visit not found" });
    }

    const [drRows] = await pool.execute(
      "SELECT doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const dr = (drRows as any[])[0];
    const kd_dokter = dr?.doctor_code || null;

    const nullableFields = new Set(["ket_keluar", "ket_keadaan", "ket_dilanjutkan", "kontrol"]);
    const toValue = (key: string, val: any) =>
      val !== undefined ? val : (nullableFields.has(key) ? null : "");

    const values = [
      toValue("no_rawat", no_rawat), toValue("kd_dokter", kd_dokter),
      toValue("diagnosa_awal", diagnosa_awal), toValue("alasan", alasan),
      toValue("keluhan_utama", keluhan_utama), toValue("pemeriksaan_fisik", pemeriksaan_fisik),
      toValue("jalannya_penyakit", jalannya_penyakit),
      toValue("pemeriksaan_penunjang", pemeriksaan_penunjang),
      toValue("hasil_laborat", hasil_laborat), toValue("diagnosa_utama", diagnosa_utama),
      toValue("kd_diagnosa_utama", kd_diagnosa_utama),
      toValue("diagnosa_sekunder", diagnosa_sekunder),
      toValue("kd_diagnosa_sekunder", kd_diagnosa_sekunder),
      toValue("diagnosa_sekunder2", diagnosa_sekunder2),
      toValue("kd_diagnosa_sekunder2", kd_diagnosa_sekunder2),
      toValue("diagnosa_sekunder3", diagnosa_sekunder3),
      toValue("kd_diagnosa_sekunder3", kd_diagnosa_sekunder3),
      toValue("diagnosa_sekunder4", diagnosa_sekunder4),
      toValue("kd_diagnosa_sekunder4", kd_diagnosa_sekunder4),
      toValue("prosedur_utama", prosedur_utama),
      toValue("kd_prosedur_utama", kd_prosedur_utama),
      toValue("prosedur_sekunder", prosedur_sekunder),
      toValue("kd_prosedur_sekunder", kd_prosedur_sekunder),
      toValue("prosedur_sekunder2", prosedur_sekunder2),
      toValue("kd_prosedur_sekunder2", kd_prosedur_sekunder2),
      toValue("prosedur_sekunder3", prosedur_sekunder3),
      toValue("kd_prosedur_sekunder3", kd_prosedur_sekunder3),
      toValue("tindakan_dan_operasi", tindakan_dan_operasi),
      toValue("obat_di_rs", obat_di_rs), toValue("edukasi", edukasi),
      toValue("cara_keluar", cara_keluar), toValue("ket_keluar", ket_keluar),
      toValue("keadaan", keadaan), toValue("ket_keadaan", ket_keadaan),
      toValue("dilanjutkan", dilanjutkan), toValue("ket_dilanjutkan", ket_dilanjutkan),
      toValue("kontrol", kontrol), toValue("alergi", alergi),
      toValue("diet", diet), toValue("lab_belum", lab_belum),
      toValue("obat_pulang", obat_pulang),
    ];

    await pool.execute(
      `INSERT INTO resume_pasien_ranap (
        no_rawat, kd_dokter, diagnosa_awal, alasan, keluhan_utama,
        pemeriksaan_fisik, jalannya_penyakit, pemeriksaan_penunjang,
        hasil_laborat, diagnosa_utama, kd_diagnosa_utama,
        diagnosa_sekunder, kd_diagnosa_sekunder, diagnosa_sekunder2, kd_diagnosa_sekunder2,
        diagnosa_sekunder3, kd_diagnosa_sekunder3, diagnosa_sekunder4, kd_diagnosa_sekunder4,
        prosedur_utama, kd_prosedur_utama, prosedur_sekunder, kd_prosedur_sekunder,
        prosedur_sekunder2, kd_prosedur_sekunder2, prosedur_sekunder3, kd_prosedur_sekunder3,
        tindakan_dan_operasi, obat_di_rs, edukasi, cara_keluar,
        ket_keluar, keadaan, ket_keadaan, dilanjutkan, ket_dilanjutkan,
        kontrol, alergi, diet, lab_belum, obat_pulang
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );

    const [created] = await pool.execute(
      "SELECT * FROM resume_pasien_ranap WHERE no_rawat = ?",
      [no_rawat]
    );

    await logAudit({
      userId: req.user!.id,
      action: "create_resume",
      entityType: "resume_pasien_ranap",
      entityId: no_rawat,
      details: "Created resume pasien ranap",
      ipAddress: req.ip,
    });

    return res.status(201).json((created as any[])[0]);
  } catch (error) {
    console.error("Create resume ranap error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:no_rawat", authenticate, async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.params.no_rawat;

    const [existing] = await pool.execute(
      "SELECT * FROM resume_pasien_ranap WHERE no_rawat = ?",
      [no_rawat]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const allowedFields = [
      "diagnosa_awal", "alasan", "keluhan_utama",
      "pemeriksaan_fisik", "jalannya_penyakit", "pemeriksaan_penunjang",
      "hasil_laborat", "diagnosa_utama", "kd_diagnosa_utama",
      "diagnosa_sekunder", "kd_diagnosa_sekunder", "diagnosa_sekunder2", "kd_diagnosa_sekunder2",
      "diagnosa_sekunder3", "kd_diagnosa_sekunder3", "diagnosa_sekunder4", "kd_diagnosa_sekunder4",
      "prosedur_utama", "kd_prosedur_utama", "prosedur_sekunder", "kd_prosedur_sekunder",
      "prosedur_sekunder2", "kd_prosedur_sekunder2", "prosedur_sekunder3", "kd_prosedur_sekunder3",
      "tindakan_dan_operasi", "obat_di_rs", "edukasi", "cara_keluar",
      "ket_keluar", "keadaan", "ket_keadaan", "dilanjutkan", "ket_dilanjutkan",
      "kontrol", "alergi", "diet", "lab_belum", "obat_pulang",
    ];

    const sets: string[] = [];
    const params: any[] = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        sets.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(no_rawat);

    await pool.execute(
      `UPDATE resume_pasien_ranap SET ${sets.join(", ")} WHERE no_rawat = ?`,
      params
    );

    const [updated] = await pool.execute(
      "SELECT * FROM resume_pasien_ranap WHERE no_rawat = ?",
      [no_rawat]
    );

    await logAudit({
      userId: req.user!.id,
      action: "update_resume",
      entityType: "resume_pasien_ranap",
      entityId: no_rawat,
      details: "Updated resume pasien ranap",
      ipAddress: req.ip,
    });

    return res.json((updated as any[])[0]);
  } catch (error) {
    console.error("Update resume ranap error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auto-fill/:no_rawat", authenticate, async (req: AuthRequest, res) => {
  try {
    const { no_rawat } = req.params;
    const result: any = {};

    // 1. DPJP (Dokter Penanggung Jawab Pelayanan)
    const [dpjpRows] = await pool.execute(
      `SELECT dp.kd_dokter, d.nm_dokter
       FROM dpjp_ranap dp
       LEFT JOIN dokter d ON dp.kd_dokter = d.kd_dokter
       WHERE dp.no_rawat = ?
       LIMIT 1`,
      [no_rawat]
    );
    const dpjpData = (dpjpRows as any[])[0];
    if (dpjpData) {
      result.kd_dokter_dpjp = dpjpData.kd_dokter || "";
      result.nm_dokter_dpjp = dpjpData.nm_dokter || "";
    }

    // 2. Diagnosa Awal + kamar_inap info
    const [kamarRows] = await pool.execute(
      `SELECT kamar_inap.diagnosa_awal, kamar_inap.kd_kamar, bangsal.nm_bangsal,
              kamar_inap.tgl_masuk, kamar_inap.jam_masuk,
              IF(kamar_inap.tgl_keluar='0000-00-00', CURRENT_DATE(), kamar_inap.tgl_keluar) AS tgl_keluar,
              IF(kamar_inap.jam_keluar='00:00:00', CURRENT_TIME(), kamar_inap.jam_keluar) AS jam_keluar,
              reg.kd_dokter AS kd_dokter_pengirim, d.nm_dokter AS nm_dokter_pengirim
       FROM kamar_inap
       JOIN reg_periksa reg ON kamar_inap.no_rawat = reg.no_rawat
       LEFT JOIN dokter d ON reg.kd_dokter = d.kd_dokter
       JOIN kamar ON kamar_inap.kd_kamar = kamar.kd_kamar
       JOIN bangsal ON kamar.kd_bangsal = bangsal.kd_bangsal
       WHERE kamar_inap.no_rawat = ?
       ORDER BY kamar_inap.tgl_masuk DESC, kamar_inap.jam_masuk DESC
       LIMIT 1`,
      [no_rawat]
    );
    const kamarData = (kamarRows as any[])[0];
    if (kamarData) {
      result.diagnosa_awal = kamarData.diagnosa_awal || "";
      result.ruang = kamarData.kd_kamar ? `${kamarData.kd_kamar} - ${kamarData.nm_bangsal}` : "";
      result.tgl_masuk = kamarData.tgl_masuk || "";
      result.jam_masuk = kamarData.jam_masuk || "";
      result.tgl_keluar = kamarData.tgl_keluar || "";
      result.jam_keluar = kamarData.jam_keluar || "";
      result.kd_dokter_pengirim = kamarData.kd_dokter_pengirim || "";
      result.nm_dokter_pengirim = kamarData.nm_dokter_pengirim || "";
    }

    // 3. Anamnesis (keluhan_utama) & Pemeriksaan Fisik — cascade from multiple sources
    const sources = [
      // a. penilaian_medis_ranap
      () => pool.execute(
        `SELECT keluhan_utama,
                TRIM(CONCAT(
                  IF(ket_fisik IS NOT NULL AND ket_fisik != '', CONCAT(ket_fisik, '\n'), ''),
                  IF(td IS NOT NULL AND td != '', CONCAT('TD: ', td, ', N: ', nadi, ', S: ', suhu, ', RR: ', rr), '')
                )) AS pemeriksaan_fisik
         FROM penilaian_medis_ranap WHERE no_rawat = ?
         ORDER BY tanggal DESC LIMIT 1`,
        [no_rawat]
      ),
      // b. pemeriksaan_ranap
      () => pool.execute(
        `SELECT keluhan AS keluhan_utama,
                TRIM(CONCAT(
                  IF(pemeriksaan IS NOT NULL AND pemeriksaan != '', CONCAT(pemeriksaan, '\n'), ''),
                  IF(tensi IS NOT NULL AND tensi != '', CONCAT('TD: ', tensi, ', N: ', nadi, ', S: ', suhu_tubuh, ', RR: ', respirasi), '')
                )) AS pemeriksaan_fisik
         FROM pemeriksaan_ranap WHERE no_rawat = ?
         ORDER BY tgl_perawatan DESC, jam_rawat DESC LIMIT 1`,
        [no_rawat]
      ),
      // c. penilaian_medis_igd
      () => pool.execute(
        `SELECT keluhan_utama,
                TRIM(CONCAT(
                  IF(ket_fisik IS NOT NULL AND ket_fisik != '', CONCAT(ket_fisik, '\n'), ''),
                  IF(td IS NOT NULL AND td != '', CONCAT('TD: ', td, ', N: ', nadi, ', S: ', suhu, ', RR: ', rr), '')
                )) AS pemeriksaan_fisik
         FROM penilaian_medis_igd WHERE no_rawat = ?
         ORDER BY tanggal DESC LIMIT 1`,
        [no_rawat]
      ),
      // d. pemeriksaan_ralan
      () => pool.execute(
        `SELECT keluhan AS keluhan_utama,
                TRIM(CONCAT(
                  IF(pemeriksaan IS NOT NULL AND pemeriksaan != '', CONCAT(pemeriksaan, '\n'), ''),
                  IF(tensi IS NOT NULL AND tensi != '', CONCAT('TD: ', tensi, ', N: ', nadi, ', S: ', suhu_tubuh, ', RR: ', respirasi), '')
                )) AS pemeriksaan_fisik
         FROM pemeriksaan_ralan WHERE no_rawat = ?
         ORDER BY tgl_perawatan DESC, jam_rawat DESC LIMIT 1`,
        [no_rawat]
      ),
      // e. triase igd (data_triase_igdprimer + data_triase_igd)
      () => pool.execute(
        `SELECT p.keluhan_utama,
                TRIM(CONCAT(
                  IF(t.tekanan_darah IS NOT NULL AND t.tekanan_darah != '', CONCAT('TD: ', t.tekanan_darah, ', N: ', t.nadi, ', RR: ', t.pernapasan, ', S: ', t.suhu), '')
                )) AS pemeriksaan_fisik
         FROM data_triase_igdprimer p
         LEFT JOIN data_triase_igd t ON p.no_rawat = t.no_rawat
         WHERE p.no_rawat = ?
         ORDER BY p.tanggaltriase DESC LIMIT 1`,
        [no_rawat]
      ),
    ];
    // Cascade keluhan_utama from first source that has it
    for (const source of sources) {
      const [rows] = await source();
      const data = (rows as any[])[0];
      if (data?.keluhan_utama) {
        result.keluhan_utama = data.keluhan_utama;
        break;
      }
    }
    // Cascade pemeriksaan_fisik from first source that has it
    for (const source of sources) {
      const [rows] = await source();
      const data = (rows as any[])[0];
      if (data?.pemeriksaan_fisik) {
        result.pemeriksaan_fisik = data.pemeriksaan_fisik;
        break;
      }
    }

    // 4. Pemeriksaan Penunjang — from hasil_radiologi + periksa_radiologi + jns_perawatan_radiologi
    const [radRows] = await pool.execute(
      `SELECT CONCAT('Pemeriksaan: ', jns.nm_perawatan, '\nHasil: ', hr.hasil) AS val
       FROM hasil_radiologi hr
       JOIN periksa_radiologi pr ON hr.no_rawat = pr.no_rawat AND hr.tgl_periksa = pr.tgl_periksa AND hr.jam = pr.jam
       JOIN jns_perawatan_radiologi jns ON pr.kd_jenis_prw = jns.kd_jenis_prw
       WHERE hr.no_rawat = ?
       ORDER BY hr.tgl_periksa DESC, hr.jam DESC`,
      [no_rawat]
    );
    const radVals = (radRows as any[]).map((r: any) => r.val).filter(Boolean);
    if (radVals.length > 0) result.pemeriksaan_penunjang = radVals.join("\n\n---\n\n");

    // 5. Hasil Laborat
    const [labRows] = await pool.execute(
      `SELECT CONCAT(template_laboratorium.Pemeriksaan, ' : ', detail_periksa_lab.nilai,
                    IF(template_laboratorium.satuan != '' AND template_laboratorium.satuan IS NOT NULL, CONCAT(' ', template_laboratorium.satuan), ''),
                    IF(detail_periksa_lab.nilai_rujukan != '' AND detail_periksa_lab.nilai_rujukan IS NOT NULL, CONCAT(' (Rujukan: ', detail_periksa_lab.nilai_rujukan, ')'), '')
       ) AS val
       FROM detail_periksa_lab
       INNER JOIN template_laboratorium ON detail_periksa_lab.id_template = template_laboratorium.id_template
       WHERE detail_periksa_lab.no_rawat = ?
       ORDER BY template_laboratorium.Pemeriksaan, detail_periksa_lab.tgl_periksa, detail_periksa_lab.jam`,
      [no_rawat]
    );
    const labVals = (labRows as any[]).map((r: any) => r.val).filter(Boolean);
    if (labVals.length > 0) result.hasil_laborat = labVals.join("\n");

    // 6. Tindakan & Operasi — from prosedur_pasien
    const [tindakanRows] = await pool.execute(
      `SELECT CONCAT(icd9.deskripsi_panjang) AS val
       FROM prosedur_pasien
       INNER JOIN icd9 ON prosedur_pasien.kode = icd9.kode
       WHERE prosedur_pasien.no_rawat = ?
       ORDER BY prosedur_pasien.prioritas`,
      [no_rawat]
    );
    const tindakanVals = (tindakanRows as any[]).map((r: any) => r.val).filter(Boolean);
    if (tindakanVals.length > 0) result.tindakan_dan_operasi = tindakanVals.join("\n");

    // 7. Obat di RS — from resep_dokter
    const [obatRsRows] = await pool.execute(
      `SELECT CONCAT(databarang.nama_brng, ' : ', resep_dokter.jml, ' - ', resep_dokter.aturan_pakai) AS val
       FROM resep_obat
       INNER JOIN resep_dokter ON resep_obat.no_resep = resep_dokter.no_resep
       INNER JOIN databarang ON databarang.kode_brng = resep_dokter.kode_brng
       WHERE resep_obat.no_rawat = ?
       ORDER BY resep_obat.tgl_perawatan, resep_obat.jam`,
      [no_rawat]
    );
    const obatRsVals = (obatRsRows as any[]).map((r: any) => r.val).filter(Boolean);
    if (obatRsVals.length > 0) result.obat_di_rs = obatRsVals.join("\n");

    // 8. Diagnosa Pasien (prioritas 1-5)
    const [diagRows] = await pool.execute(
      `SELECT diagnosa_pasien.kd_penyakit, penyakit.nm_penyakit, diagnosa_pasien.prioritas
       FROM diagnosa_pasien
       INNER JOIN penyakit ON diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit
       WHERE diagnosa_pasien.no_rawat = ? AND diagnosa_pasien.status = 'Ranap'
       ORDER BY diagnosa_pasien.prioritas`,
      [no_rawat]
    );
    for (const d of diagRows as any[]) {
      if (d.prioritas === 1) {
        result.kd_diagnosa_utama = d.kd_penyakit;
        result.diagnosa_utama = d.nm_penyakit;
      } else if (d.prioritas === 2) {
        result.kd_diagnosa_sekunder = d.kd_penyakit;
        result.diagnosa_sekunder = d.nm_penyakit;
      } else if (d.prioritas === 3) {
        result.kd_diagnosa_sekunder2 = d.kd_penyakit;
        result.diagnosa_sekunder2 = d.nm_penyakit;
      } else if (d.prioritas === 4) {
        result.kd_diagnosa_sekunder3 = d.kd_penyakit;
        result.diagnosa_sekunder3 = d.nm_penyakit;
      } else if (d.prioritas === 5) {
        result.kd_diagnosa_sekunder4 = d.kd_penyakit;
        result.diagnosa_sekunder4 = d.nm_penyakit;
      }
    }

    // 9. Prosedur Pasien (prioritas 1-4)
    const [proRows] = await pool.execute(
      `SELECT prosedur_pasien.kode, icd9.deskripsi_panjang, prosedur_pasien.prioritas
       FROM prosedur_pasien
       INNER JOIN icd9 ON prosedur_pasien.kode = icd9.kode
       WHERE prosedur_pasien.no_rawat = ?
       ORDER BY prosedur_pasien.prioritas`,
      [no_rawat]
    );
    for (const p of proRows as any[]) {
      if (p.prioritas === 1) {
        result.kd_prosedur_utama = p.kode;
        result.prosedur_utama = p.deskripsi_panjang;
      } else if (p.prioritas === 2) {
        result.kd_prosedur_sekunder = p.kode;
        result.prosedur_sekunder = p.deskripsi_panjang;
      } else if (p.prioritas === 3) {
        result.kd_prosedur_sekunder2 = p.kode;
        result.prosedur_sekunder2 = p.deskripsi_panjang;
      } else if (p.prioritas === 4) {
        result.kd_prosedur_sekunder3 = p.kode;
        result.prosedur_sekunder3 = p.deskripsi_panjang;
      }
    }

    // 10. Obat Pulang — from resep_dokter pulang
    const [obatPlgRows] = await pool.execute(
      `SELECT CONCAT(databarang.nama_brng, ' : ', resep_dokter.jml, ' - ', resep_dokter.aturan_pakai) AS val
       FROM resep_obat
       INNER JOIN resep_dokter ON resep_obat.no_resep = resep_dokter.no_resep
       INNER JOIN databarang ON databarang.kode_brng = resep_dokter.kode_brng
       WHERE resep_obat.no_rawat = ? AND resep_obat.status = 'Pulang'
       ORDER BY resep_obat.tgl_perawatan, resep_obat.jam`,
      [no_rawat]
    );
    const obatPlgVals = (obatPlgRows as any[]).map((r: any) => r.val).filter(Boolean);
    if (obatPlgVals.length > 0) result.obat_pulang = obatPlgVals.join("\n");

    return res.json(result);
  } catch (error) {
    console.error("Auto-fill error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bangsal", authenticate, async (_req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT k.kd_kamar AS kd_bangsal, CONCAT(k.kd_kamar, ' - ', b.nm_bangsal) AS nm_bangsal FROM kamar k JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal ORDER BY k.kd_kamar"
    );
    return res.json(rows);
  } catch (error) {
    console.error("Get bangsal error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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

export default router;
