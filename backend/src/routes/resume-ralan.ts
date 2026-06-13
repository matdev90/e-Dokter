import { Router } from "express";
import { pool } from "../db";
import { authenticate, AuthRequest, logAudit } from "../middleware/auth";

const router = Router();

router.get("/search-visit", authenticate, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;
    const tgl_from = (req.query.tgl_from as string) || "";
    const tgl_to = (req.query.tgl_to as string) || "";
    const kd_pj = (req.query.kd_pj as string) || "";
    const poli = (req.query.poli as string) || "";

    let whereClause = "WHERE rp.status_lanjut = 'Ralan'";
    const params: any[] = [];

    const [drRows] = await pool.execute(
      "SELECT doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const dr = (drRows as any[])[0];
    if (dr?.doctor_code) {
      whereClause += " AND rp.kd_dokter = ?";
      params.push(dr.doctor_code);

      // Filter by jadwal praktik: only show visits where the doctor
      // has a schedule on that day-of-week at that poli.
      // If no jadwal records exist for this doctor, skip the filter.
      whereClause += ` AND (
        NOT EXISTS (SELECT 1 FROM jadwal WHERE kd_dokter = ?)
        OR EXISTS (
          SELECT 1 FROM jadwal j
          WHERE j.kd_dokter = rp.kd_dokter
            AND j.hari_kerja = ELT(DAYOFWEEK(rp.tgl_registrasi), 'AKHAD','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU')
            AND j.kd_poli = rp.kd_poli
        )
      )`;
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
    if (poli) {
      whereClause += " AND rp.kd_poli = ?";
      params.push(poli);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM reg_periksa rp
       JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
       LEFT JOIN poliklinik pl ON rp.kd_poli = pl.kd_poli
       ${whereClause}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT rp.no_rawat, rp.tgl_registrasi, rp.jam_reg, rp.no_rkm_medis,
               p.nm_pasien, p.alamat, d.nm_dokter, rp.kd_poli, rp.status_lanjut,
               rp.stts, rp.status_bayar, pl.nm_poli,
              CASE WHEN res.no_rawat IS NOT NULL THEN 1 ELSE 0 END as has_resume,
              (EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat)) AS has_operasi,
               (EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat AND laporan_operasi IS NOT NULL AND laporan_operasi != '') AND EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat)) AS has_laporan_operasi,
              (EXISTS (SELECT 1 FROM booking_operasi WHERE no_rawat = rp.no_rawat)) AS has_booking_operasi,
              (SELECT CONCAT(tanggal, '|', jam_mulai, '|', status) FROM booking_operasi WHERE no_rawat = rp.no_rawat ORDER BY tanggal DESC, jam_mulai DESC LIMIT 1) AS booking_info
       FROM reg_periksa rp
       JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
       LEFT JOIN poliklinik pl ON rp.kd_poli = pl.kd_poli
       LEFT JOIN resume_pasien res ON rp.no_rawat = res.no_rawat
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
      `SELECT rp.*, p.nm_pasien, p.no_ktp, p.tgl_lahir, p.jk, d.nm_dokter
       FROM resume_pasien rp
       LEFT JOIN reg_periksa reg ON rp.no_rawat = reg.no_rawat
       LEFT JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
       LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
       WHERE rp.no_rawat = ?`,
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
      no_rawat, keluhan_utama, pemeriksaan_penunjang, hasil_laborat,
      diagnosa_utama, kd_diagnosa_utama, diagnosa_sekunder, kd_diagnosa_sekunder,
      diagnosa_sekunder2, kd_diagnosa_sekunder2, diagnosa_sekunder3, kd_diagnosa_sekunder3,
      diagnosa_sekunder4, kd_diagnosa_sekunder4, prosedur_utama, kd_prosedur_utama,
      prosedur_sekunder, kd_prosedur_sekunder, prosedur_sekunder2, kd_prosedur_sekunder2,
      prosedur_sekunder3, kd_prosedur_sekunder3, kondisi_pulang, obat_pulang,
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

    await pool.execute(
      `INSERT INTO resume_pasien (
        no_rawat, kd_dokter, keluhan_utama, pemeriksaan_penunjang, hasil_laborat,
        diagnosa_utama, kd_diagnosa_utama, diagnosa_sekunder, kd_diagnosa_sekunder,
        diagnosa_sekunder2, kd_diagnosa_sekunder2, diagnosa_sekunder3, kd_diagnosa_sekunder3,
        diagnosa_sekunder4, kd_diagnosa_sekunder4, prosedur_utama, kd_prosedur_utama,
        prosedur_sekunder, kd_prosedur_sekunder, prosedur_sekunder2, kd_prosedur_sekunder2,
        prosedur_sekunder3, kd_prosedur_sekunder3, kondisi_pulang, obat_pulang
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        no_rawat, kd_dokter, keluhan_utama, pemeriksaan_penunjang, hasil_laborat,
        diagnosa_utama, kd_diagnosa_utama, diagnosa_sekunder, kd_diagnosa_sekunder,
        diagnosa_sekunder2, kd_diagnosa_sekunder2, diagnosa_sekunder3, kd_diagnosa_sekunder3,
        diagnosa_sekunder4, kd_diagnosa_sekunder4, prosedur_utama, kd_prosedur_utama,
        prosedur_sekunder, kd_prosedur_sekunder, prosedur_sekunder2, kd_prosedur_sekunder2,
        prosedur_sekunder3, kd_prosedur_sekunder3, kondisi_pulang, obat_pulang,
      ]
    );

    const [created] = await pool.execute(
      "SELECT * FROM resume_pasien WHERE no_rawat = ?",
      [no_rawat]
    );

    await logAudit({
      userId: req.user!.id,
      action: "create_resume",
      entityType: "resume_pasien",
      entityId: no_rawat,
      details: "Created resume pasien",
      ipAddress: req.ip,
    });

    return res.status(201).json((created as any[])[0]);
  } catch (error) {
    console.error("Create resume error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:no_rawat", authenticate, async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.params.no_rawat;

    const [existing] = await pool.execute(
      "SELECT * FROM resume_pasien WHERE no_rawat = ?",
      [no_rawat]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const allowedFields = [
      "keluhan_utama", "pemeriksaan_penunjang", "hasil_laborat",
      "diagnosa_utama", "kd_diagnosa_utama", "diagnosa_sekunder", "kd_diagnosa_sekunder",
      "diagnosa_sekunder2", "kd_diagnosa_sekunder2", "diagnosa_sekunder3", "kd_diagnosa_sekunder3",
      "diagnosa_sekunder4", "kd_diagnosa_sekunder4", "prosedur_utama", "kd_prosedur_utama",
      "prosedur_sekunder", "kd_prosedur_sekunder", "prosedur_sekunder2", "kd_prosedur_sekunder2",
      "prosedur_sekunder3", "kd_prosedur_sekunder3", "kondisi_pulang", "obat_pulang",
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
      `UPDATE resume_pasien SET ${sets.join(", ")} WHERE no_rawat = ?`,
      params
    );

    const [updated] = await pool.execute(
      "SELECT * FROM resume_pasien WHERE no_rawat = ?",
      [no_rawat]
    );

    await logAudit({
      userId: req.user!.id,
      action: "update_resume",
      entityType: "resume_pasien",
      entityId: no_rawat,
      details: "Updated resume pasien",
      ipAddress: req.ip,
    });

    return res.json((updated as any[])[0]);
  } catch (error) {
    console.error("Update resume error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auto-fill/:no_rawat", authenticate, async (req: AuthRequest, res) => {
  try {
    const { no_rawat } = req.params;
    const result: any = {};

    // 1. Keluhan Utama — try penilaian_medis_igd, then penilaian_medis_ralan, then pemeriksaan_ralan
    const [igdRows] = await pool.execute(
      `SELECT CONCAT(keluhan_utama, '\n', ket_fisik, '\n', 'TD: ', td, ', Nadi: ', nadi, ', Suhu: ', suhu, ', Respirasi: ', rr) AS val
       FROM penilaian_medis_igd WHERE no_rawat = ?`,
      [no_rawat]
    );
    let igdVal = (igdRows as any[])[0]?.val;
    if (igdVal) result.keluhan_utama = igdVal;

    if (!igdVal) {
      const [ralanRows] = await pool.execute(
        `SELECT CONCAT(keluhan_utama, '\n', ket_fisik, '\n', 'TD: ', td, ', N: ', nadi, ', Suhu: ', suhu, ', Respirasi: ', rr) AS val
         FROM penilaian_medis_ralan WHERE no_rawat = ?`,
        [no_rawat]
      );
      const ralanVal = (ralanRows as any[])[0]?.val;
      if (ralanVal) result.keluhan_utama = ralanVal;

      if (!ralanVal) {
        const [perikRows] = await pool.execute(
          `SELECT CONCAT(keluhan, '\n', pemeriksaan, '\n', 'Tensi: ', tensi, ', Nadi: ', nadi, ', Suhu: ', suhu_tubuh, ', Respirasi: ', respirasi) AS val
           FROM pemeriksaan_ralan WHERE no_rawat = ? ORDER BY tgl_perawatan DESC, jam_rawat DESC LIMIT 1`,
          [no_rawat]
        );
        const perikVal = (perikRows as any[])[0]?.val;
        if (perikVal) result.keluhan_utama = perikVal;
      }
    }

    // 2. Pemeriksaan Penunjang — from hasil_radiologi + periksa_radiologi + jns_perawatan_radiologi
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

    // 3. Hasil Laborat
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

    // 4. Diagnosa utama from pemeriksaan_ralan.penilaian
    const [penRows] = await pool.execute(
      `SELECT penilaian FROM pemeriksaan_ralan WHERE no_rawat = ? ORDER BY tgl_perawatan DESC, jam_rawat DESC LIMIT 1`,
      [no_rawat]
    );
    const penilaian = (penRows as any[])[0]?.penilaian;
    if (penilaian) result.diagnosa_utama = penilaian;

    // 5. Diagnosa Pasien (prioritas 1-5 → utama + sekunder 1-4)
    const [diagRows] = await pool.execute(
      `SELECT diagnosa_pasien.kd_penyakit, penyakit.nm_penyakit, diagnosa_pasien.prioritas
       FROM diagnosa_pasien
       INNER JOIN penyakit ON diagnosa_pasien.kd_penyakit = penyakit.kd_penyakit
       WHERE diagnosa_pasien.no_rawat = ? AND diagnosa_pasien.status = 'Ralan'
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

    // 6. Prosedur Pasien (prioritas 1-4 → utama + sekunder 1-3)
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

    // 7. Obat Pulang
    const [obatRows] = await pool.execute(
      `SELECT CONCAT(databarang.nama_brng, ' : ', resep_dokter.jml, ' - ', resep_dokter.aturan_pakai) AS val
       FROM resep_obat
       INNER JOIN resep_dokter ON resep_obat.no_resep = resep_dokter.no_resep
       INNER JOIN databarang ON databarang.kode_brng = resep_dokter.kode_brng
       WHERE resep_obat.no_rawat = ?
       ORDER BY resep_obat.tgl_perawatan, resep_obat.jam`,
      [no_rawat]
    );
    const obatVals = (obatRows as any[]).map((r: any) => r.val).filter(Boolean);
    if (obatVals.length > 0) result.obat_pulang = obatVals.join("\n");

    return res.json(result);
  } catch (error) {
    console.error("Auto-fill error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const [drRows] = await pool.execute(
      "SELECT doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const dr = (drRows as any[])[0];
    const doctorCode = dr?.doctor_code;

    let whereClause = "WHERE rp.status_lanjut = 'Ralan' AND rp.tgl_registrasi = CURDATE()";
    const params: any[] = [];

    if (doctorCode) {
      whereClause += " AND rp.kd_dokter = ?";
      params.push(doctorCode);
      whereClause += ` AND (
        NOT EXISTS (SELECT 1 FROM jadwal WHERE kd_dokter = ?)
        OR EXISTS (
          SELECT 1 FROM jadwal j
          WHERE j.kd_dokter = rp.kd_dokter
            AND j.hari_kerja = ELT(DAYOFWEEK(rp.tgl_registrasi), 'AKHAD','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU')
            AND j.kd_poli = rp.kd_poli
        )
      )`;
      params.push(doctorCode);
    }

    const [rows] = await pool.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pj.png_jawab LIKE '%BPJS%' THEN 1 ELSE 0 END) AS bpjs,
        SUM(CASE WHEN pj.png_jawab NOT LIKE '%BPJS%' OR pj.png_jawab IS NULL THEN 1 ELSE 0 END) AS umum,
        SUM(CASE WHEN res.no_rawat IS NOT NULL THEN 1 ELSE 0 END) AS sudah_resume,
        SUM(CASE WHEN res.no_rawat IS NULL THEN 1 ELSE 0 END) AS belum_resume,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat) THEN 1 ELSE 0 END) AS laporan_operasi,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM operasi WHERE no_rawat = rp.no_rawat) AND NOT EXISTS (SELECT 1 FROM laporan_operasi WHERE no_rawat = rp.no_rawat) THEN 1 ELSE 0 END) AS belum_laporan_operasi
      FROM reg_periksa rp
      JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
      LEFT JOIN resume_pasien res ON rp.no_rawat = res.no_rawat
      ${whereClause}`,
      params
    );

    const r = (rows as any[])[0] || {};
    return res.json({
      total: Number(r.total || 0),
      bpjs: Number(r.bpjs || 0),
      umum: Number(r.umum || 0),
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

router.get("/poliklinik", authenticate, async (req: AuthRequest, res) => {
  try {
    const [drRows] = await pool.execute(
      "SELECT doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const dr = (drRows as any[])[0];
    const doctorCode = dr?.doctor_code;

    if (doctorCode) {
      const [jadwalRows] = await pool.execute(
        `SELECT DISTINCT p.kd_poli, p.nm_poli
         FROM jadwal j
         JOIN poliklinik p ON j.kd_poli = p.kd_poli
         WHERE j.kd_dokter = ?
         ORDER BY p.nm_poli`,
        [doctorCode]
      );
      const list = jadwalRows as any[];
      if (list.length > 0) return res.json(list);
    }

    const [rows] = await pool.execute(
      "SELECT kd_poli, nm_poli FROM poliklinik WHERE status = '1' ORDER BY nm_poli"
    );
    return res.json(rows);
  } catch (error) {
    console.error("Get poliklinik error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/current-jadwal", authenticate, async (req: AuthRequest, res) => {
  try {
    const [drRows] = await pool.execute(
      "SELECT doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const dr = (drRows as any[])[0];
    if (!dr?.doctor_code) return res.json(null);

    const [todayRows] = await pool.execute(
      `SELECT j.kd_poli, p.nm_poli, j.hari_kerja, j.jam_mulai, j.jam_selesai
       FROM jadwal j
       JOIN poliklinik p ON j.kd_poli = p.kd_poli
       WHERE j.kd_dokter = ?
         AND j.hari_kerja = ELT(DAYOFWEEK(CURDATE()), 'AKHAD','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU')
       ORDER BY j.jam_mulai
       LIMIT 1`,
      [dr.doctor_code]
    );
    const today = (todayRows as any[])[0];
    if (!today) return res.json(null);

    const [activeRows] = await pool.execute(
      `SELECT j.kd_poli, p.nm_poli, j.hari_kerja, j.jam_mulai, j.jam_selesai
       FROM jadwal j
       JOIN poliklinik p ON j.kd_poli = p.kd_poli
       WHERE j.kd_dokter = ?
         AND j.hari_kerja = ELT(DAYOFWEEK(CURDATE()), 'AKHAD','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU')
         AND CURTIME() >= j.jam_mulai
         AND CURTIME() <= j.jam_selesai
       ORDER BY j.jam_mulai
       LIMIT 1`,
      [dr.doctor_code]
    );
    const active = (activeRows as any[])[0] || null;

    return res.json({
      kd_poli: today.kd_poli,
      nm_poli: today.nm_poli,
      jam_mulai: today.jam_mulai,
      jam_selesai: today.jam_selesai,
      hari_kerja: today.hari_kerja,
      locked: !!active,
    });
  } catch (error) {
    console.error("Current jadwal error:", error);
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
