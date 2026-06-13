import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, getDoctorStats, getDoctorRecent, getDoctorMonthly, getDoctorPolyDistribution, getDoctorOperasiStats, getDoctorTopObat } from "../services/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, AreaChart, Area,
} from "recharts";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const STAT_CARDS = [
  { key: "hari_ini", label: "Hari Ini", gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)", icon: "today" },
  { key: "bulan_ini", label: "Bulan Ini", gradient: "linear-gradient(135deg, #10b981, #059669)", icon: "month" },
  { key: "tahun_ini", label: "Tahun Ini", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", icon: "year" },
  { key: "total_keseluruhan", label: "Total", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", icon: "all" },
];

function AnimatedStat({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1000;
    const step = Math.max(1, Math.floor(end / 50));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, duration / 50);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

export default function Dashboard() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [polyDist, setPolyDist] = useState<any[]>([]);
  const [operasiStats, setOperasiStats] = useState<any>(null);
  const [topObat, setTopObat] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDoctorStats().then(setStats).catch(() => {}),
      getDoctorRecent().then(setRecent).catch(() => {}),
      getDoctorMonthly().then(setMonthly).catch(() => {}),
      getDoctorPolyDistribution().then(setPolyDist).catch(() => {}),
      getDoctorOperasiStats().then(setOperasiStats).catch(() => {}),
      getDoctorTopObat().then(setTopObat).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "-";
    return dt.toLocaleDateString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  };

  const recentTotal = monthly.reduce((acc: any[], item: any) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    acc.push({ ...item, cumulative: prev + Number(item.total) });
    return acc;
  }, []);

  return (
    <div className="dashboard page-fade-in">
      <div className="dash-header">
        <div className="dash-header-glow" />
        <div className="dash-header-content">
          <div>
            <h1 className="dash-title">Dashboard</h1>
            <p className="dash-subtitle">Selamat datang, <strong>{user?.name}</strong></p>
          </div>
          <div className="dash-date">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </div>

      <div className="dash-stats">
        {STAT_CARDS.map((card, i) => {
          const data = stats?.[card.key];
          return (
            <div key={card.key} className="dash-stat-card" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="dash-stat-bg" style={{ background: card.gradient }} />
              <div className="dash-stat-content">
                <div className="dash-stat-value" style={{ fontSize: 22 }}>
                  {loading ? "..." : <AnimatedStat value={data?.total || 0} />}
                </div>
                <div className="dash-stat-label" style={{ fontSize: 13, marginBottom: 6 }}>{card.label}</div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85 }}>
                  <span>Ralan: {loading ? "..." : (data?.ralan || 0)}</span>
                  <span>Ranap: {loading ? "..." : (data?.ranap || 0)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dash-stats" style={{ marginTop: 0 }}>
        {["hari_ini", "bulan_ini", "tahun_ini", "total_keseluruhan"].map((key, i) => {
          const labels: Record<string, string> = { hari_ini: "Hari Ini", bulan_ini: "Bulan Ini", tahun_ini: "Tahun Ini", total_keseluruhan: "Total" };
          const gradients: Record<string, string> = { hari_ini: "linear-gradient(135deg, #06b6d4, #0891b2)", bulan_ini: "linear-gradient(135deg, #8b5cf6, #7c3aed)", tahun_ini: "linear-gradient(135deg, #f43f5e, #e11d48)", total_keseluruhan: "linear-gradient(135deg, #14b8a6, #0d9488)" };
          const data = operasiStats?.[key];
          return (
            <div key={key} className="dash-stat-card" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="dash-stat-bg" style={{ background: gradients[key] }} />
              <div className="dash-stat-content">
                <div className="dash-stat-value" style={{ fontSize: 22 }}>
                  {loading ? "..." : <AnimatedStat value={data?.total || 0} />}
                </div>
                <div className="dash-stat-label" style={{ fontSize: 13, marginBottom: 6 }}>Operasi {labels[key]}</div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85 }}>
                  <span>Laporan: {loading ? "..." : (data?.sudah_laporan || 0)}</span>
                  <span>Belum: {loading ? "..." : (data?.belum_laporan || 0)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {recent.length > 0 && (
        <div className="dash-chart-card" style={{ marginBottom: 20, animationDelay: "0.1s" }}>
          <div className="dash-chart-header">
            <h3>5 Pasien Terakhir</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate("/resume-ralan")}>Lihat Semua</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="recent-table">
              <thead>
                <tr>
                  <th>No. RM</th>
                  <th>Nama Pasien</th>
                  <th>Tanggal</th>
                  <th>Layanan</th>
                  <th>Poli / Ruang</th>
                  <th>Dokter</th>
                  <th>Resume</th>
                  <th>Operasi</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p: any) => (
                  <tr key={p.no_rawat} style={{ cursor: "pointer" }}
                    onClick={() => navigate(p.status_lanjut === "Ranap" ? "/resume-ranap" : "/resume-ralan")}>
                    <td>{p.no_rkm_medis}</td>
                    <td><strong>{p.nm_pasien}</strong></td>
                    <td>{formatDate(p.tgl_registrasi)}</td>
                    <td><span className={`badge-${p.status_lanjut === "Ranap" ? "ranap" : "ralan"}`}>{p.status_lanjut}</span></td>
                    <td>{p.nm_poli || "-"}</td>
                    <td>{p.nm_dokter || "-"}</td>
                    <td>{Number(p.has_resume) > 0 ? <span style={{ color: "var(--success)" }}>Sudah</span> : <span style={{ color: "var(--warning)" }}>Belum</span>}</td>
                    <td>{p.has_laporan_operasi ? <span style={{ color: "var(--success)" }}>Laporan</span> : p.has_operasi ? <span style={{ color: "var(--warning)" }}>Operasi</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="dash-charts">
        <div className="dash-chart-card" style={{ animationDelay: "0.15s" }}>
          <div className="dash-chart-header">
            <h3>Kunjungan Bulanan</h3>
            <span className="dash-chart-badge">12 bulan</span>
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={monthly} barCategoryGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Bar dataKey="ralan" name="Rawat Jalan" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="ranap" name="Rawat Inap" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-chart-card" style={{ animationDelay: "0.2s" }}>
          <div className="dash-chart-header">
            <h3>Distribusi Poliklinik</h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={polyDist} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }} barCategoryGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis type="category" dataKey="nm_poli" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#475569" }} width={140} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Bar dataKey="total" name="Jumlah Kunjungan" radius={[0, 6, 6, 0]}>
                {polyDist.map((_: any, idx: number) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {monthly.length > 0 && (
          <div className="dash-chart-card" style={{ animationDelay: "0.25s" }}>
            <div className="dash-chart-header">
              <h3>Akumulasi Kunjungan</h3>
              <span className="dash-chart-badge">12 bulan</span>
            </div>
            <ResponsiveContainer width="100%" height={290}>
              <AreaChart data={recentTotal}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <Area type="monotone" dataKey="cumulative" stroke="#ec4899" strokeWidth={2.5} fill="url(#cumGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {topObat.length > 0 && (
        <div className="dash-chart-card" style={{ animationDelay: "0.25s" }}>
          <div className="dash-chart-header">
            <h3>10 Obat Terbanyak Diresepkan</h3>
            <span className="dash-chart-badge">Sepanjang Masa</span>
          </div>
          <div className="top-obat-scroll">
            {topObat.map((item: any, idx: number) => (
              <div key={idx} className="top-obat-card" style={{ borderLeft: `4px solid ${COLORS[idx % COLORS.length]}` }}>
                <div className="top-obat-rank">#{idx + 1}</div>
                <div className="top-obat-info">
                  <span className="top-obat-name">{item.nama_brng}</span>
                  <span className="top-obat-count">{item.total} x diresepkan</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}