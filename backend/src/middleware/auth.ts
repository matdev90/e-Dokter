import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JWT_SECRET: string = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET tidak diatur di environment");
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: "doctor" | "assistant" | "admin";
    name: string;
    doctor_code?: string;
  };
}

export function generateTokens(user: { id: number; email: string; role: string; name: string; doctor_code?: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, doctor_code: user.doctor_code },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: "refresh" },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  return { accessToken, refreshToken };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
      doctor_code: decoded.doctor_code,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export async function logAudit(params: {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    const logDir = path.join(__dirname, "../../logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "audit.log");
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
    fs.appendFileSync(logFile, entry + "\n");
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
