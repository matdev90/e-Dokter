import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "09",
  database: process.env.DB_NAME || "rsisa_lokal",
  waitForConnections: true,
  connectionLimit: 10,
});
