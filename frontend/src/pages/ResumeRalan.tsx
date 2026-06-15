import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { searchRalanVisit, getResumeRalan, createResumeRalan, updateResumeRalan, searchICD10, searchICD9, getResumeRalanAutoFill, getPoliklinik, getResumeRalanStats, getPenjab, getCurrentJadwal } from "../services/api";
import CenteredNotification from "../components/CenteredNotification";
import IcdAutocompleteInput from "../components/IcdAutocompleteInput";

const LIMIT_OPTIONS = [12, 24, 36, 48, 60, 0];

export default function ResumeRalan() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [notif, setNotif] = useState<{ type: "success" | "error" | "info"; message: string; detail?: string } | null>(null);

  const [tglFrom, setTglFrom] = useState("");
  const [tglTo, setTglTo] = useState("");
  const [kdPj, setKdPj] = useState("");
  const [poli, setPoli] = useState("");
  const [poliOptions, setPoliOptions] = useState<{ kd_poli: string; nm_poli: string }[]>([]);
  const [jadwalLocked, setJadwalLocked] = useState(false);
  const [jadwalInfo, setJadwalInfo] = useState<string>("");
  const [penjabOptions, setPenjabOptions] = useState<{ kd_pj: string; png_jawab: string }[]>([]);

  const [view, setView] = useState<"list" | "form">("list");
  const [currentVisit, setCurrentVisit] = useState<any>(null);
  const [existingResume, setExistingResume] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visit: any } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [loadingForm, setLoadingForm] = useState(false);

  const [form, setForm] = useState({
    no_rawat: "", tanggal: "", no_rkm_medis: "", nm_pasien: "", nm_dokter: "",
    kd_dokter: "",
    keluhan_utama: "",
    pemeriksaan_penunjang: "",
    hasil_laborat: "",
    diagnosa_utama: "", kd_diagnosa_utama: "",
    diagnosa_sekunder: "", kd_diagnosa_sekunder: "",
    diagnosa_sekunder2: "", kd_diagnosa_sekunder2: "",
    diagnosa_sekunder3: "", kd_diagnosa_sekunder3: "",
    diagnosa_sekunder4: "", kd_diagnosa_sekunder4: "",
    prosedur_utama: "", kd_prosedur_utama: "",
    prosedur_sekunder: "", kd_prosedur_sekunder: "",
    prosedur_sekunder2: "", kd_prosedur_sekunder2: "",
    prosedur_sekunder3: "", kd_prosedur_sekunder3: "",
    kondisi_pulang: "Hidup",
    obat_pulang: "",
  });

  const clearForm = () => {
    setForm({
      no_rawat: "", tanggal: "", no_rkm_medis: "", nm_pasien: "", nm_dokter: "", kd_dokter: "",
      keluhan_utama: "",
      pemeriksaan_penunjang: "", hasil_laborat: "",
      diagnosa_utama: "", kd_diagnosa_utama: "",
      diagnosa_sekunder: "", kd_diagnosa_sekunder: "",
      diagnosa_sekunder2: "", kd_diagnosa_sekunder2: "",
      diagnosa_sekunder3: "", kd_diagnosa_sekunder3: "",
      diagnosa_sekunder4: "", kd_diagnosa_sekunder4: "",
      prosedur_utama: "", kd_prosedur_utama: "",
      prosedur_sekunder: "", kd_prosedur_sekunder: "",
      prosedur_sekunder2: "", kd_prosedur_sekunder2: "",
      prosedur_sekunder3: "", kd_prosedur_sekunder3: "",
      kondisi_pulang: "Hidup", obat_pulang: "",
    });
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await searchRalanVisit({ q: search, page, limit, tgl_from: tglFrom || today, tgl_to: tglTo || today, kd_pj: kdPj || undefined, poli: poli || undefined });
      setList(res.data || []);
      setTotalPages(res.pagination?.totalPages || 0);
      setTotal(res.pagination?.total || 0);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getPoliklinik().then((opts) => {
      setPoliOptions(opts);
    }).catch((e) => console.error("getPoliklinik:", e));
    getPenjab().then(setPenjabOptions).catch((e) => console.error("getPenjab:", e));
    getCurrentJadwal().then((j) => {
      if (j) {
        setJadwalLocked(j.locked);
        setPoli(j.kd_poli);
        setJadwalInfo(`${j.nm_poli} (${j.jam_mulai.slice(0,5)} - ${j.jam_selesai.slice(0,5)})`);
      }
    }).catch((e) => console.error("getCurrentJadwal:", e));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchText);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const s = await getResumeRalanStats();
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (view === "list") {
      loadList();
      loadStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tglFrom, tglTo, kdPj, poli, page, limit, refreshKey, view]);

  const handleContextMenu = (e: React.MouseEvent, visit: any) => {
    e.preventDefault();
    const sudahLengkap = visit.has_resume && visit.has_operasi && visit.has_laporan_operasi;
    if (sudahLengkap) {
      setNotif({ type: "info", message: "Semua dokumen sudah lengkap", detail: "Untuk melakukan edit data Resume / Laporan Operasi, silahkan buka menu Laporan Resume atau Laporan Operasi." });
      return;
    }

    const willShowLaporan = (visit.has_booking_operasi || visit.has_operasi) && !visit.has_laporan_operasi;
    const laporanDilarang = willShowLaporan && visit.status_bayar === "Sudah Bayar" && !visit.has_operasi;

    if (laporanDilarang) {
      setNotif({ type: "error", message: "Tidak dapat membuat laporan operasi", detail: "Pasien sudah bayar dan belum ada data operasi. Input laporan operasi baru akan menambah tagihan pasien." });
    }

    setContextMenu({ x: e.clientX, y: e.clientY, visit });
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const openForm = async (visit: any, edit: boolean) => {
    setCurrentVisit(visit);
    setIsEditing(edit);
    setError("");
    setSuccess("");
    setContextMenu(null);

    const base = {
      no_rawat: visit.no_rawat || "",
      tanggal: visit.tgl_registrasi || "",
      no_rkm_medis: visit.no_rkm_medis || "",
      nm_pasien: visit.nm_pasien || "",
      nm_dokter: visit.nm_dokter || "",
      kd_dokter: "",
      keluhan_utama: "",
      pemeriksaan_penunjang: "", hasil_laborat: "",
      diagnosa_utama: "", kd_diagnosa_utama: "",
      diagnosa_sekunder: "", kd_diagnosa_sekunder: "",
      diagnosa_sekunder2: "", kd_diagnosa_sekunder2: "",
      diagnosa_sekunder3: "", kd_diagnosa_sekunder3: "",
      diagnosa_sekunder4: "", kd_diagnosa_sekunder4: "",
      prosedur_utama: "", kd_prosedur_utama: "",
      prosedur_sekunder: "", kd_prosedur_sekunder: "",
      prosedur_sekunder2: "", kd_prosedur_sekunder2: "",
      prosedur_sekunder3: "", kd_prosedur_sekunder3: "",
      kondisi_pulang: "Hidup", obat_pulang: "",
    };

    if (edit) {
      try {
        const [resume, fill] = await Promise.all([
          getResumeRalan(visit.no_rawat),
          getResumeRalanAutoFill(visit.no_rawat).catch(() => ({})),
        ]);
        setExistingResume(resume);
        setForm({ ...base, ...fill, ...resume, kondisi_pulang: resume.kondisi_pulang || "Hidup" });
      } catch (err) {
        console.error("Edit resume load error:", err);
        setError("Gagal memuat data resume");
      }
    } else {
      setExistingResume(null);
      setLoadingForm(true);
      try {
        const fill = await getResumeRalanAutoFill(visit.no_rawat);
        setForm({ ...base, ...fill, kondisi_pulang: fill.kondisi_pulang || "Hidup" });
      } catch (err) {
        console.error("Auto-fill error:", err);
        setForm(base);
      }
      setLoadingForm(false);
    }
    setView("form");
  };

  const handleBatal = () => {
    setView("list");
    setCurrentVisit(null);
    setExistingResume(null);
    setIsEditing(false);
    clearForm();
    setError("");
    setSuccess("");
    setRefreshKey(k => k + 1);
  };

  const handleSave = async () => {
    setNotif(null);
    try {
      if (isEditing) {
        await updateResumeRalan(form.no_rawat, form);
      } else {
        await createResumeRalan(form);
      }
      setNotif({ type: "success", message: isEditing ? "Data berhasil diperbarui" : "Resume Rawat Jalan berhasil disimpan" });
      setTimeout(() => { setNotif(null); handleBatal(); }, 1500);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || "Gagal menyimpan resume";
      setNotif({ type: "error", message: "Resume Rawat Jalan - Gagal menyimpan", detail: `Penyebab: ${errMsg}` });
    }
  };

  const f = (key: string) => ({
    value: (form as any)[key] || "",
    onChange: (e: any) => setForm({ ...form, [key]: e.target.value }),
  });

  const renderIcdRow = (label: string, kdField: string, nameField: string) => {
    const isProsedur = kdField.startsWith("kd_prosedur");
    return (
      <IcdAutocompleteInput
        label={label}
        kdField={kdField}
        nameField={nameField}
        form={form}
        setForm={setForm}
        searchFn={isProsedur ? searchICD9 : searchICD10}
        placeholder={isProsedur ? "Cari ICD-9" : "Cari ICD-10"}
      />
    );
  };

  if (view === "form") {
    if (loadingForm) {
      return (
        <div className="page-fade-in">
          <div className="page-header">
            <h1>{isEditing ? "Edit Resume Rawat Jalan" : "Buat Resume Rawat Jalan"}</h1>
            <button className="btn btn-danger-outline" onClick={handleBatal}>Kembali</button>
          </div>
          <div className="form-loading">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="shimmer-card">
                <div className="shimmer-line w-30" />
                <div className="shimmer-grid">
                  <div className="shimmer-line h-32" />
                  <div className="shimmer-line h-32" />
                </div>
                <div className="shimmer-line h-60" style={{ marginTop: 12 }} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="page-fade-in">
        <div className="page-header">
          <h1>{isEditing ? "Edit Resume Rawat Jalan" : "Buat Resume Rawat Jalan"}</h1>
          <button className="btn btn-danger-outline" onClick={handleBatal}>Kembali</button>
        </div>

        {notif && (
          <CenteredNotification type={notif.type} message={notif.message} detail={notif.detail}
            onClose={() => setNotif(null)} autoClose={notif.type === "success" ? 1500 : 0} />
        )}

        <div className="form-scroll">
          <div className="section-card">
            <div className="section-header"><span className="section-icon">1</span> Identitas Pasien</div>
            <div className="section-body">
              <div className="form-grid-3">
                <div className="form-group">
                  <label>No. Rawat</label>
                  <input value={form.no_rawat} readOnly />
                </div>
                <div className="form-group">
                  <label>No. RM</label>
                  <input value={form.no_rkm_medis || form.tanggal} readOnly />
                </div>
                <div className="form-group">
                  <label>Nama Pasien</label>
                  <input value={form.nm_pasien} readOnly />
                </div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">2</span> Dokter &amp; Kondisi Pulang</div>
            <div className="section-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Dokter P.J.</label>
                  <input value={form.nm_dokter} readOnly />
                </div>
                <div className="form-group">
                  <label>Kondisi Pasien Pulang</label>
                  <select {...f("kondisi_pulang")}>
                    <option value="Hidup">Hidup</option>
                    <option value="Meninggal">Meninggal</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">3</span> Anamnesis &amp; Pemeriksaan</div>
            <div className="section-body">
              <div className="form-group">
                <label>Keluhan Utama / Riwayat Penyakit Yang Positif</label>
                <textarea rows={4} {...f("keluhan_utama")} />
              </div>
              <div className="form-group">
                <label>Pemeriksaan Penunjang Yang Positif</label>
                <textarea rows={3} {...f("pemeriksaan_penunjang")} />
              </div>
              <div className="form-group">
                <label>Hasil Laboratorium Yang Positif</label>
                <textarea rows={3} {...f("hasil_laborat")} />
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">4</span> Diagnosa Akhir</div>
            <div className="section-body">
              {renderIcdRow("Diagnosa Utama", "kd_diagnosa_utama", "diagnosa_utama")}
              <div className="section-divider" />
              <div className="diagnosis-subtitle">Diagnosa Sekunder</div>
              {renderIcdRow("Diagnosa Sekunder 1", "kd_diagnosa_sekunder", "diagnosa_sekunder")}
              {renderIcdRow("Diagnosa Sekunder 2", "kd_diagnosa_sekunder2", "diagnosa_sekunder2")}
              {renderIcdRow("Diagnosa Sekunder 3", "kd_diagnosa_sekunder3", "diagnosa_sekunder3")}
              {renderIcdRow("Diagnosa Sekunder 4", "kd_diagnosa_sekunder4", "diagnosa_sekunder4")}
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">5</span> Prosedur</div>
            <div className="section-body">
              {renderIcdRow("Prosedur Utama", "kd_prosedur_utama", "prosedur_utama")}
              <div className="section-divider" />
              <div className="diagnosis-subtitle">Prosedur Sekunder</div>
              {renderIcdRow("Prosedur Sekunder 1", "kd_prosedur_sekunder", "prosedur_sekunder")}
              {renderIcdRow("Prosedur Sekunder 2", "kd_prosedur_sekunder2", "prosedur_sekunder2")}
              {renderIcdRow("Prosedur Sekunder 3", "kd_prosedur_sekunder3", "prosedur_sekunder3")}
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">6</span> Obat &amp; Nasihat Pulang</div>
            <div className="section-body">
              <div className="form-group">
                <label>Obat-obatan Waktu Pulang / Nasihat</label>
                <textarea rows={4} {...f("obat_pulang")} />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-danger-outline" onClick={handleBatal}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave}>{isEditing ? "Update" : "Simpan"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h1>Rawat Jalan</h1>
          <p className="text-muted">Data pasien rawat jalan</p>
        </div>
        <div className="table-stats">
          <span className="stat-chip">{total} pasien</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="stats-row" style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16,
        marginBottom: 20
      }}>
        {loadingStats ? (
          <>
            {[1,2,3,4].map((i) => (
              <div key={i} className="stat-card" style={{
                borderRadius: 12, padding: "18px 20px",
                background: "linear-gradient(135deg, #e5e7eb 0%, #f3f4f6 100%)",
                position: "relative", overflow: "hidden"
              }}>
                <div className="shimmer-line" style={{ width: "40%", height: 28, marginBottom: 8 }} />
                <div className="shimmer-line" style={{ width: "60%", height: 14 }} />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="stat-card" style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 12, padding: "18px 20px", color: "#fff"
            }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.total ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total Pasien Hari Ini</div>
            </div>
            <div className="stat-card" style={{
              background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
              borderRadius: 12, padding: "18px 20px", color: "#fff"
            }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.bpjs ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>BPJS <span style={{ opacity: 0.6 }}>/</span> Umum</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                <span>BPJS: {stats?.bpjs ?? 0}</span>
                <span>Umum: {stats?.umum ?? 0}</span>
              </div>
            </div>
            <div className="stat-card" style={{
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              borderRadius: 12, padding: "18px 20px", color: "#fff"
            }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.sudah_resume ?? 0} <span style={{ fontSize: 16, opacity: 0.7 }}>/ {stats?.belum_resume ?? 0}</span></div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Sudah / Belum Diresume</div>
            </div>
            <div className="stat-card" style={{
              background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              borderRadius: 12, padding: "18px 20px", color: "#fff"
            }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.laporan_operasi ?? 0} <span style={{ fontSize: 16, opacity: 0.7 }}>/ {stats?.belum_laporan_operasi ?? 0}</span></div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Laporan Operasi / Operasi</div>
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
                onChange={(e) => setSearchText(e.target.value)} />
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
              <select value={kdPj}
                onChange={(e) => { setKdPj(e.target.value); setPage(1); }}>
                <option value="">Semua Penjamin</option>
                {penjabOptions.map((o) => <option key={o.kd_pj} value={o.kd_pj}>{o.png_jawab}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Klinik</label>
              {jadwalLocked ? (
                <div className="jadwal-locked-input" title={`Sedang jam praktik: ${jadwalInfo}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <span>{poliOptions.find(o => o.kd_poli === poli)?.nm_poli || poli}</span>
                  <span className="jadwal-locked-badge">Praktik</span>
                </div>
              ) : (
                <select value={poli}
                  onChange={(e) => { setPoli(e.target.value); setPage(1); }}>
                  <option value="">Semua Klinik</option>
                  {poliOptions.map((o) => <option key={o.kd_poli} value={o.kd_poli}>{o.nm_poli}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (() => {
        const v = contextMenu.visit;
        const resumeAda = !!v.has_resume;
        const showLaporan = !!((v.has_booking_operasi || v.has_operasi) && !v.has_laporan_operasi);
        const laporanDilarang = showLaporan && v.status_bayar === "Sudah Bayar" && !v.has_operasi;
        const laporanTersedia = showLaporan && !laporanDilarang;
        return (
          <div ref={menuRef} className="context-menu" style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}>
            <button onClick={() => { const w = v; openForm(w, resumeAda); }}>{resumeAda ? "Edit Resume" : "Resume Pasien"}</button>
            {laporanTersedia && <button onClick={() => { setContextMenu(null); navigate(`/laporan-operasi/${v.no_rawat}`); }}>Laporan Operasi</button>}
          </div>
        );
      })()}

      <div className="table-toolbar">
        <div className="table-info">{!loading && <span>Menampilkan {list.length} dari {total} data</span>}</div>
        <div className="table-limit">
          <label>Tampilkan</label>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
            {LIMIT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt === 0 ? "Semua" : opt}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="patient-skeleton">
          {[1,2,3,4,5].map((i) => <div key={i} className="skeleton-card"><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
        </div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-muted)", marginBottom: ".5rem" }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>Tidak ada data pasien ditemukan</p>
        </div>
      ) : (
        <div className="patient-grid">
          {list.map((item: any, idx: number) => {
            const isMale = item.jk === "L";
            const genderColors = isMale
              ? { bg: "linear-gradient(135deg,#2563eb,#1e40af)", border: "#2563eb", light: "#dbeafe" }
              : { bg: "linear-gradient(135deg,#ec4899,#be185d)", border: "#ec4899", light: "#fce7f3" };
            return (
              <div key={item.no_rawat} className="patient-card" onContextMenu={(e) => handleContextMenu(e, item)} style={{ animationDelay: `${(idx % limit) * 30}ms`, borderLeftColor: genderColors.border }}>
                <div style={{ position: "absolute", top: ".65rem", right: ".75rem", display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <div className="patient-card-badge" style={{ background: item.has_resume ? "#dcfce7" : "#fef3c7", color: item.has_resume ? "#16a34a" : "#f59e0b" }}>
                    {item.has_resume ? "Sudah Resume" : "Belum Resume"}
                  </div>
                  {item.has_laporan_operasi ? (
                    <div className="patient-card-badge" style={{ background: "#dbeafe", color: "#2563eb" }}>Laporan Operasi Sudah Ada</div>
                  ) : item.has_operasi ? (
                    <div className="patient-card-badge" style={{ background: "#f3e8ff", color: "#9333ea" }}>Sudah Operasi</div>
                  ) : null}
                  {!item.has_laporan_operasi && (item.has_booking_operasi || item.has_operasi) ? (
                    <div className="patient-card-badge" style={{ background: "#fef3c7", color: "#d97706" }}>Belum Ada Laporan Operasi</div>
                  ) : null}
                </div>
                <div className="patient-card-main">
                  <div className="patient-avatar" style={{ background: genderColors.bg }}>
                    {isMale ? (
                      <svg viewBox="0 0 32 32" fill="currentColor" width="30" height="30">
                        <circle cx="16" cy="7" r="5"/>
                        <path d="M6 17c0-4 4.5-7 10-7s10 3 10 7v4c0 4-4.5 7-10 7s-10-3-10-7z"/>
                        <path d="M10 24l6 5 6-5"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 32 32" fill="currentColor" width="30" height="30">
                        <circle cx="16" cy="7" r="5"/>
                        <path d="M16 13l-12 19h24z"/>
                      </svg>
                    )}
                  </div>
                  <div className="patient-details">
                    <div className="patient-name">{item.nm_pasien || "-"}</div>
                    <div className="patient-meta">
                      <span>No. RM: {item.no_rkm_medis}</span>
                      <span className="meta-dot">&bull;</span>
                      <span>{item.no_rawat}</span>
                    </div>
                    <div className="patient-meta text-muted">
                      <span>{item.tgl_registrasi ? new Date(item.tgl_registrasi).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "-"}</span>
                      {item.status_bayar && (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          marginLeft: 8,
                          padding: "1px 8px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          background: item.status_bayar === "Sudah Bayar" ? "#dcfce7" : "#fef3c7",
                          color: item.status_bayar === "Sudah Bayar" ? "#16a34a" : "#d97706"
                        }}>
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: item.status_bayar === "Sudah Bayar" ? "#16a34a" : "#d97706",
                            display: "inline-block"
                          }} />
                          {item.status_bayar}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="patient-card-footer">
                  <div className="footer-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>{item.nm_dokter || "-"}</span>
                  </div>
                  <div className="footer-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <span>{item.nm_poli || item.kd_poli || "-"}</span>
                  </div>
                  {item.has_booking_operasi && item.booking_info && (() => {
                    const parts = item.booking_info.split("|");
                    return (
                      <div className="footer-info" style={{ color: "#92400e" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>Jadwal Operasi: {parts[0]} {parts[1]?.slice(0,5)} ({parts[2] || "-"})</span>
                      </div>
                    );
                  })()}
                  {item.alamat && (
                    <div className="footer-info">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span>{item.alamat}</span>
                    </div>
                  )}
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
              return (
                <button key={num} className={`page-num ${num === page ? "active" : ""}`} onClick={() => setPage(num)}>
                  {num}
                </button>
              );
            })}
          </div>
          <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Selanjutnya
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}

      {notif && (
        <CenteredNotification type={notif.type} message={notif.message} detail={notif.detail}
          onClose={() => setNotif(null)} autoClose={notif.type === "success" ? 1500 : 0} />
      )}
    </div>
  );
}
