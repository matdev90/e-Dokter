import express from "express";

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.get("/ping", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`e-Dokter health server running on http://localhost:${PORT}`);
});
