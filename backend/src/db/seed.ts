import bcrypt from "bcryptjs";
import { getUsers, saveUsers } from "./store";
import { pool } from "./index";

async function seed() {
  const users = getUsers();
  const hasAdmin = users.some((u: any) => u.role === "admin" || u.role === "assistant");
  if (hasAdmin) {
    console.log("Seed data already exists (admin/assistant found in users.json)");
    process.exit(0);
  }

  const hash = await bcrypt.hash("admin123", 10);

  let nextId = Date.now();
  const seedUsers = [
    { email: "admin@specialistcare.id", username: "admin", name: "Admin Utama", role: "admin", doctor_code: null, password_hash: hash },
    { email: "staff@specialistcare.id", username: "staff", name: "Staf Admin", role: "assistant", doctor_code: null, password_hash: hash },
  ];

  seedUsers.forEach((u: any) => {
    u.id = nextId++;
    u.is_active = true;
    u.created_at = new Date().toISOString();
    users.push(u);
  });
  saveUsers(users);

  console.log("Seed data created!");
  console.log("Default login — email: admin@specialistcare.id, password: admin123");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
