import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db";
import { authenticate, AuthRequest, generateTokens, logAudit } from "../middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET || "CHANGE-ME-DI-PRODUCTION";
const router = Router();

router.get("/setting", async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT nama_instansi, alamat_instansi, logo FROM setting LIMIT 1"
    );
    const row = (rows as any[])[0];
    if (!row) {
      return res.json({ nama_instansi: "RS Islam S. Anggoro", alamat_instansi: "" });
    }
    let logoBase64: string | null = null;
    try {
      if (row.logo && typeof row.logo === "object" && (row.logo as Buffer).length > 0) {
        logoBase64 = (row.logo as Buffer).toString("base64");
      }
    } catch {
      console.warn("Could not convert logo to base64");
    }
    return res.json({
      nama_instansi: row.nama_instansi,
      alamat_instansi: row.alamat_instansi,
      logo: logoBase64,
    });
  } catch (error) {
    console.error("Setting error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username dan password harus diisi" });
    }

    const [userRows] = await pool.execute(
      "SELECT id_user, AES_DECRYPT(id_user, 'nur') AS username FROM user WHERE id_user = AES_ENCRYPT(?, 'nur') AND password = AES_ENCRYPT(?, 'windi')",
      [username, password]
    );
    const userRecord = (userRows as any[])[0];

    if (!userRecord) {
      return res.status(401).json({ error: "Username/password salah" });
    }

    const rawUsername = userRecord.username;
    const kdDokter = typeof rawUsername === "string" ? rawUsername : (rawUsername as Buffer).toString();

    const [dokterRows] = await pool.execute(
      "SELECT kd_dokter, nm_dokter FROM dokter WHERE kd_dokter = ?",
      [kdDokter]
    );
    const dokter = (dokterRows as any[])[0];

    if (!dokter) {
      return res.status(403).json({ error: "Akun ini bukan dokter" });
    }

    let [existing] = await pool.execute(
      "SELECT id, email, name, role, spesialisasi FROM app_users WHERE doctor_code = ?",
      [kdDokter]
    );
    let appUser = (existing as any[])[0];

    if (!appUser) {
      const email = kdDokter.toLowerCase() + "@rsisa.local";
      const [result] = await pool.execute(
        "INSERT INTO app_users (email, username, name, role, doctor_code, is_active, password_hash) VALUES (?, ?, ?, 'doctor', ?, 1, ?)",
        [email, kdDokter, dokter.nm_dokter, kdDokter, ""]
      );
      appUser = {
        id: (result as any).insertId,
        email,
        name: dokter.nm_dokter,
        role: "doctor",
        spesialisasi: null,
      };
    }

    await pool.execute(
      "UPDATE app_users SET last_login = NOW() WHERE id = ?",
      [appUser.id]
    );

    const tokens = generateTokens(appUser);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");

    await pool.execute(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [appUser.id, tokens.refreshToken, expiresAt]
    );

    await logAudit({
      userId: appUser.id, action: "login", entityType: "user",
      entityId: String(appUser.id), ipAddress: req.ip,
    });

    return res.json({
      user: {
        id: appUser.id,
        email: appUser.email,
        name: appUser.name,
        role: "doctor",
        spesialisasi: appUser.spesialisasi,
        doctor_code: kdDokter,
      },
      ...tokens,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const [rows] = await pool.execute(
      "SELECT * FROM refresh_tokens WHERE token = ?",
      [refreshToken]
    );
    const stored = (rows as any[])[0];
    if (!stored || new Date(stored.expires_at) < new Date()) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      const [userRows] = await pool.execute(
        "SELECT id, email, name, role FROM app_users WHERE id = ?",
        [decoded.id]
      );
      const user = (userRows as any[])[0];
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const tokens = generateTokens(user);
      await pool.execute("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");
      await pool.execute(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        [user.id, tokens.refreshToken, expiresAt]
      );

      return res.json(tokens);
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", authenticate, async (req: AuthRequest, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.execute("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);
    }
    await logAudit({
      userId: req.user!.id, action: "logout", entityType: "user",
      entityId: String(req.user!.id), ipAddress: req.ip,
    });
    return res.json({ message: "Logged out" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, email, name, role, spesialisasi, doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const user = (rows as any[])[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.doctor_code) {
      const [dokterRows] = await pool.execute(
        "SELECT nm_dokter, spesialisasi FROM dokter WHERE kd_dokter = ?",
        [user.doctor_code]
      );
      const dokter = (dokterRows as any[])[0];
      if (dokter) {
        user.name = dokter.nm_dokter;
        user.spesialisasi = dokter.spesialisasi;
      }
    }

    return res.json({ user });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/change-password", authenticate, async (req: AuthRequest, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ error: "Old password and new password required" });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: "Password minimal 8 karakter" });
    }
    if (!/[A-Z]/.test(new_password)) {
      return res.status(400).json({ error: "Password harus mengandung minimal 1 huruf kapital" });
    }
    if (!/[0-9]/.test(new_password)) {
      return res.status(400).json({ error: "Password harus mengandung minimal 1 angka" });
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(new_password)) {
      return res.status(400).json({ error: "Password harus mengandung minimal 1 karakter khusus" });
    }

    const [userRows] = await pool.execute(
      "SELECT id, doctor_code FROM app_users WHERE id = ?",
      [req.user!.id]
    );
    const appUser = (userRows as any[])[0];
    if (!appUser || !appUser.doctor_code) {
      return res.status(400).json({ error: "Akun ini tidak dapat mengganti password" });
    }

    const [checkRows] = await pool.execute(
      "SELECT id_user FROM user WHERE id_user = AES_ENCRYPT(?, 'nur') AND password = AES_ENCRYPT(?, 'windi')",
      [appUser.doctor_code, old_password]
    );
    if ((checkRows as any[]).length === 0) {
      return res.status(400).json({ error: "Password lama tidak sesuai" });
    }

    if (old_password === new_password) {
      return res.status(400).json({ error: "Password baru tidak boleh sama dengan password saat ini" });
    }

    await pool.execute(
      "UPDATE user SET password = AES_ENCRYPT(?, 'windi') WHERE id_user = AES_ENCRYPT(?, 'nur')",
      [new_password, appUser.doctor_code]
    );

    await pool.execute("DELETE FROM refresh_tokens WHERE user_id = ?", [req.user!.id]);

    await logAudit({
      userId: req.user!.id, action: "change_password", entityType: "user",
      entityId: String(req.user!.id), details: "Password changed",
      ipAddress: req.ip,
    });

    return res.json({ message: "Password berhasil diubah. Semua sesi lain telah dinonaktifkan." });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/seed", async (_req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id FROM app_users WHERE email = ?", ["admin@specialistcare.id"]);
    if ((rows as any[]).length > 0) {
      return res.json({ message: "Seed data already exists" });
    }

    await pool.execute(
      `INSERT INTO app_users (email, username, name, role, doctor_code, is_active)
       VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
      [
        "admin@specialistcare.id", "admin", "Admin Utama", "admin", null, 1,
        "dr.reza@specialistcare.id", "D00000034", "dr. Syahroni Sinaryadikara", "doctor", "D00000034", 1,
        "dr.ayu@specialistcare.id", "D0000018", "dr. Laila Nurmala", "doctor", "D0000018", 1,
        "staff@specialistcare.id", "staff", "Staf Admin", "assistant", null, 1,
      ]
    );

    return res.json({ message: "Seed data created." });
  } catch (error) {
    console.error("Seed error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Search dokter by name or code
router.get("/dokter/search", authenticate, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 3) return res.json([]);
    const [rows] = await pool.execute(
      `SELECT kd_dokter, nm_dokter FROM dokter
       WHERE nm_dokter LIKE ? OR kd_dokter LIKE ?
       ORDER BY nm_dokter LIMIT 20`,
      [`%${q}%`, `%${q}%`]
    );
    return res.json(rows);
  } catch (error) {
    console.error("Dokter search error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Search pegawai/karyawan by name (active only)
router.get("/pegawai/search", authenticate, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 3) return res.json([]);
    const possibleTables = ["pegawai", "karyawan", "staf", "petugas"];
    for (const table of possibleTables) {
      try {
        const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
        const colNames = (cols as any[]).map((c: any) => c.Field);
        const nameCol = colNames.find((c) =>
          ["nama","nm_pegawai","nm_karyawan","nama_pegawai","nama_karyawan","nm_petugas","nama_petugas","nm_staf","nama_staf"].includes(c)
        );
        if (!nameCol) continue;
        const activeCol = colNames.find((c) =>
          ["status","stts_aktif","aktif","is_active","flag"].includes(c)
        );
        const idCol = colNames.find((c) =>
          ["nip","nik","id_pegawai","id_karyawan","kd_pegawai","kode"].includes(c)
        );
        let sql = `SELECT ${idCol ? idCol+"," : ""} ${nameCol} FROM \`${table}\` WHERE ${nameCol} LIKE ?`;
        const params: any[] = [`%${q}%`];
        if (activeCol) {
          const sampleRows = await pool.query(`SELECT DISTINCT ${activeCol} FROM \`${table}\` LIMIT 5`);
          const vals = (sampleRows[0] as any[]).map((r: any) => String(r[activeCol]).toLowerCase());
          if (vals.includes("1") || vals.includes("aktif") || vals.includes("active")) {
            sql += ` AND ${activeCol} IN (?)`;
            params.push(["1", "aktif", "active"]);
          } else if (vals.includes("0") || vals.includes("tidak")) {
            sql += ` AND ${activeCol} NOT IN (?)`;
            params.push(["0", "tidak", "inactive"]);
          } else {
            sql += ` AND ${activeCol} IS NOT NULL`;
          }
        }
        sql += ` ORDER BY ${nameCol} LIMIT 20`;
        const [rows] = await pool.query(sql, params);
        return res.json(rows);
      } catch { continue; }
    }
    return res.json([]);
  } catch (error) {
    console.error("Pegawai search error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
