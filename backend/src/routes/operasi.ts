import { Router } from "express";
import { pool } from "../db";
import { authenticate, authorize, AuthRequest, logAudit } from "../middleware/auth";
import fs from "node:fs";

const DEBUG_LOG = "/tmp/opencode-debug.log";
const dlog = (msg: string) => { try { fs.appendFileSync(DEBUG_LOG, `[operasi-af] ${msg}\n`); } catch {} };

const router = Router();

const BIAYA_LABELS: Record<string, string> = {
  biayaoperator1: "Biaya Operator 1",
  biayaoperator2: "Biaya Operator 2",
  biayaoperator3: "Biaya Operator 3",
  biayaasisten_operator1: "Biaya Asisten Operator 1",
  biayaasisten_operator2: "Biaya Asisten Operator 2",
  biayaasisten_operator3: "Biaya Asisten Operator 3",
  biayainstrumen: "Biaya Instrumen",
  biayadokter_anak: "Biaya Dokter Anak",
  biayaperawaat_resusitas: "Biaya Perawat Resusitas",
  biayadokter_anestesi: "Biaya Dokter Anastesi",
  biayaasisten_anestesi: "Biaya Asisten Anastesi 1",
  biayaasisten_anestesi2: "Biaya Asisten Anastesi 2",
  biayabidan: "Biaya Bidan 1",
  biayabidan2: "Biaya Bidan 2",
  biayabidan3: "Biaya Bidan 3",
  biayaperawat_luar: "Biaya Perawat Luar",
  biayaalat: "Biaya Alat",
  biayasewaok: "Biaya Sewa OK",
  akomodasi: "Akomodasi",
  bagian_rs: "Bagian RS",
  biaya_omloop: "Biaya Omloop 1",
  biaya_omloop2: "Biaya Omloop 2",
  biaya_omloop3: "Biaya Omloop 3",
  biaya_omloop4: "Biaya Omloop 4",
  biaya_omloop5: "Biaya Omloop 5",
  biayasarpras: "Biaya Sarpras",
  biaya_dokter_pjanak: "Biaya Dokter Pjanak",
  biaya_dokter_umum: "Biaya Dokter Umum",
};

async function insertBillingOperasi(conn: any, no_rawat: string, tgl_operasi: string, kodePaket: string, biayaData: Record<string, number>) {
  const nextIndexRows = await conn.execute("SELECT COALESCE(MAX(noindex), 0) + 1 AS next FROM billing WHERE no_rawat = ?", [no_rawat]);
  let idx = (nextIndexRows[0] as any[])[0]?.next || 1;

  const insertBill = async (no: string, nm_perawatan: string, biaya: number) => {
    await conn.execute(
      `INSERT INTO billing (noindex, no_rawat, tgl_byr, no, nm_perawatan, pemisah, biaya, jumlah, tambahan, totalbiaya, status)
       VALUES (?, ?, ?, ?, ?, ':', ?, 1, 0, ?, 'Operasi')`,
      [idx++, no_rawat, tgl_operasi, no, nm_perawatan, biaya, biaya]
    );
  };

  await insertBill("10. Operasi", ":", 0);

  let nmPaket = kodePaket;
  try {
    const [pkt] = await conn.execute("SELECT nm_perawatan FROM paket_operasi WHERE kode_paket = ?", [kodePaket]);
    const p = (pkt as any[])[0];
    if (p) nmPaket = p.nm_perawatan;
  } catch {}
  const spaces = "                            ";
  await insertBill(spaces, `${nmPaket} :`, 0);

  for (const [key, label] of Object.entries(BIAYA_LABELS)) {
    const val = biayaData[key] ?? 0;
    if (val > 0) {
      await insertBill(spaces, `  ${label} :`, val);
    }
  }
}

