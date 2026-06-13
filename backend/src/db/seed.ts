import { pool, initAppTables } from "./index";
import bcrypt from "bcryptjs";

async function seed() {
  await initAppTables();

  const [rows] = await pool.execute("SELECT id FROM app_users WHERE email = ?", ["admin@specialistcare.id"]);
  if ((rows as any[]).length > 0) {
    console.log("Seed data already exists");
    process.exit(0);
  }

  const hash = await bcrypt.hash("admin123", 10);

  await pool.execute(
    `INSERT INTO app_users (email, password_hash, name, role, doctor_code) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
    [
      "admin@specialistcare.id", hash, "Admin Utama", "admin", null,
      "dr.reza@specialistcare.id", hash, "Dr. Reza", "doctor", "D00000034",
      "dr.ayu@specialistcare.id", hash, "Dr. Ayu", "doctor", "D0000018",
      "staff@specialistcare.id", hash, "Staf Admin", "assistant", null,
    ]
  );

  console.log("Seed data created!");
  console.log("Default password for all users: admin123");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
