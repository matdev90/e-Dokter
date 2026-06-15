import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { authenticate, AuthRequest, generateTokens, logAudit } from "../middleware/auth";
import { getUsers, saveUsers, getRefreshTokens, saveRefreshTokens } from "../db/store";

const JWT_SECRET: string = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET tidak diatur di environment");
}
const router = Router();

let nextUserId = Date.now();

function findOrCreateDoctor(kdDokter: string, nmDokter: string) {
  const users = getUsers();
  let user = users.find((u: any) => u.doctor_code === kdDokter);
  if (!user) {
    user = {
      id: nextUserId++,
      email: kdDokter.toLowerCase() + "@rsisa.local",
      name: nmDokter,
      role: "doctor",
      doctor_code: kdDokter,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
  }
  return user;
}

function storeRefreshToken(userId: number, token: string) {
  const tokens = getRefreshTokens();
  tokens.push({
    user_id: userId,
    token,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  });
  saveRefreshTokens(tokens);
}

function findRefreshToken(token: string) {
  return getRefreshTokens().find((t: any) => t.token === token);
}

function deleteRefreshToken(token: string) {
  const tokens = getRefreshTokens().filter((t: any) => t.token !== token);
  saveRefreshTokens(tokens);
}

function deleteUserRefreshTokens(userId: number) {
  const tokens = getRefreshTokens().filter((t: any) => t.user_id !== userId);
  saveRefreshTokens(tokens);
}

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

    // Try SIMRS login first (for doctors)
    const [userRows] = await pool.execute(
      "SELECT id_user, AES_DECRYPT(id_user, 'nur') AS username FROM user WHERE id_user = AES_ENCRYPT(?, 'nur') AND password = AES_ENCRYPT(?, 'windi')",
      [username, password]
    );
    const userRecord = (userRows as any[])[0];

    if (userRecord) {
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

      const appUser = findOrCreateDoctor(kdDokter, dokter.nm_dokter);

      const tokens = generateTokens({ ...appUser, doctor_code: kdDokter });
      storeRefreshToken(appUser.id, tokens.refreshToken);

      await logAudit({
        userId: appUser.id, action: "login", entityType: "user",
        entityId: String(appUser.id), ipAddress: req.ip,
      });

      return res.json({
        user: {
          id: appUser.id,
          email: appUser.email,
          name: dokter.nm_dokter,
          role: "doctor",
          doctor_code: kdDokter,
        },
        ...tokens,
      });
    }

    // Try app user login (for admin/assistant)
    const users = getUsers();
    const appUser = users.find((u: any) =>
      (u.email === username || u.username === username) && u.is_active !== false
    );

    if (appUser) {
      const valid = await bcrypt.compare(password, appUser.password_hash || "");
      if (!valid) {
        return res.status(401).json({ error: "Username/password salah" });
      }

      const tokens = generateTokens(appUser);
      storeRefreshToken(appUser.id, tokens.refreshToken);

      await logAudit({
        userId: appUser.id, action: "login", entityType: "user",
        entityId: String(appUser.id), ipAddress: req.ip,
      });

      return res.json({
        user: {
          id: appUser.id,
          email: appUser.email,
          name: appUser.name,
          role: appUser.role,
        },
        ...tokens,
      });
    }

    return res.status(401).json({ error: "Username/password salah" });
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

    const stored = findRefreshToken(refreshToken);
    if (!stored || new Date(stored.expires_at) < new Date()) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      const users = getUsers();
      const user = users.find((u: any) => u.id === decoded.id);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const tokens = generateTokens(user);
      deleteRefreshToken(refreshToken);
      storeRefreshToken(user.id, tokens.refreshToken);

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
      deleteRefreshToken(refreshToken);
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
    const user = req.user;
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.doctor_code) {
      const [dokterRows] = await pool.execute(
        "SELECT nm_dokter, spesialisasi FROM dokter WHERE kd_dokter = ?",
        [user.doctor_code]
      );
      const dokter = (dokterRows as any[])[0];
      if (dokter) {
        user.name = dokter.nm_dokter;
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

    const user = req.user!;

    if (user.doctor_code) {
      // Change SIMRS password
      const [checkRows] = await pool.execute(
        "SELECT id_user FROM user WHERE id_user = AES_ENCRYPT(?, 'nur') AND password = AES_ENCRYPT(?, 'windi')",
        [user.doctor_code, old_password]
      );
      if ((checkRows as any[]).length === 0) {
        return res.status(400).json({ error: "Password lama tidak sesuai" });
      }

      if (old_password === new_password) {
        return res.status(400).json({ error: "Password baru tidak boleh sama dengan password saat ini" });
      }

      await pool.execute(
        "UPDATE user SET password = AES_ENCRYPT(?, 'windi') WHERE id_user = AES_ENCRYPT(?, 'nur')",
        [new_password, user.doctor_code]
      );
    } else {
      // Change app user password
      const users = getUsers();
      const appUser = users.find((u: any) => u.id === user.id);
      if (!appUser) {
        return res.status(400).json({ error: "Akun tidak ditemukan" });
      }

      const valid = await bcrypt.compare(old_password, appUser.password_hash || "");
      if (!valid) {
        return res.status(400).json({ error: "Password lama tidak sesuai" });
      }

      if (old_password === new_password) {
        return res.status(400).json({ error: "Password baru tidak boleh sama dengan password saat ini" });
      }

      appUser.password_hash = await bcrypt.hash(new_password, 10);
      saveUsers(users);
    }

    deleteUserRefreshTokens(user.id!);

    await logAudit({
      userId: user.id, action: "change_password", entityType: "user",
      entityId: String(user.id), details: "Password changed",
      ipAddress: req.ip,
    });

    return res.json({ message: "Password berhasil diubah. Semua sesi lain telah dinonaktifkan." });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/seed", async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "";
    if (ip !== "127.0.0.1" && ip !== "::1" && ip !== "::ffff:127.0.0.1" && !ip.startsWith("::ffff:10.") && !ip.startsWith("::ffff:192.168.")) {
      return res.status(403).json({ error: "Seed hanya dapat diakses dari localhost" });
    }

    const users = getUsers();
    if (users.find((u: any) => u.email === "admin@specialistcare.id")) {
      return res.json({ message: "Seed data already exists" });
    }

    const hash = await bcrypt.hash("admin123", 10);
    const seedUsers = [
      { email: "admin@specialistcare.id", username: "admin", name: "Admin Utama", role: "admin", doctor_code: null, password_hash: hash },
      { email: "dr.reza@specialistcare.id", username: "D00000034", name: "dr. Syahroni Sinaryadikara", role: "doctor", doctor_code: "D00000034", password_hash: "" },
      { email: "dr.ayu@specialistcare.id", username: "D0000018", name: "dr. Laila Nurmala", role: "doctor", doctor_code: "D0000018", password_hash: "" },
      { email: "staff@specialistcare.id", username: "staff", name: "Staf Admin", role: "assistant", doctor_code: null, password_hash: hash },
    ];

    seedUsers.forEach((u: any) => {
      u.id = nextUserId++;
      u.is_active = true;
      u.created_at = new Date().toISOString();
      users.push(u);
    });
    saveUsers(users);

    return res.json({ message: "Seed data created." });
  } catch (error) {
    console.error("Seed error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dokter/search", authenticate, async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 3) return res.json([]);
    const sq = q.replace(/[%_]/g, '\\$&');
    const [rows] = await pool.execute(
      `SELECT kd_dokter, nm_dokter FROM dokter
       WHERE nm_dokter LIKE ? OR kd_dokter LIKE ?
       ORDER BY nm_dokter LIMIT 20`,
      [`%${sq}%`, `%${sq}%`]
    );
    return res.json(rows);
  } catch (error) {
    console.error("Dokter search error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
        const sq = q.replace(/[%_]/g, '\\$&');
        let sql = `SELECT ${idCol ? idCol+"," : ""} ${nameCol} FROM \`${table}\` WHERE ${nameCol} LIKE ?`;
        const params: any[] = [`%${sq}%`];
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