router.get("/auto-fill", authenticate, async (req: AuthRequest, res) => {
  dlog("=== auto-fill called ===");
  try {
    const no_rawat = (req.query.no_rawat || req.params[0] || "") as string;
    dlog(`no_rawat=${no_rawat} req.path=${req.path} req.url=${req.url}`);
    const result: any = {};

    // 1. Patient info from reg_periksa + pasien
    const [regRows] = await pool.execute(
      `SELECT rp.no_rawat, rp.no_rkm_medis, p.nm_pasien, rp.tgl_registrasi, rp.status_lanjut, rp.status_bayar
       FROM reg_periksa rp
       JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
       WHERE rp.no_rawat = ?
       LIMIT 1`,
      [no_rawat]
    );
    const regData = (regRows as any[])[0];
    if (regData) {
      result.no_rawat = regData.no_rawat;
      result.no_rkm_medis = regData.no_rkm_medis;
      result.nm_pasien = regData.nm_pasien;
      result.status_bayar = regData.status_bayar || "";
      if (regData.status_lanjut && !result.status) result.status = regData.status_lanjut;
    }

    // 2. Existing operasi data if any
    const [opRows] = await pool.execute(
      `SELECT * FROM operasi WHERE no_rawat = ? ORDER BY tgl_operasi DESC LIMIT 1`,
      [no_rawat]
    );
    const opData = (opRows as any[])[0];
    if (opData) {
      result.tanggal = opData.tgl_operasi;
      result.jenis_anasthesi = opData.jenis_anasthesi || "";
      result.kategori = opData.kategori || "";
      result.status = opData.status || "";
      result.operator1 = opData.operator1 || "";
      result.operator2 = opData.operator2 || "";
      result.operator3 = opData.operator3 || "";
      result.asisten_operator1 = opData.asisten_operator1 || "";
      result.asisten_operator2 = opData.asisten_operator2 || "";
      result.asisten_operator3 = opData.asisten_operator3 || "";
      result.instrumen = opData.instrumen || "";
      result.dokter_anak = opData.dokter_anak || "";
      result.perawaat_resusitas = opData.perawaat_resusitas || "";
      result.dokter_anestesi = opData.dokter_anestesi || "";
      result.asisten_anestesi = opData.asisten_anestesi || "";
      result.asisten_anestesi2 = opData.asisten_anestesi2 || "";
      result.bidan = opData.bidan || "";
      result.bidan2 = opData.bidan2 || "";
      result.bidan3 = opData.bidan3 || "";
      result.perawat_luar = opData.perawat_luar || "";
      result.omloop = opData.omloop || "";
      result.omloop2 = opData.omloop2 || "";
      result.omloop3 = opData.omloop3 || "";
      result.omloop4 = opData.omloop4 || "";
      result.omloop5 = opData.omloop5 || "";
      result.dokter_pjanak = opData.dokter_pjanak || "";
      result.dokter_umum = opData.dokter_umum || "";
      result.kode_paket = opData.kode_paket || "";
    }

    // 3. Booking operasi / jadwal operasi data if any
    try {
      const [bookRows] = await pool.execute(
        `SELECT * FROM booking_operasi WHERE no_rawat = ? ORDER BY tanggal DESC, jam_mulai DESC LIMIT 1`,
        [no_rawat]
      );
      const bookData = (bookRows as any[])[0];
      if (bookData) {
        // Resolve nama_operasi from paket_operasi via booking_operasi.kode_paket
        if (bookData.kode_paket) {
          try {
            const [pktRows] = await pool.execute(
              `SELECT nm_perawatan FROM paket_operasi WHERE kode_paket = ? LIMIT 1`,
              [bookData.kode_paket]
            );
            const pktData = (pktRows as any[])[0];
            if (pktData?.nm_perawatan) result.nama_operasi = pktData.nm_perawatan;
          } catch (_e) { /* ignore */ }
          if (!result.kode_paket) result.kode_paket = bookData.kode_paket;
        }
        if (bookData.biaya) result.biaya_operasi = bookData.biaya;
        const op1 = bookData.operator1 || bookData.kd_dokter || "";
        if (op1 && !result.operator1) result.operator1 = op1;
        if (bookData.jenis_anasthesi && !result.jenis_anasthesi) result.jenis_anasthesi = bookData.jenis_anasthesi;
        if (bookData.kategori && !result.kategori) result.kategori = bookData.kategori;
        const bd = bookData.tanggal || bookData.tgl_operasi || "";
        if (bd && !result.tanggal) {
          const dStr = bd instanceof Date ? bd.toISOString().slice(0,10) : String(bd).slice(0,10);
          const jm = bookData.jam_mulai ? String(bookData.jam_mulai).trim() : "";
          let t = "00:00:00";
          if (jm) {
            const m = jm.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
            if (m) {
              let h = parseInt(m[1]);
              if (m[4] && m[4].toUpperCase() === "PM" && h < 12) h += 12;
              if (m[4] && m[4].toUpperCase() === "AM" && h === 12) h = 0;
              t = `${String(h).padStart(2,"0")}:${m[2]}:${m[3] || "00"}`;
            } else {
              const tm = jm.match(/(\d{2}:\d{2}(?::\d{2})?)/);
              t = tm ? tm[1] : jm.slice(0,8);
            }
          }
          result.tanggal = dStr.includes("T") ? dStr : `${dStr}T${t}`;
        }
        // selesaioperasi from booking schedule
        if (!result.selesaioperasi) {
          const sd = bookData.tanggal || bookData.tgl_operasi;
          if (sd) {
            const d = sd instanceof Date ? sd.toISOString().slice(0,10) : String(sd).slice(0,10).replace(/T.*/, "");
            const js = bookData.jam_selesai ? String(bookData.jam_selesai).trim() : "";
            if (js) {
              const m = js.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
              if (m) {
                let h = parseInt(m[1]);
                if (m[4] && m[4].toUpperCase() === "PM" && h < 12) h += 12;
                if (m[4] && m[4].toUpperCase() === "AM" && h === 12) h = 0;
                result.selesaioperasi = `${d}T${String(h).padStart(2,"0")}:${m[2]}:${m[3] || "00"}`;
              } else {
                const tm = js.match(/(\d{2}:\d{2}(?::\d{2})?)/);
                result.selesaioperasi = `${d}T${tm ? tm[1] : js.slice(0,8)}`;
              }
            } else if (bookData.jam_mulai) {
              const jm = String(bookData.jam_mulai).trim();
              const m = jm.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
              if (m) {
                let h = parseInt(m[1]);
                if (m[4] && m[4].toUpperCase() === "PM" && h < 12) h += 12;
                if (m[4] && m[4].toUpperCase() === "AM" && h === 12) h = 0;
                h = Math.min(h + 2, 23);
                result.selesaioperasi = `${d}T${String(h).padStart(2,"0")}:${m[2]}:${m[3] || "00"}`;
              } else {
                const hm = jm.match(/(\d{1,2}):(\d{2})/);
                if (hm) {
                  let h = parseInt(hm[1]) + 2;
                  if (h >= 24) h = 23;
                  result.selesaioperasi = `${d}T${String(h).padStart(2,"0")}:${hm[2]}:00`;
                }
              }
            }
          }
        }
      }
    } catch (_e) {
      // booking_operasi may not exist; skip silently
    }

    // 4. Existing laporan_operasi data if any (only if operasi record also exists)
    const [lapRows] = await pool.execute(
      `SELECT l.* FROM laporan_operasi l JOIN operasi o ON l.no_rawat = o.no_rawat AND l.tanggal = o.tgl_operasi WHERE l.no_rawat = ? ORDER BY l.tanggal DESC LIMIT 1`,
      [no_rawat]
    );
    const lapData = (lapRows as any[])[0];
    if (lapData) {
      result.diagnosa_preop = lapData.diagnosa_preop || "";
      result.diagnosa_postop = lapData.diagnosa_postop || "";
      result.jaringan_dieksekusi = lapData.jaringan_dieksekusi || "";
      result.selesaioperasi = lapData.selesaioperasi || "";
      result.permintaan_pa = lapData.permintaan_pa || "";
      result.nomor_implan = lapData.nomor_implan || "";
      result.laporan_operasi = lapData.laporan_operasi || "";
    }

    // 5. Resolve doctor codes to names
    const op1 = result.operator1 != null ? String(result.operator1) : "";
    if (op1 && !op1.includes(" - ")) {
      try {
        const [dr] = await pool.execute(
          "SELECT nm_dokter FROM dokter WHERE kd_dokter = ? LIMIT 1",
          [op1]
        );
        const drData = (dr as any[])[0];
        if (drData) result.operator1_nama = drData.nm_dokter;
      } catch (_e) { /* ignore */ }
    }

    // 6. Resolve employee/petugas codes to names
    const employeeFields = ['asisten_operator1','asisten_operator2','asisten_operator3','bidan','bidan2','bidan3'];
    for (const field of employeeFields) {
      const raw = result[field];
      const val = raw != null ? String(raw) : "";
      if (val && val !== '-' && !val.includes(' - ')) {
        try {
          const [petRows] = await pool.execute(
            "SELECT nama FROM petugas WHERE nip = ? LIMIT 1",
            [val]
          );
          const petData = (petRows as any[])[0];
          if (petData) {
            result[field + '_nama'] = petData.nama;
          } else {
            const [pegRows] = await pool.execute(
              "SELECT nama FROM pegawai WHERE nik = ? LIMIT 1",
              [val]
            );
            const pegData = (pegRows as any[])[0];
            if (pegData) result[field + '_nama'] = pegData.nama;
          }
        } catch (_e) { /* ignore */ }
      }
    }

    return res.json(result);
  } catch (error: any) {
    console.error("Auto-fill operasi error:", error?.message || error);
    return res.json(result);
  }
});

