import { Router } from "express";
import { pool } from "../db";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at,
              u.name as user_name
       FROM audit_logs a
       LEFT JOIN app_users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [String(limit), String(offset)]
    );

    const [countRows] = await pool.execute("SELECT COUNT(*) as cnt FROM audit_logs");
    const total = (countRows as any[])[0].cnt;

    const logs = (rows as any[]).map((l: any) => ({
      id: l.id,
      userId: l.user_id,
      action: l.action,
      entityType: l.entity_type,
      entityId: l.entity_id,
      details: l.details,
      ipAddress: l.ip_address,
      createdAt: l.created_at,
      userName: l.user_name,
    }));

    return res.json({
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Audit log error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
