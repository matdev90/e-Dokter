import { Router } from "express";
import bcrypt from "bcryptjs";
import { authenticate, authorize, AuthRequest, logAudit } from "../middleware/auth";
import { getUsers, saveUsers } from "../db/store";

const router = Router();

let nextUserId = Date.now();

router.get("/", authenticate, authorize("admin"), async (_req: AuthRequest, res) => {
  try {
    const users = getUsers().map((u: any) => ({
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

    const users = getUsers();
    if (users.find((u: any) => u.email === email)) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: nextUserId++,
      email,
      name,
      role,
      password_hash: passwordHash,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    saveUsers(users);

    await logAudit({
      userId: req.user!.id,
      action: "create_user",
      entityType: "user",
      entityId: String(newUser.id),
      details: `Created user: ${email} (${role})`,
      ipAddress: req.ip,
    });

    return res.status(201).json({ id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role });
  } catch (error: any) {
    console.error("Create user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", authenticate, authorize("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { email, name, role, isActive, password } = req.body;

    const users = getUsers();
    const idx = users.findIndex((u: any) => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    if (email) users[idx].email = email;
    if (name) users[idx].name = name;
    if (role) users[idx].role = role;
    if (isActive !== undefined) users[idx].is_active = isActive;
    if (password) {
      users[idx].password_hash = await bcrypt.hash(password, 10);
    }

    saveUsers(users);

    await logAudit({
      userId: req.user!.id,
      action: "update_user",
      entityType: "user",
      entityId: String(id),
      details: `Updated user: ${users[idx].email}`,
      ipAddress: req.ip,
    });

    return res.json({
      id: users[idx].id,
      email: users[idx].email,
      name: users[idx].name,
      role: users[idx].role,
      isActive: !!users[idx].is_active,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