router.get("/search/patient", authenticate, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    if (!q) {
      return res.status(400).json({ error: "Search query is required" });
    }
    const sq = q.replace(/[%_]/g, '\\$&'); const pattern = `%${sq}%`;
    const [rows] = await pool.execute(
      `SELECT o.no_rawat, o.tgl_operasi as tanggal, p.nm_pasien, p.no_rkm_medis
       FROM operasi o
       JOIN reg_periksa r ON o.no_rawat = r.no_rawat
       JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
       WHERE p.nm_pasien LIKE ?
       ORDER BY o.tgl_operasi DESC
       LIMIT 20`,
      [pattern]
    );
    return res.json(rows);
  } catch (error) {
    console.error("Search patient operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const search = (req.query.search as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const ruangan = (req.query.ruangan as string) || "";
    const jenis = (req.query.jenis as string) || "";
    const pj = (req.query.pj as string) || "";
    const today = new Date().toISOString().slice(0, 10);
    const tgl_from = req.query.tgl_from as string || today;
    const tgl_to = req.query.tgl_to as string || today;

    const dc = req.user!.doctor_code || "";

    const dpjpFilter = dc ? `AND EXISTS (SELECT 1 FROM dpjp_ranap dp WHERE dp.no_rawat = l.no_rawat AND dp.kd_dokter = ?)` : "";
    const dpjpParams = dc ? [dc] : [];

    const ruanganFilter = ruangan ? `AND EXISTS (SELECT 1 FROM kamar_inap ki WHERE ki.no_rawat = l.no_rawat AND ki.kd_kamar = ?)` : "";
    const ruanganParams = ruangan ? [ruangan] : [];

    const jenisFilter = jenis ? `AND rp.status_lanjut = ?` : "";
    const jenisParams = jenis ? [jenis] : [];

    const pjFilter = pj ? `AND pj.kd_pj = ?` : "";
    const pjParams = pj ? [pj] : [];

    const dateFilter = `AND DATE(l.tanggal) >= ? AND DATE(l.tanggal) <= ?`;
    const dateParams = [tgl_from, tgl_to];

    const penjabJoin = `LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj`;

    const selectFields = `l.no_rawat, l.tanggal, p.nm_pasien, p.no_rkm_medis,
      l.diagnosa_preop, l.diagnosa_postop, d.nm_dokter, o.status,
      (EXISTS (SELECT 1 FROM booking_operasi WHERE no_rawat = l.no_rawat)) AS has_booking_operasi,
      (SELECT CONCAT(tanggal, '|', jam_mulai, '|', status) FROM booking_operasi WHERE no_rawat = l.no_rawat ORDER BY tanggal DESC, jam_mulai DESC LIMIT 1) AS booking_info,
      (SELECT CONCAT(ki.kd_kamar, ' - ', b.nm_bangsal) FROM kamar_inap ki JOIN kamar k ON ki.kd_kamar = k.kd_kamar JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal WHERE ki.no_rawat = l.no_rawat ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC LIMIT 1) AS ruang_rawat,
      pj.png_jawab`;

    const regJoin = `JOIN reg_periksa rp ON l.no_rawat = rp.no_rawat ${penjabJoin}`;

    let rows: any[];
    let total: number;

    if (search) {
      const ssearch = search.replace(/[%_]/g, '\\$&'); const pattern = `%${ssearch}%`;
      const [dataRows] = await pool.execute(
        `SELECT ${selectFields}
         FROM laporan_operasi l
         JOIN operasi o ON l.no_rawat = o.no_rawat AND l.tanggal = o.tgl_operasi
         LEFT JOIN pasien p ON p.no_rkm_medis = (SELECT r.no_rkm_medis FROM reg_periksa r WHERE r.no_rawat = l.no_rawat LIMIT 1)
         LEFT JOIN dokter d ON o.operator1 = d.kd_dokter
         ${regJoin}
         WHERE p.nm_pasien LIKE ? ${dpjpFilter} ${ruanganFilter} ${jenisFilter} ${pjFilter} ${dateFilter}
         ORDER BY l.tanggal DESC
         LIMIT ? OFFSET ?`,
        [pattern, ...dpjpParams, ...ruanganParams, ...jenisParams, ...pjParams, ...dateParams, String(limit), String(offset)]
      );
      rows = dataRows as any[];

      const [countRows] = await pool.execute(
        `SELECT COUNT(*) as cnt
         FROM laporan_operasi l
         JOIN operasi o ON l.no_rawat = o.no_rawat AND l.tanggal = o.tgl_operasi
         LEFT JOIN pasien p ON p.no_rkm_medis = (SELECT r.no_rkm_medis FROM reg_periksa r WHERE r.no_rawat = l.no_rawat LIMIT 1)
         ${regJoin}
         WHERE p.nm_pasien LIKE ? ${dpjpFilter} ${ruanganFilter} ${jenisFilter} ${pjFilter} ${dateFilter}`,
        [pattern, ...dpjpParams, ...ruanganParams, ...jenisParams, ...pjParams, ...dateParams]
      );
      total = (countRows as any[])[0].cnt;
    } else {
      const [dataRows] = await pool.execute(
        `SELECT ${selectFields}
         FROM laporan_operasi l
         JOIN operasi o ON l.no_rawat = o.no_rawat AND l.tanggal = o.tgl_operasi
         LEFT JOIN pasien p ON p.no_rkm_medis = (SELECT r.no_rkm_medis FROM reg_periksa r WHERE r.no_rawat = l.no_rawat LIMIT 1)
         LEFT JOIN dokter d ON o.operator1 = d.kd_dokter
         ${regJoin}
         WHERE 1=1 ${dpjpFilter} ${ruanganFilter} ${jenisFilter} ${pjFilter} ${dateFilter}
         ORDER BY l.tanggal DESC
         LIMIT ? OFFSET ?`,
        [...dpjpParams, ...ruanganParams, ...jenisParams, ...pjParams, ...dateParams, String(limit), String(offset)]
      );
      rows = dataRows as any[];

      const [countRows] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM laporan_operasi l
         JOIN operasi o ON l.no_rawat = o.no_rawat AND l.tanggal = o.tgl_operasi
         ${regJoin}
         WHERE 1=1 ${dpjpFilter} ${ruanganFilter} ${jenisFilter} ${pjFilter} ${dateFilter}`,
        [...dpjpParams, ...ruanganParams, ...jenisParams, ...pjParams, ...dateParams]
      );
      total = (countRows as any[])[0].cnt;
    }

    const data = rows.map((r: any) => ({
      no_rawat: r.no_rawat,
      tanggal: r.tanggal,
      nm_pasien: r.nm_pasien,
      no_rkm_medis: r.no_rkm_medis,
      diagnosa_preop: r.diagnosa_preop,
      diagnosa_postop: r.diagnosa_postop,
      operator: r.nm_dokter,
      status: r.status,
      has_booking_operasi: !!r.has_booking_operasi,
      booking_info: r.booking_info || null,
      ruang_rawat: r.ruang_rawat || null,
      png_jawab: r.png_jawab || null,
    }));

    return res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List operasi error:", error);
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

router.get("/stats", authenticate, async (req: AuthRequest, res) => {
  try {
    const dc = req.user!.doctor_code || null;

    const today = new Date().toISOString().slice(0, 10);
    const tgl_from = req.query.tgl_from as string || today;
    const tgl_to = req.query.tgl_to as string || today;
    const pj = req.query.pj as string || "";

    const dcFilter = dc ? `AND (o.operator1 = ? OR o.operator2 = ? OR o.operator3 = ?)` : "";
    const dcParams = dc ? [dc, dc, dc] : [];

    const pjFilter = pj ? `AND pj.kd_pj = ?` : "";
    const pjParams = pj ? [pj] : [];

    const dateConds: string[] = [];
    if (tgl_from) dateConds.push("l.tanggal >= ?");
    if (tgl_to) dateConds.push("l.tanggal <= ?");
    const dateFilterStr = dateConds.length ? `AND ${dateConds.join(" AND ")}` : "";
    const dateParams: any[] = [];
    if (tgl_from) dateParams.push(tgl_from);
    if (tgl_to) dateParams.push(tgl_to);

    const baseQuery = `FROM laporan_operasi l
      JOIN operasi o ON l.no_rawat = o.no_rawat AND l.tanggal = o.tgl_operasi
      JOIN reg_periksa rp ON l.no_rawat = rp.no_rawat
      LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
      WHERE`;

    const [ralanRows] = await pool.execute(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN pj.png_jawab LIKE '%BPJS%' THEN 1 ELSE 0 END) AS bpjs,
        SUM(CASE WHEN pj.png_jawab NOT LIKE '%BPJS%' OR pj.png_jawab IS NULL THEN 1 ELSE 0 END) AS umum
      ${baseQuery} rp.status_lanjut = 'Ralan' ${dcFilter} ${dateFilterStr} ${pjFilter}`,
      [...dcParams, ...dateParams, ...pjParams]
    ) as any;

    const [ranapRows] = await pool.execute(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN pj.png_jawab LIKE '%BPJS%' THEN 1 ELSE 0 END) AS bpjs,
        SUM(CASE WHEN pj.png_jawab NOT LIKE '%BPJS%' AND pj.png_jawab IS NOT NULL AND pj.png_jawab != '-' THEN 1 ELSE 0 END) AS umum
      ${baseQuery} rp.status_lanjut = 'Ranap' ${dcFilter} ${dateFilterStr} ${pjFilter}`,
      [...dcParams, ...dateParams, ...pjParams]
    ) as any;

    const r = (ralanRows[0] || {});
    const ra = (ranapRows[0] || {});

    return res.json({
      ralan: {
        total: Number(r.total || 0),
        bpjs: Number(r.bpjs || 0),
        umum: Number(r.umum || 0),
      },
      ranap: {
        total: Number(ra.total || 0),
        bpjs: Number(ra.bpjs || 0),
        umum: Number(ra.umum || 0),
      },
      total: Number(r.total || 0) + Number(ra.total || 0),
    });
  } catch (error) {
    console.error("Operasi stats error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/detail", authenticate, async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.query.no_rawat as string;
    if (!no_rawat) return res.status(400).json({ error: "no_rawat required" });
    const [rows] = await pool.execute(
      `SELECT l.*, o.*, p.nm_pasien, p.no_rkm_medis, d.nm_dokter
       FROM laporan_operasi l
       JOIN operasi o ON l.no_rawat = o.no_rawat AND l.tanggal = o.tgl_operasi
       LEFT JOIN pasien p ON p.no_rkm_medis = (SELECT r.no_rkm_medis FROM reg_periksa r WHERE r.no_rawat = l.no_rawat LIMIT 1)
       LEFT JOIN dokter d ON o.operator1 = d.kd_dokter
       WHERE l.no_rawat = ?
       ORDER BY l.tanggal DESC
       LIMIT 1`,
      [no_rawat]
    );
    const recs = rows as any[];
    if (recs.length === 0) {
      return res.status(404).json({ error: "Laporan operasi not found" });
    }
    return res.json(recs[0]);
  } catch (error) {
    console.error("Get operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:no_rawat", authenticate, async (req: AuthRequest, res, next) => {
  const { no_rawat } = req.params;
  // Skip if no_rawat doesn't look like a real medical record ID (YYYY/MM/DD/xxxx)
  if (!/^\d{4}\/\d{2}\/\d{2}\/\d+$/.test(no_rawat)) return next("route");
  try {
    const [rows] = await pool.execute(
      `SELECT l.*, o.*, p.nm_pasien, p.no_rkm_medis, d.nm_dokter
       FROM laporan_operasi l
       JOIN operasi o ON l.no_rawat = o.no_rawat AND l.tanggal = o.tgl_operasi
       LEFT JOIN pasien p ON p.no_rkm_medis = (SELECT r.no_rkm_medis FROM reg_periksa r WHERE r.no_rawat = l.no_rawat LIMIT 1)
       LEFT JOIN dokter d ON o.operator1 = d.kd_dokter
       WHERE l.no_rawat = ?
       ORDER BY l.tanggal DESC
       LIMIT 1`,
      [req.params.no_rawat]
    );
    const recs = rows as any[];
    if (recs.length === 0) {
      return res.status(404).json({ error: "Laporan operasi not found" });
    }
    return res.json(recs[0]);
  } catch (error) {
    console.error("Get operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const {
      no_rawat, tanggal, no_rkm_medis,
      diagnosa_preop, diagnosa_postop, jaringan_dieksekusi,
      selesaioperasi, permintaan_pa, nomor_implan, laporan_operasi,
    } = req.body;

    if (!no_rawat || !tanggal) {
      return res.status(400).json({ error: "no_rawat dan tanggal harus diisi" });
    }

    // Check payment status - block if already paid
    const [payRows] = await pool.execute(
      "SELECT status_bayar FROM reg_periksa WHERE no_rawat = ?",
      [no_rawat]
    );
    const payData = (payRows as any[])[0];
    if (payData && payData.status_bayar === "Sudah Bayar") {
      return res.status(403).json({ error: "Pasien sudah bayar, tidak dapat membuat laporan operasi karena dapat menambah tagihan pasien" });
    }

    const kdDokter = req.user!.doctor_code || null;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Clean up stale laporan_operasi record if no matching operasi exists
      await conn.execute(
        `DELETE l FROM laporan_operasi l WHERE l.no_rawat = ? AND NOT EXISTS (SELECT 1 FROM operasi o WHERE o.no_rawat = l.no_rawat AND o.tgl_operasi = l.tanggal)`,
        [no_rawat]
      );

      // INSERT into laporan_operasi ONLY if laporan_operasi text is not empty (matching Java DlgTagihanOperasi logic)
      const laporanText = (laporan_operasi || "").trim();
      if (laporanText) {
        await conn.execute(
          `INSERT INTO laporan_operasi (no_rawat, tanggal, diagnosa_preop, diagnosa_postop, jaringan_dieksekusi, selesaioperasi, permintaan_pa, nomor_implan, laporan_operasi)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [no_rawat, tanggal, diagnosa_preop || "", diagnosa_postop || "", jaringan_dieksekusi || "", selesaioperasi || new Date().toISOString().slice(0, 19).replace("T", " "), permintaan_pa || "Tidak", nomor_implan || "", laporanText]
        );
      }

      const biayaDefaults = {
        biayaoperator1: 0, biayaoperator2: 0, biayaoperator3: 0,
        biayaasisten_operator1: 0, biayaasisten_operator2: 0, biayaasisten_operator3: 0,
        biayainstrumen: 0, biayadokter_anak: 0, biayaperawaat_resusitas: 0,
        biayadokter_anestesi: 0, biayaasisten_anestesi: 0, biayaasisten_anestesi2: 0,
        biayabidan: 0, biayabidan2: 0, biayabidan3: 0, biayaperawat_luar: 0,
        biayaalat: 0, biayasewaok: 0, akomodasi: 0, bagian_rs: 0,
        biaya_omloop: 0, biaya_omloop2: 0, biaya_omloop3: 0, biaya_omloop4: 0, biaya_omloop5: 0,
        biayasarpras: 0, biaya_dokter_pjanak: 0, biaya_dokter_umum: 0,
      };

      let kodePaket = req.body.kode_paket || "-";
      if (kodePaket && kodePaket !== "-") {
        const [check] = await conn.execute(
          "SELECT kode_paket FROM paket_operasi WHERE kode_paket = ?", [kodePaket]
        );
        if ((check as any[]).length === 0) kodePaket = "-";
      }
      if (kodePaket === "-") {
        const namaOperasi = req.body.nama_operasi?.trim();
        if (namaOperasi) {
          const [pkt] = await conn.execute(
            `SELECT kode_paket FROM paket_operasi WHERE status='1' AND (nm_perawatan LIKE ? OR kode_paket = ?) LIMIT 1`,
            [`%${namaOperasi}%`, namaOperasi]
          );
          const pktData = (pkt as any[])[0];
          if (pktData) kodePaket = pktData.kode_paket;
        }
        if (kodePaket === "-") {
          const [fallback] = await conn.execute(
            `SELECT kode_paket FROM paket_operasi WHERE status='1' LIMIT 1`
          );
          const fb = (fallback as any[])[0];
          if (fb) kodePaket = fb.kode_paket;
        }
      }
      const kategori = req.body.kategori || "-";
      const jenisAnasthesi = req.body.jenis_anasthesi || "Umum";
      const status = req.body.status || "Ranap";

      await conn.execute(
        `INSERT INTO operasi (
          no_rawat, tgl_operasi, jenis_anasthesi, kategori,
          operator1, operator2, operator3,
          asisten_operator1, asisten_operator2, asisten_operator3,
          instrumen, dokter_anak, perawaat_resusitas, dokter_anestesi,
          asisten_anestesi, asisten_anestesi2,
          bidan, bidan2, bidan3, perawat_luar,
          omloop, omloop2, omloop3, omloop4, omloop5,
          dokter_pjanak, dokter_umum, kode_paket,
          biayaoperator1, biayaoperator2, biayaoperator3,
          biayaasisten_operator1, biayaasisten_operator2, biayaasisten_operator3,
          biayainstrumen, biayadokter_anak, biayaperawaat_resusitas,
          biayadokter_anestesi, biayaasisten_anestesi, biayaasisten_anestesi2,
          biayabidan, biayabidan2, biayabidan3, biayaperawat_luar,
          biayaalat, biayasewaok, akomodasi, bagian_rs,
          biaya_omloop, biaya_omloop2, biaya_omloop3, biaya_omloop4, biaya_omloop5,
          biayasarpras, biaya_dokter_pjanak, biaya_dokter_umum, status
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )`,
        [
          no_rawat, tanggal, jenisAnasthesi, kategori,
          kdDokter, req.body.operator2 || "-", req.body.operator3 || "-",
          req.body.asisten_operator1 || "-", req.body.asisten_operator2 || "-", req.body.asisten_operator3 || null,
          req.body.instrumen || null, req.body.dokter_anak || "-", req.body.perawaat_resusitas || "-", req.body.dokter_anestesi || "-",
          req.body.asisten_anestesi || "-", req.body.asisten_anestesi2 || null,
          req.body.bidan || "-", req.body.bidan2 || null, req.body.bidan3 || null, req.body.perawat_luar || "-",
          req.body.omloop || null, req.body.omloop2 || null, req.body.omloop3 || null, req.body.omloop4 || null, req.body.omloop5 || null,
          req.body.dokter_pjanak || null, req.body.dokter_umum || null, kodePaket,
          req.body.biayaoperator1 ?? 0, req.body.biayaoperator2 ?? 0, req.body.biayaoperator3 ?? 0,
          req.body.biayaasisten_operator1 ?? 0, req.body.biayaasisten_operator2 ?? 0, req.body.biayaasisten_operator3 ?? 0,
          req.body.biayainstrumen ?? 0, req.body.biayadokter_anak ?? 0, req.body.biayaperawaat_resusitas ?? 0,
          req.body.biayadokter_anestesi ?? 0, req.body.biayaasisten_anestesi ?? 0, req.body.biayaasisten_anestesi2 ?? 0,
          req.body.biayabidan ?? 0, req.body.biayabidan2 ?? 0, req.body.biayabidan3 ?? 0, req.body.biayaperawat_luar ?? 0,
          req.body.biayaalat ?? 0, req.body.biayasewaok ?? 0, req.body.akomodasi ?? 0, req.body.bagian_rs ?? 0,
          req.body.biaya_omloop ?? 0, req.body.biaya_omloop2 ?? 0, req.body.biaya_omloop3 ?? 0, req.body.biaya_omloop4 ?? 0, req.body.biaya_omloop5 ?? 0,
          req.body.biayasarpras ?? 0, req.body.biaya_dokter_pjanak ?? 0, req.body.biaya_dokter_umum ?? 0,
          status,
        ]
      );

      // Insert medications (beri_obat_operasi) - matching Java DlgTagihanOperasi logic
      const obatList: any[] = req.body.obat || [];
      for (const obat of obatList) {
        const jml = parseFloat(obat.jumlah) || 0;
        if (jml > 0 && obat.kd_obat) {
          await conn.execute(
            `INSERT INTO beri_obat_operasi (no_rawat, tanggal, kd_obat, harga_satuan, jumlah) VALUES (?, ?, ?, ?, ?)`,
            [no_rawat, tanggal, obat.kd_obat, obat.harga_satuan || 0, jml]
          );
        }
      }

      await conn.commit();

      const seq = Math.floor(Math.random() * 9000) + 1000;
      const d = new Date(tanggal);
      const reportNumber = `OP-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${seq}`;

      await logAudit({
        userId: req.user!.id,
        action: "create_operasi",
        entityType: "laporan_operasi",
        entityId: `${no_rawat}-${tanggal}`,
        details: `Created laporan operasi ${reportNumber}`,
        ipAddress: req.ip,
      });

      return res.status(201).json({
        no_rawat,
        tanggal,
        no_rkm_medis,
        reportNumber,
        message: "Laporan operasi created successfully",
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Create operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/update", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.query.no_rawat as string;
    if (!no_rawat) return res.status(400).json({ error: "no_rawat required" });
    const { tanggal } = req.body;

    if (!tanggal) {
      return res.status(400).json({ error: "tanggal harus diisi" });
    }

    // Check payment status - block if already paid
    const [payRows] = await pool.execute(
      "SELECT status_bayar FROM reg_periksa WHERE no_rawat = ?",
      [no_rawat]
    );
    const payData = (payRows as any[])[0];
    if (payData && payData.status_bayar === "Sudah Bayar") {
      return res.status(403).json({ error: "Pasien sudah bayar, tidak dapat mengubah laporan operasi karena dapat menambah tagihan pasien" });
    }

    const [existing] = await pool.execute(
      "SELECT no_rawat FROM laporan_operasi WHERE no_rawat = ? AND tanggal = ?",
      [no_rawat, tanggal]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: "Laporan operasi tidak ditemukan" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // If laporan_operasi is empty, delete the record (matching Java: never keep empty laporan)
      const laporanText = (req.body.laporan_operasi || "").trim();
      if (laporanText) {
        await conn.execute(
          `UPDATE laporan_operasi SET laporan_operasi = ?, diagnosa_preop = ?, diagnosa_postop = ?, jaringan_dieksekusi = ?, selesaioperasi = ?, permintaan_pa = ?, nomor_implan = ? WHERE no_rawat = ? AND tanggal = ?`,
          [laporanText, req.body.diagnosa_preop || "", req.body.diagnosa_postop || "", req.body.jaringan_dieksekusi || "", req.body.selesaioperasi || "", req.body.permintaan_pa || "Tidak", req.body.nomor_implan || "", no_rawat, tanggal]
        );
      } else {
        // Remove laporan_operasi record entirely
        await conn.execute(`DELETE FROM laporan_operasi WHERE no_rawat = ? AND tanggal = ?`, [no_rawat, tanggal]);
        // Also clean up related billing
        await conn.execute(`DELETE FROM billing WHERE no_rawat = ? AND pemisah = ':' AND tgl_byr = ?`, [no_rawat, tanggal]);
      }

      await conn.execute(
        `UPDATE operasi SET diagnosa_preop = ?, diagnosa_postop = ?, jaringan_dieksekusi = ?, selesaioperasi = ?,
          operator1 = ?, operator2 = ?, operator3 = ?,
          asisten_operator1 = ?, asisten_operator2 = ?, asisten_operator3 = ?,
          instrumen = ?, dokter_anak = ?, perawaat_resusitas = ?,
          dokter_anestesi = ?, asisten_anestesi = ?, asisten_anestesi2 = ?,
          bidan = ?, bidan2 = ?, bidan3 = ?, perawat_luar = ?,
          omloop = ?, omloop2 = ?, omloop3 = ?, omloop4 = ?, omloop5 = ?,
          dokter_pjanak = ?, dokter_umum = ?
        WHERE no_rawat = ? AND tgl_operasi = ?`,
        [
          req.body.diagnosa_preop || "", req.body.diagnosa_postop || "", req.body.jaringan_dieksekusi || "", req.body.selesaioperasi || "",
          req.body.operator1 || "", req.body.operator2 || "", req.body.operator3 || "",
          req.body.asisten_operator1 || "", req.body.asisten_operator2 || "", req.body.asisten_operator3 || "",
          req.body.instrumen || "", req.body.dokter_anak || "", req.body.perawaat_resusitas || "",
          req.body.dokter_anestesi || "", req.body.asisten_anestesi || "", req.body.asisten_anestesi2 || "",
          req.body.bidan || "", req.body.bidan2 || "", req.body.bidan3 || "", req.body.perawat_luar || "",
          req.body.omloop || "", req.body.omloop2 || "", req.body.omloop3 || "", req.body.omloop4 || "", req.body.omloop5 || "",
          req.body.dokter_pjanak || "", req.body.dokter_umum || "",
          no_rawat, tanggal,
        ]
      );

      // Replace billing entries
      await conn.execute(`DELETE FROM billing WHERE no_rawat = ? AND pemisah = ':' AND tgl_byr = ?`, [no_rawat, tanggal]);
      await conn.commit();

      await logAudit({
        userId: req.user!.id,
        action: "update_operasi",
        entityType: "laporan_operasi",
        entityId: `${no_rawat}-${tanggal}`,
        details: `Updated laporan operasi`,
        ipAddress: req.ip,
      });

      return res.json({ no_rawat, message: "Laporan operasi updated" });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Update operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:no_rawat", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.params.no_rawat;
    const { tanggal } = req.body;

    if (!tanggal) {
      return res.status(400).json({ error: "tanggal harus diisi" });
    }

    // Check payment status - block if already paid
    const [payRows] = await pool.execute(
      "SELECT status_bayar FROM reg_periksa WHERE no_rawat = ?",
      [no_rawat]
    );
    const payData = (payRows as any[])[0];
    if (payData && payData.status_bayar === "Sudah Bayar") {
      return res.status(403).json({ error: "Pasien sudah bayar, tidak dapat mengubah laporan operasi karena dapat menambah tagihan pasien" });
    }

    const [existing] = await pool.execute(
      "SELECT no_rawat FROM laporan_operasi WHERE no_rawat = ? AND tanggal = ?",
      [no_rawat, tanggal]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: "Laporan operasi tidak ditemukan" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // If laporan_operasi is empty, delete the record (matching Java: never keep empty laporan)
      const laporanText = (req.body.laporan_operasi || "").trim();
      if (laporanText) {
        await conn.execute(
          `UPDATE laporan_operasi SET
           diagnosa_preop = ?, diagnosa_postop = ?, jaringan_dieksekusi = ?,
           selesaioperasi = ?, permintaan_pa = ?, nomor_implan = ?,
           laporan_operasi = ?
           WHERE no_rawat = ? AND tanggal = ?`,
          [
            req.body.diagnosa_preop || "",
            req.body.diagnosa_postop || "",
            req.body.jaringan_dieksekusi || "",
            req.body.selesaioperasi || "",
            req.body.permintaan_pa || "Tidak",
            req.body.nomor_implan || "",
            laporanText,
            no_rawat,
            tanggal,
          ]
        );
      } else {
        await conn.execute(
          `DELETE FROM laporan_operasi WHERE no_rawat = ? AND tanggal = ?`,
          [no_rawat, tanggal]
        );
      }

      await conn.execute(
        `UPDATE operasi SET
          jenis_anasthesi = COALESCE(?, jenis_anasthesi),
          kategori = COALESCE(?, kategori),
          operator1 = COALESCE(?, operator1),
          operator2 = COALESCE(?, operator2),
          operator3 = COALESCE(?, operator3),
          asisten_operator1 = COALESCE(?, asisten_operator1),
          asisten_operator2 = COALESCE(?, asisten_operator2),
          asisten_operator3 = COALESCE(?, asisten_operator3),
          instrumen = COALESCE(?, instrumen),
          dokter_anak = COALESCE(?, dokter_anak),
          perawaat_resusitas = COALESCE(?, perawaat_resusitas),
          dokter_anestesi = COALESCE(?, dokter_anestesi),
          asisten_anestesi = COALESCE(?, asisten_anestesi),
          asisten_anestesi2 = COALESCE(?, asisten_anestesi2),
          bidan = COALESCE(?, bidan),
          bidan2 = COALESCE(?, bidan2),
          bidan3 = COALESCE(?, bidan3),
          perawat_luar = COALESCE(?, perawat_luar),
          omloop = COALESCE(?, omloop),
          omloop2 = COALESCE(?, omloop2),
          omloop3 = COALESCE(?, omloop3),
          omloop4 = COALESCE(?, omloop4),
          omloop5 = COALESCE(?, omloop5),
          dokter_pjanak = COALESCE(?, dokter_pjanak),
          dokter_umum = COALESCE(?, dokter_umum),
          kode_paket = COALESCE(?, kode_paket),
          status = COALESCE(?, status),
          biayaoperator1 = COALESCE(?, biayaoperator1),
          biayaoperator2 = COALESCE(?, biayaoperator2),
          biayaoperator3 = COALESCE(?, biayaoperator3),
          biayaasisten_operator1 = COALESCE(?, biayaasisten_operator1),
          biayaasisten_operator2 = COALESCE(?, biayaasisten_operator2),
          biayaasisten_operator3 = COALESCE(?, biayaasisten_operator3),
          biayainstrumen = COALESCE(?, biayainstrumen),
          biayadokter_anak = COALESCE(?, biayadokter_anak),
          biayaperawaat_resusitas = COALESCE(?, biayaperawaat_resusitas),
          biayadokter_anestesi = COALESCE(?, biayadokter_anestesi),
          biayaasisten_anestesi = COALESCE(?, biayaasisten_anestesi),
          biayaasisten_anestesi2 = COALESCE(?, biayaasisten_anestesi2),
          biayabidan = COALESCE(?, biayabidan),
          biayabidan2 = COALESCE(?, biayabidan2),
          biayabidan3 = COALESCE(?, biayabidan3),
          biayaperawat_luar = COALESCE(?, biayaperawat_luar),
          biayaalat = COALESCE(?, biayaalat),
          biayasewaok = COALESCE(?, biayasewaok),
          akomodasi = COALESCE(?, akomodasi),
          bagian_rs = COALESCE(?, bagian_rs),
          biaya_omloop = COALESCE(?, biaya_omloop),
          biaya_omloop2 = COALESCE(?, biaya_omloop2),
          biaya_omloop3 = COALESCE(?, biaya_omloop3),
          biaya_omloop4 = COALESCE(?, biaya_omloop4),
          biaya_omloop5 = COALESCE(?, biaya_omloop5),
          biayasarpras = COALESCE(?, biayasarpras),
          biaya_dokter_pjanak = COALESCE(?, biaya_dokter_pjanak),
          biaya_dokter_umum = COALESCE(?, biaya_dokter_umum)
         WHERE no_rawat = ? AND tgl_operasi = ?`,
        [
          req.body.jenis_anasthesi || null,
          req.body.kategori || null,
          req.body.operator1 || null,
          req.body.operator2 || null,
          req.body.operator3 || null,
          req.body.asisten_operator1 || null,
          req.body.asisten_operator2 || null,
          req.body.asisten_operator3 || null,
          req.body.instrumen || null,
          req.body.dokter_anak || null,
          req.body.perawaat_resusitas || null,
          req.body.dokter_anestesi || null,
          req.body.asisten_anestesi || null,
          req.body.asisten_anestesi2 || null,
          req.body.bidan || null,
          req.body.bidan2 || null,
          req.body.bidan3 || null,
          req.body.perawat_luar || null,
          req.body.omloop || null,
          req.body.omloop2 || null,
          req.body.omloop3 || null,
          req.body.omloop4 || null,
          req.body.omloop5 || null,
          req.body.dokter_pjanak || null,
          req.body.dokter_umum || null,
          req.body.kode_paket || null,
          req.body.status || null,
          req.body.biayaoperator1 ?? null,
          req.body.biayaoperator2 ?? null,
          req.body.biayaoperator3 ?? null,
          req.body.biayaasisten_operator1 ?? null,
          req.body.biayaasisten_operator2 ?? null,
          req.body.biayaasisten_operator3 ?? null,
          req.body.biayainstrumen ?? null,
          req.body.biayadokter_anak ?? null,
          req.body.biayaperawaat_resusitas ?? null,
          req.body.biayadokter_anestesi ?? null,
          req.body.biayaasisten_anestesi ?? null,
          req.body.biayaasisten_anestesi2 ?? null,
          req.body.biayabidan ?? null,
          req.body.biayabidan2 ?? null,
          req.body.biayabidan3 ?? null,
          req.body.biayaperawat_luar ?? null,
          req.body.biayaalat ?? null,
          req.body.biayasewaok ?? null,
          req.body.akomodasi ?? null,
          req.body.bagian_rs ?? null,
          req.body.biaya_omloop ?? null,
          req.body.biaya_omloop2 ?? null,
          req.body.biaya_omloop3 ?? null,
          req.body.biaya_omloop4 ?? null,
          req.body.biaya_omloop5 ?? null,
          req.body.biayasarpras ?? null,
          req.body.biaya_dokter_pjanak ?? null,
          req.body.biaya_dokter_umum ?? null,
          no_rawat,
          tanggal,
        ]
      );

      // Update medications: delete existing then re-insert
      await conn.execute(
        `DELETE FROM beri_obat_operasi WHERE no_rawat = ? AND tanggal = ?`,
        [no_rawat, tanggal]
      );
      const obatList: any[] = req.body.obat || [];
      for (const obat of obatList) {
        const jml = parseFloat(obat.jumlah) || 0;
        if (jml > 0 && obat.kd_obat) {
          await conn.execute(
            `INSERT INTO beri_obat_operasi (no_rawat, tanggal, kd_obat, harga_satuan, jumlah) VALUES (?, ?, ?, ?, ?)`,
            [no_rawat, tanggal, obat.kd_obat, obat.harga_satuan || 0, jml]
          );
        }
      }

      await conn.commit();

      await logAudit({
        userId: req.user!.id,
        action: "update_operasi",
        entityType: "laporan_operasi",
        entityId: `${no_rawat}-${tanggal}`,
        details: "Updated laporan operasi",
        ipAddress: req.ip,
      });

      return res.json({ no_rawat, tanggal, message: "Diperbarui" });
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Update operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/lock", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.query.no_rawat as string;
    if (!no_rawat) return res.status(400).json({ error: "no_rawat required" });
    const { tanggal } = req.body;

    if (!tanggal) {
      return res.status(400).json({ error: "tanggal is required in body" });
    }

    const [existing] = await pool.execute(
      "SELECT no_rawat FROM laporan_operasi WHERE no_rawat = ? AND tanggal = ?",
      [no_rawat, tanggal]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: "Laporan operasi not found" });
    }

    const seq = Math.floor(Math.random() * 9000) + 1000;
    const d = new Date(tanggal);
    const reportNumber = `OP-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${seq}`;

    await logAudit({
      userId: req.user!.id,
      action: "sign_operasi",
      entityType: "laporan_operasi",
      entityId: `${no_rawat}-${tanggal}`,
      details: `Signed laporan operasi as ${reportNumber}`,
      ipAddress: req.ip,
    });

    return res.json({ no_rawat, tanggal, reportNumber, isLocked: true, message: "Laporan operasi signed" });
  } catch (error) {
    console.error("Lock operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:no_rawat/lock", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.params.no_rawat;
    const { tanggal } = req.body;

    if (!tanggal) {
      return res.status(400).json({ error: "tanggal is required in body" });
    }

    const [existing] = await pool.execute(
      "SELECT no_rawat FROM laporan_operasi WHERE no_rawat = ? AND tanggal = ?",
      [no_rawat, tanggal]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: "Laporan operasi not found" });
    }

    const seq = Math.floor(Math.random() * 9000) + 1000;
    const d = new Date(tanggal);
    const reportNumber = `OP-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${seq}`;

    await logAudit({
      userId: req.user!.id,
      action: "sign_operasi",
      entityType: "laporan_operasi",
      entityId: `${no_rawat}-${tanggal}`,
      details: `Signed laporan operasi as ${reportNumber}`,
      ipAddress: req.ip,
    });

    return res.json({ no_rawat, tanggal, reportNumber, isLocked: true, message: "Laporan operasi signed" });
  } catch (error) {
    console.error("Lock operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cleanup", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  try {
    const [orphanRows] = await pool.execute(
      `SELECT l.no_rawat, l.tanggal FROM laporan_operasi l WHERE l.laporan_operasi IS NOT NULL AND l.laporan_operasi != '' AND NOT EXISTS (SELECT 1 FROM operasi o WHERE o.no_rawat = l.no_rawat AND o.tgl_operasi = l.tanggal)`
    );
    const orphans = orphanRows as any[];
    if (orphans.length === 0) {
      return res.json({ deleted: 0, message: "Tidak ada data orphan" });
    }
    const [result] = await pool.execute(
      `DELETE l FROM laporan_operasi l WHERE l.laporan_operasi IS NOT NULL AND l.laporan_operasi != '' AND NOT EXISTS (SELECT 1 FROM operasi o WHERE o.no_rawat = l.no_rawat AND o.tgl_operasi = l.tanggal)`
    );
    await logAudit({
      userId: req.user!.id,
      action: "cleanup_operasi",
      entityType: "laporan_operasi",
      entityId: `batch-${orphans.length}`,
      details: `Cleaned up ${orphans.length} orphan laporan_operasi records`,
      ipAddress: req.ip,
    });
    return res.json({ deleted: (result as any).affectedRows || orphans.length, message: `Berhasil membersihkan ${orphans.length} data orphan` });
  } catch (error) {
    console.error("Cleanup operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Search operation packages (matching Java DlgTagihanOperasi paket_operasi query)
router.get("/data/paket", authenticate, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    const pattern = q ? `%${q}%` : "%";
    const [rows] = await pool.execute(
      `SELECT kode_paket, nm_perawatan, kategori,
        operator1, operator2, operator3,
        asisten_operator1, asisten_operator2, asisten_operator3,
        instrumen, dokter_anak, perawaat_resusitas,
        dokter_anestesi, asisten_anestesi, asisten_anestesi2,
        bidan, bidan2, bidan3, perawat_luar, alat,
        sewa_ok, akomodasi, bagian_rs,
        omloop, omloop2, omloop3, omloop4, omloop5,
        sarpras, dokter_pjanak, dokter_umum,
        (operator1+operator2+operator3+asisten_operator1+asisten_operator2+
         asisten_operator3+instrumen+dokter_anak+perawaat_resusitas+alat+
         dokter_anestesi+asisten_anestesi+asisten_anestesi2+bidan+bidan2+
         bidan3+perawat_luar+sewa_ok+akomodasi+bagian_rs+omloop+omloop2+
         omloop3+omloop4+omloop5+sarpras+dokter_pjanak+dokter_umum) AS total
       FROM paket_operasi
       WHERE status='1' AND (kode_paket LIKE ? OR nm_perawatan LIKE ?)
       ORDER BY nm_perawatan
       LIMIT 50`,
      [pattern, pattern]
    );
    return res.json(rows);
  } catch (error) {
    console.error("Search paket error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Search medications/BHP (matching Java DlgTagihanOperasi tampil2 query)
router.get("/data/obat", authenticate, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string) || "";
    const pattern = q ? `%${q}%` : "%";
    const [rows] = await pool.execute(
      `SELECT ob.kd_obat, ob.nm_obat, ks.satuan, ob.hargasatuan
       FROM obatbhp_ok ob
       LEFT JOIN kodesatuan ks ON ob.kode_sat = ks.kode_sat
       WHERE ob.kd_obat LIKE ? OR ob.nm_obat LIKE ? OR ks.satuan LIKE ?
       ORDER BY ob.kd_obat
       LIMIT 50`,
      [pattern, pattern, pattern]
    );
    return res.json(rows);
  } catch (error) {
    console.error("Search obat error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get booking_operasi data (jadwal operasi) for a patient, with nama_operasi resolved from paket_operasi
router.get("/booking-data", authenticate, async (req: AuthRequest, res) => {
  try {
    const no_rawat = req.query.no_rawat as string;
    if (!no_rawat) return res.status(400).json({ error: "no_rawat required" });
    const [rows] = await pool.execute(
      `SELECT b.*, p.nm_perawatan AS nama_operasi
       FROM booking_operasi b
       LEFT JOIN paket_operasi p ON b.kode_paket = p.kode_paket
       WHERE b.no_rawat = ? ORDER BY b.tanggal DESC, b.jam_mulai DESC LIMIT 1`,
      [no_rawat]
    );
    const data = (rows as any[])[0] || null;
    return res.json(data);
  } catch (error) {
    console.error("Get booking operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/booking/:no_rawat", authenticate, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT b.*, p.nm_perawatan AS nama_operasi
       FROM booking_operasi b
       LEFT JOIN paket_operasi p ON b.kode_paket = p.kode_paket
       WHERE b.no_rawat = ? ORDER BY b.tanggal DESC, b.jam_mulai DESC LIMIT 1`,
      [req.params.no_rawat]
    );
    const data = (rows as any[])[0] || null;
    return res.json(data);
  } catch (error) {
    console.error("Get booking operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete operasi + laporan_operasi + beri_obat_operasi
router.delete("/remove", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  const no_rawat = req.query.no_rawat as string;
  if (!no_rawat) return res.status(400).json({ error: "no_rawat required" });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [lapRows] = await conn.execute(
      `SELECT tanggal FROM laporan_operasi WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1`,
      [no_rawat]
    );
    const lapData = (lapRows as any[])[0];
    if (lapData) {
      await conn.execute(`DELETE FROM laporan_operasi WHERE no_rawat = ? AND tanggal = ?`, [no_rawat, lapData.tanggal]);
      await conn.execute(`DELETE FROM beri_obat_operasi WHERE no_rawat = ? AND tanggal = ?`, [no_rawat, lapData.tanggal]);
      await conn.execute(`DELETE FROM operasi WHERE no_rawat = ? AND tgl_operasi = ?`, [no_rawat, lapData.tanggal]);
    }
    await conn.commit();
    await logAudit({
      userId: req.user!.id,
      action: "delete_operasi",
      entityType: "laporan_operasi",
      entityId: no_rawat,
      details: `Deleted laporan operasi for ${no_rawat}`,
      ipAddress: req.ip,
    });
    return res.json({ message: "Data operasi berhasil dihapus" });
  } catch (error) {
    await conn.rollback();
    console.error("Delete operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
});

router.delete("/:no_rawat", authenticate, authorize("doctor"), async (req: AuthRequest, res) => {
  const no_rawat = req.params.no_rawat;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [lapRows] = await conn.execute(
      `SELECT tanggal FROM laporan_operasi WHERE no_rawat = ? ORDER BY tanggal DESC LIMIT 1`,
      [no_rawat]
    );
    const lapData = (lapRows as any[])[0];
    if (lapData) {
      await conn.execute(`DELETE FROM laporan_operasi WHERE no_rawat = ? AND tanggal = ?`, [no_rawat, lapData.tanggal]);
      await conn.execute(`DELETE FROM beri_obat_operasi WHERE no_rawat = ? AND tanggal = ?`, [no_rawat, lapData.tanggal]);
      await conn.execute(`DELETE FROM operasi WHERE no_rawat = ? AND tgl_operasi = ?`, [no_rawat, lapData.tanggal]);
    }
    await conn.commit();
    await logAudit({
      userId: req.user!.id,
      action: "delete_operasi",
      entityType: "laporan_operasi",
      entityId: no_rawat,
      details: `Deleted laporan operasi for ${no_rawat}`,
      ipAddress: req.ip,
    });
    return res.json({ message: "Data operasi berhasil dihapus" });
  } catch (error) {
    await conn.rollback();
    console.error("Delete operasi error:", error);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    conn.release();
  }
});

export default router;
