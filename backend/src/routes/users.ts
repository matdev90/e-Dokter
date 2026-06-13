import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db";
import { authenticate, authorize, AuthRequest, logAudit } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, authorize("admin"), async (_req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, name, role, is_active, created_at FROM app_users ORDER BY created_at DESC`
    );
    const users = (rows as any[]).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: !!u.is_active,
      createdAt: u.created_at,
    }));
    return res.json(users);
  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: "All fields required" });
    }
    if (!["doctor", "assistant", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      "INSERT INTO app_users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
      [email, passwordHash, name, role]
    );

    const insertId = (result as any).insertId;
    const [rows] = await pool.execute(
      "SELECT id, email, name, role FROM app_users WHERE id = ?",
      [insertId]
    );
    const user = (rows as any[])[0];

    await logAudit({
      userId: req.user!.id,
      action: "create_user",
      entityType: "user",
      entityId: String(user.id),
      details: `Created user: ${email} (${role})`,
      ipAddress: req.ip,
    });

    return res.status(201).json(user);
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Email already exists" });
    }
    console.error("Create user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { email, name, role, isActive, password } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (email) { updates.push("email = ?"); params.push(email); }
    if (name) { updates.push("name = ?"); params.push(name); }
    if (role) { updates.push("role = ?"); params.push(role); }
    if (isActive !== undefined) { updates.push("is_active = ?"); params.push(isActive ? 1 : 0); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push("password_hash = ?");
      params.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id);
    await pool.execute(
      `UPDATE app_users SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    const [rows] = await pool.execute(
      "SELECT id, email, name, role, is_active FROM app_users WHERE id = ?",
      [id]
    );
    const updated = (rows as any[])[0];

    await logAudit({
      userId: req.user!.id,
      action: "update_user",
      entityType: "user",
      entityId: String(id),
      details: `Updated user: ${updated.email}`,
      ipAddress: req.ip,
    });

    return res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: !!updated.is_active,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
