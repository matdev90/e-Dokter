import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authenticate, authorize } from "../middleware/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

router.get("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const logFile = path.join(__dirname, "../../logs/audit.log");
    if (!fs.existsSync(logFile)) {
      return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    const lines = fs.readFileSync(logFile, "utf8").split("\n").filter(Boolean);
    const logs = lines.reverse().map((line: string) => {
      try {
        const entry = JSON.parse(line);
        return {
          id: entry.timestamp,
          userId: entry.userId,
          userName: entry.userId ? `User #${entry.userId}` : null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          details: entry.details,
          ipAddress: entry.ipAddress,
          createdAt: entry.timestamp,
        };
      } catch { return null; }
    }).filter(Boolean);

    const total = logs.length;
    const offset = (page - 1) * limit;
    const data = logs.slice(offset, offset + limit);

    return res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Audit log error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
