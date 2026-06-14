import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const REFRESH_TOKENS_FILE = path.join(DATA_DIR, "refresh_tokens.json");

function readJSON(file: string): any[] {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch { /* ignore */ }
  return [];
}

function writeJSON(file: string, data: any[]) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function getUsers() {
  return readJSON(USERS_FILE) as any[];
}

export function saveUsers(users: any[]) {
  writeJSON(USERS_FILE, users);
}

export function getRefreshTokens() {
  return readJSON(REFRESH_TOKENS_FILE) as any[];
}

export function saveRefreshTokens(tokens: any[]) {
  writeJSON(REFRESH_TOKENS_FILE, tokens);
}
