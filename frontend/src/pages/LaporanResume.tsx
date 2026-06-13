import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getResumeList, getResumeDetail, deleteResume, getResumeStats, getResumePenjab, updateResumeRalan, updateResumeRanap } from "../services/api";
import CenteredNotification from "../components/CenteredNotification";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

const STAT_GRADIENTS = [
  { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
  { bg: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" },
];

export default function LaporanResume() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [jenis, setJenis] = useState("");
  const [tglFrom, setTglFrom] = useState("");
  const [tglTo, setTglTo] = useState("");
  const [pj, setPj] = useState("");
  const [pjOptions, setPjOptions] = useState<{ kd_pj: string; png_jawab: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<{type: "success" | "error"; message: string; detail?: string} | null>(null);

  useEffect(() => {
    getResumePenjab().then(setPjOptions).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [jenis]);

  useEffect(() => {
    fetchData();
  }, [page, searchText, jenis, tglFrom, tglTo, pj]);

  const loadStats = (filters?: { tgl_from?: string; tgl_to?: string; pj?: string }) => {
    setLoadingStats(true);
    getResumeStats(filters).then(setStats).catch(() => {}).finally(() => setLoadingStats(false));
  };

  useEffect(() => {
    loadStats({ tgl_from: tglFrom || undefined, tgl_to: tglTo || undefined, pj: pj || undefined });
  }, [tglFrom, tglTo, pj]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getResumeList({
        q: searchText, page, limit,
        jenis: jenis || undefined,
        tgl_from: tglFrom || undefined,
        tgl_to: tglTo || undefined,
        pj: pj || undefined,
      });
      setList(res.data || []);
      setTotalPages(res.totalPages || 0);
      setTotal(res.total || 0);
    } catch {
      setList([]);
    }
    setLoading(false);
  };

  const handleDelete = async (no_rawat: string) => {
    try {
      await deleteResume(no_rawat);
      setConfirmDelete(null);
      setNotif({ type: "success", message: "Resume berhasil dihapus" });
      setTimeout(() => setNotif(null), 1500);
      loadStats({ tgl_from: tglFrom || undefined, tgl_to: tglTo || undefined, pj: pj || undefined });
      fetchData();
    } catch {
      setNotif({ type: "error", message: "Gagal menghapus resume" });
    }
  };

  const handlePreview = async (no_rawat: string) => {
    try {
      const detail = await getResumeDetail(no_rawat);
      setPreview(detail);
    } catch {
      setNotif({ type: "error", message: "Gagal memuat detail resume" });
    }
  };

  const handleEdit = async (no_rawat: string) => {
    try {
      const detail = await getResumeDetail(no_rawat);
      setEditing(detail);
      const f: any = {};
      Object.keys(detail).forEach((k) => { f[k] = detail[k] ?? ""; });
      setEditForm(f);
    } catch {
      setNotif({ type: "error", message: "Gagal memuat data resume" });
    }
  };

  const handleEditSave = async () => {
    setSaving(true);
    setNotif(null);
    try {
      const no_rawat = editForm.no_rawat;
      const payload: any = {};
      const fields = editForm.jenis_rawat === "Ranap"
        ? ["keluhan_utama","diagnosa_utama","diagnosa_sekunder","diagnosa_sekunder2","diagnosa_sekunder3","diagnosa_sekunder4","prosedur_utama","prosedur_sekunder","pemeriksaan_penunjang","hasil_laborat","obat_pulang","diagnosa_awal","pemeriksaan_fisik","jalannya_penyakit","tindakan_dan_operasi","obat_di_rs","edukasi","cara_keluar","keadaan","kontrol","alergi","diet","lab_belum"]
        : ["keluhan_utama","diagnosa_utama","diagnosa_sekunder","diagnosa_sekunder2","diagnosa_sekunder3","diagnosa_sekunder4","prosedur_utama","prosedur_sekunder","pemeriksaan_penunjang","hasil_laborat","obat_pulang"];
      fields.forEach((f) => { payload[f] = editForm[f] || ""; });
      if (editForm.jenis_rawat === "Ranap") {
        await updateResumeRanap(no_rawat, payload);
      } else {
        await updateResumeRalan(no_rawat, payload);
      }
      setEditing(null);
      setNotif({ type: "success", message: "Data berhasil diperbaharui" });
      setTimeout(() => setNotif(null), 1500);
      fetchData();
      loadStats({ tgl_from: tglFrom || undefined, tgl_to: tglTo || undefined, pj: pj || undefined });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || "Gagal menyimpan perubahan";
      setNotif({ type: "error", message: "Gagal memperbarui resume", detail: `Penyebab: ${errMsg}` });
    }
    setSaving(false);
  };

  const formatDate = (d: string) => {
    if (!d) return "-";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "-";
    return dt.toLocaleDateString("id-ID", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  };

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h1>Laporan Resume</h1>
          <p className="text-muted">Daftar resume pasien rawat jalan & rawat inap</p>
        </div>
        <div className="table-stats">
          <span className="stat-chip">{total} resume</span>
        </div>
      </div>

      <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 20 }}>
        {loadingStats ? (
          <>
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="stat-card" style={{ borderRadius: 12, padding: "18px 20px", background: "linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%)", position: "relative", overflow: "hidden" }}>
                <div className="shimmer-line" style={{ width: "40%", height: 28, marginBottom: 8 }} />
                <div className="shimmer-line" style={{ width: "60%", height: 14 }} />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[0].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{(stats?.ralan?.total ?? 0) + (stats?.ranap?.total ?? 0)}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total Resume</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                <span>Ralan: {stats?.ralan?.total ?? 0}</span>
                <span>Ranap: {stats?.ranap?.total ?? 0}</span>
              </div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[1].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{(stats?.ralan?.sudah_resume ?? 0) + (stats?.ranap?.sudah_resume ?? 0)} <span style={{ fontSize: 16, opacity: 0.7 }}>/ {(stats?.ralan?.belum_resume ?? 0) + (stats?.ranap?.belum_resume ?? 0)}</span></div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Sudah / Belum Diresume</div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[2].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.ralan?.bpjs ?? 0} <span style={{ fontSize: 16, opacity: 0.7 }}>/ {stats?.ralan?.umum ?? 0}</span></div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>BPJS / Umum (Ralan)</div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[3].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.ranap?.bpjs ?? 0} <span style={{ fontSize: 16, opacity: 0.7 }}>/ {stats?.ranap?.umum ?? 0}</span></div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>BPJS / Umum (Ranap)</div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[4].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{(stats?.ralan?.bpjs ?? 0) + (stats?.ranap?.bpjs ?? 0)} <span style={{ fontSize: 16, opacity: 0.7 }}>/ {(stats?.ralan?.umum ?? 0) + (stats?.ranap?.umum ?? 0)}</span></div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total BPJS / Umum</div>
            </div>
          </>
        )}
      </div>

      <div className="filter-bar filter-bar-modern">
        <div className="filter-form">
          <div className="filter-row">
            <div className="filter-group">
              <label>Nama / No. RM</label>
              <input placeholder="Cari pasien..." value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(1); }} />
            </div>
            <div className="filter-group">
              <label>Jenis Rawat</label>
              <select value={jenis} onChange={(e) => { setJenis(e.target.value); setPage(1); }}>
                <option value="">Semua Jenis</option>
                <option value="ralan">Rawat Jalan</option>
                <option value="ranap">Rawat Inap</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Dari Tanggal</label>
              <input type="date" value={tglFrom}
                onChange={(e) => { setTglFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="filter-group">
              <label>Sampai Tanggal</label>
              <input type="date" value={tglTo}
                onChange={(e) => { setTglTo(e.target.value); setPage(1); }} />
            </div>
            <div className="filter-group">
              <label>Penanggung Jawab</label>
              <select value={pj} onChange={(e) => { setPj(e.target.value); setPage(1); }}>
                <option value="">Semua PJ</option>
                {pjOptions.map((o) => <option key={o.kd_pj} value={o.kd_pj}>{o.png_jawab}</option>)}
              </select>
            </div>
            <div className="filter-group" style={{ justifyContent: "flex-end", alignSelf: "flex-end" }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
                Total: <strong>{total}</strong> resume
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="patient-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="patient-card" style={{ padding: "1rem" }}>
              <div className="skeleton" style={{ height: 20, width: "60%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: "80%", marginBottom: 4 }} />
              <div className="skeleton" style={{ height: 14, width: "40%" }} />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="empty-state" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
          <p>Tidak ada resume ditemukan</p>
        </div>
      ) : (
        <div className="patient-grid">
          {list.map((item: any, idx: number) => {
            const initial = (item.nm_pasien || "?")[0].toUpperCase();
            const colors = ["#2563eb","#16a34a","#f59e0b","#dc2626","#8b5cf6","#ec4899","#06b6d4","#f97316"];
            const color = colors[idx % colors.length];
            return (
              <div key={item.no_rawat} className="patient-card" style={{ animationDelay: `${(idx % limit) * 30}ms` }}>
                <div className="patient-card-main">
                  <div className="patient-avatar" style={{ background: color }}>{initial}</div>
                  <div className="patient-details">
                    <div className="patient-name">{item.nm_pasien || "-"}</div>
                    <div className="patient-meta">
                      <span>No. RM: {item.no_rkm_medis}</span>
                      <span className="meta-dot">&bull;</span>
                      <span>{item.no_rawat}</span>
                    </div>
                    <div className="patient-meta" style={{ gap: 6 }}>
                      <span className={`badge-${item.jenis_rawat === "Ranap" ? "ranap" : "ralan"}`} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>
                        {item.jenis_rawat}
                      </span>
                      <span className="text-muted" style={{ fontSize: 12 }}>{item.poli}</span>
                      {item.png_jawab && (
                        <span className="text-muted" style={{ fontSize: 11, opacity: 0.7 }}>({item.png_jawab})</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="patient-card-footer">
                  {item.diagnosa_utama && (
                    <div className="footer-info" style={{ width: "100%" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      <span>{item.diagnosa_utama}</span>
                    </div>
                  )}
                  <div className="footer-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>{item.nm_dokter || "-"}</span>
                  </div>
                  <div className="footer-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>{formatDate(item.tgl_registrasi)}</span>
                  </div>
                  
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", paddingTop: 10, marginTop: 10, borderTop: "1px solid var(--border)" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => handlePreview(item.no_rawat)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Lihat
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => handleEdit(item.no_rawat)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit Resume
                  </button>
                  <button className="btn btn-outline btn-sm" style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => setConfirmDelete(item.no_rawat)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-modern">
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Sebelumnya
          </button>
          <div className="page-numbers">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const num = start + i;
              if (num > totalPages) return null;
              return <button key={num} className={`page-num ${num === page ? "active" : ""}`} onClick={() => setPage(num)}>{num}</button>;
            })}
          </div>
          <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Selanjutnya
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}

      <DeleteConfirmModal
        open={!!confirmDelete}
        title="Hapus Resume Pasien"
        message="Apakah Anda yakin ingin menghapus resume ini? Data yang sudah dihapus tidak dapat dikembalikan."
        identifier={confirmDelete || ""}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal-content" style={{ padding: "1.5rem", maxWidth: 750, width: "90%", maxHeight: "90vh", overflow: "auto", background: "var(--surface)", borderRadius: "var(--radius-lg)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>Detail Resume</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => setPreview(null)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                <div><strong>Pasien:</strong> {preview.nm_pasien}</div>
                <div><strong>No. RM:</strong> {preview.no_rkm_medis}</div>
                <div><strong>No. Rawat:</strong> {preview.no_rawat}</div>
                <div><strong>Dokter:</strong> {preview.nm_dokter}</div>
                <div><strong>Jenis:</strong> <span className={`badge-${preview.jenis_rawat === "Ranap" ? "ranap" : "ralan"}`}>{preview.jenis_rawat}</span></div>
                <div><strong>Poli/Ruang:</strong> {preview.nm_poli || "-"}</div>
                {preview.ruang_rawat && <div><strong>Ruangan:</strong> {preview.ruang_rawat}</div>}
              </div>
            </div>

            <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid var(--border)" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              {preview.keluhan_utama && <div><strong>Keluhan Utama:</strong><br />{preview.keluhan_utama}</div>}
              {preview.diagnosa_utama && <div><strong>Diagnosa Utama:</strong><br />{preview.diagnosa_utama}</div>}
              {preview.diagnosa_sekunder && <div><strong>Diagnosa Sekunder:</strong><br />{preview.diagnosa_sekunder}</div>}
              {preview.diagnosa_sekunder2 && <div><strong>Diagnosa Sekunder 2:</strong><br />{preview.diagnosa_sekunder2}</div>}
              {preview.diagnosa_sekunder3 && <div><strong>Diagnosa Sekunder 3:</strong><br />{preview.diagnosa_sekunder3}</div>}
              {preview.diagnosa_sekunder4 && <div><strong>Diagnosa Sekunder 4:</strong><br />{preview.diagnosa_sekunder4}</div>}
              {preview.prosedur_utama && <div><strong>Prosedur Utama:</strong><br />{preview.prosedur_utama}</div>}
              {preview.prosedur_sekunder && <div><strong>Prosedur Sekunder:</strong><br />{preview.prosedur_sekunder}</div>}
              {preview.pemeriksaan_penunjang && <div><strong>Pemeriksaan Penunjang:</strong><br />{preview.pemeriksaan_penunjang}</div>}
              {preview.hasil_laborat && <div><strong>Hasil Laborat:</strong><br />{preview.hasil_laborat}</div>}
              {preview.obat_pulang && <div><strong>Obat Pulang:</strong><br />{preview.obat_pulang}</div>}
              {preview.jenis_rawat === "Ranap" && (
                <>
                  {preview.diagnosa_awal && <div><strong>Diagnosa Awal:</strong><br />{preview.diagnosa_awal}</div>}
                  {preview.pemeriksaan_fisik && <div><strong>Pemeriksaan Fisik:</strong><br />{preview.pemeriksaan_fisik}</div>}
                  {preview.jalannya_penyakit && <div><strong>Jalannya Penyakit:</strong><br />{preview.jalannya_penyakit}</div>}
                  {preview.tindakan_dan_operasi && <div><strong>Tindakan & Operasi:</strong><br />{preview.tindakan_dan_operasi}</div>}
                  {preview.obat_di_rs && <div><strong>Obat di RS:</strong><br />{preview.obat_di_rs}</div>}
                  {preview.edukasi && <div><strong>Edukasi:</strong><br />{preview.edukasi}</div>}
                  {preview.cara_keluar && <div><strong>Cara Keluar:</strong><br />{preview.cara_keluar}</div>}
                  {preview.keadaan && <div><strong>Keadaan:</strong><br />{preview.keadaan}</div>}
                  {preview.kontrol && <div><strong>Kontrol:</strong><br />{preview.kontrol}</div>}
                  {preview.alergi && <div><strong>Alergi:</strong><br />{preview.alergi}</div>}
                  {preview.diet && <div><strong>Diet:</strong><br />{preview.diet}</div>}
                  {preview.lab_belum && <div><strong>Lab Belum:</strong><br />{preview.lab_belum}</div>}
                </>
              )}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary btn-sm" onClick={() => { const nr = preview.no_rawat; setPreview(null); handleEdit(nr); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content" style={{ padding: "1.5rem", maxWidth: 750, width: "90%", maxHeight: "90vh", overflow: "auto", background: "var(--surface)", borderRadius: "var(--radius-lg)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>Edit Resume - {editForm.nm_pasien}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Keluhan Utama</label>
                  <textarea value={editForm.keluhan_utama || ""} onChange={(e) => setEditForm({...editForm, keluhan_utama: e.target.value})} rows={3} />
                </div>
                <div className="form-group">
                  <label>Diagnosa Utama</label>
                  <textarea value={editForm.diagnosa_utama || ""} onChange={(e) => setEditForm({...editForm, diagnosa_utama: e.target.value})} rows={3} />
                </div>
              </div>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Diagnosa Sekunder</label>
                  <textarea value={editForm.diagnosa_sekunder || ""} onChange={(e) => setEditForm({...editForm, diagnosa_sekunder: e.target.value})} rows={2} />
                </div>
                <div className="form-group">
                  <label>Diagnosa Sekunder 2</label>
                  <textarea value={editForm.diagnosa_sekunder2 || ""} onChange={(e) => setEditForm({...editForm, diagnosa_sekunder2: e.target.value})} rows={2} />
                </div>
              </div>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Diagnosa Sekunder 3</label>
                  <textarea value={editForm.diagnosa_sekunder3 || ""} onChange={(e) => setEditForm({...editForm, diagnosa_sekunder3: e.target.value})} rows={2} />
                </div>
                <div className="form-group">
                  <label>Diagnosa Sekunder 4</label>
                  <textarea value={editForm.diagnosa_sekunder4 || ""} onChange={(e) => setEditForm({...editForm, diagnosa_sekunder4: e.target.value})} rows={2} />
                </div>
              </div>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Prosedur Utama</label>
                  <textarea value={editForm.prosedur_utama || ""} onChange={(e) => setEditForm({...editForm, prosedur_utama: e.target.value})} rows={2} />
                </div>
                <div className="form-group">
                  <label>Prosedur Sekunder</label>
                  <textarea value={editForm.prosedur_sekunder || ""} onChange={(e) => setEditForm({...editForm, prosedur_sekunder: e.target.value})} rows={2} />
                </div>
              </div>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Pemeriksaan Penunjang</label>
                  <textarea value={editForm.pemeriksaan_penunjang || ""} onChange={(e) => setEditForm({...editForm, pemeriksaan_penunjang: e.target.value})} rows={2} />
                </div>
                <div className="form-group">
                  <label>Hasil Laborat</label>
                  <textarea value={editForm.hasil_laborat || ""} onChange={(e) => setEditForm({...editForm, hasil_laborat: e.target.value})} rows={2} />
                </div>
              </div>
              <div className="form-group">
                <label>Obat Pulang</label>
                <textarea value={editForm.obat_pulang || ""} onChange={(e) => setEditForm({...editForm, obat_pulang: e.target.value})} rows={2} />
              </div>
              {editForm.jenis_rawat === "Ranap" && (
                <>
                  <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label>Diagnosa Awal</label>
                      <textarea value={editForm.diagnosa_awal || ""} onChange={(e) => setEditForm({...editForm, diagnosa_awal: e.target.value})} rows={2} />
                    </div>
                    <div className="form-group">
                      <label>Pemeriksaan Fisik</label>
                      <textarea value={editForm.pemeriksaan_fisik || ""} onChange={(e) => setEditForm({...editForm, pemeriksaan_fisik: e.target.value})} rows={2} />
                    </div>
                  </div>
                  <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label>Jalannya Penyakit</label>
                      <textarea value={editForm.jalannya_penyakit || ""} onChange={(e) => setEditForm({...editForm, jalannya_penyakit: e.target.value})} rows={2} />
                    </div>
                    <div className="form-group">
                      <label>Tindakan & Operasi</label>
                      <textarea value={editForm.tindakan_dan_operasi || ""} onChange={(e) => setEditForm({...editForm, tindakan_dan_operasi: e.target.value})} rows={2} />
                    </div>
                  </div>
                  <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label>Obat di RS</label>
                      <textarea value={editForm.obat_di_rs || ""} onChange={(e) => setEditForm({...editForm, obat_di_rs: e.target.value})} rows={2} />
                    </div>
                    <div className="form-group">
                      <label>Edukasi</label>
                      <textarea value={editForm.edukasi || ""} onChange={(e) => setEditForm({...editForm, edukasi: e.target.value})} rows={2} />
                    </div>
                  </div>
                  <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label>Cara Keluar</label>
                      <input value={editForm.cara_keluar || ""} onChange={(e) => setEditForm({...editForm, cara_keluar: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Keadaan</label>
                      <input value={editForm.keadaan || ""} onChange={(e) => setEditForm({...editForm, keadaan: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label>Kontrol</label>
                      <input value={editForm.kontrol || ""} onChange={(e) => setEditForm({...editForm, kontrol: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Alergi</label>
                      <input value={editForm.alergi || ""} onChange={(e) => setEditForm({...editForm, alergi: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label>Diet</label>
                      <input value={editForm.diet || ""} onChange={(e) => setEditForm({...editForm, diet: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Lab Belum</label>
                      <input value={editForm.lab_belum || ""} onChange={(e) => setEditForm({...editForm, lab_belum: e.target.value})} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setEditing(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>{saving ? "Menyimpan..." : "Update"}</button>
            </div>
          </div>
        </div>
      )}

      {notif && (
        <CenteredNotification type={notif.type} message={notif.message} detail={notif.detail} onClose={() => setNotif(null)} />
      )}
    </div>
  );
}
