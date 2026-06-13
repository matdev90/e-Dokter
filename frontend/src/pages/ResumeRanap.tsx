import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { searchRanapVisit, getResumeRanap, createResumeRanap, updateResumeRanap, searchICD10, searchICD9, getResumeRanapAutoFill, getBangsal, getResumeRanapStats, getRanapPenjab } from "../services/api";
import CenteredNotification from "../components/CenteredNotification";
import IcdAutocompleteInput from "../components/IcdAutocompleteInput";

const LIMIT_OPTIONS = [10, 20, 30, 40, 50];

export default function ResumeRanap() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
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
  const [ruangan, setRuangan] = useState("");
  const [ruanganOptions, setRuanganOptions] = useState<{ kd_bangsal: string; nm_bangsal: string }[]>([]);
  const [penjabOptions, setPenjabOptions] = useState<{ kd_pj: string; png_jawab: string }[]>([]);

  const [view, setView] = useState<"list" | "form">("list");
  const [currentVisit, setCurrentVisit] = useState<any>(null);
  const [existingResume, setExistingResume] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visit: any } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    no_rawat: "", tanggal: "", no_rkm_medis: "", nm_pasien: "", nm_dokter: "",
    kd_dokter: "",
    diagnosa_awal: "", alasan: "",
    keluhan_utama: "",
    pemeriksaan_fisik: "",
    jalannya_penyakit: "",
    pemeriksaan_penunjang: "",
    hasil_laborat: "",
    tindakan_dan_operasi: "",
    obat_di_rs: "",
    diagnosa_utama: "", kd_diagnosa_utama: "",
    diagnosa_sekunder: "", kd_diagnosa_sekunder: "",
    diagnosa_sekunder2: "", kd_diagnosa_sekunder2: "",
    diagnosa_sekunder3: "", kd_diagnosa_sekunder3: "",
    diagnosa_sekunder4: "", kd_diagnosa_sekunder4: "",
    prosedur_utama: "", kd_prosedur_utama: "",
    prosedur_sekunder: "", kd_prosedur_sekunder: "",
    prosedur_sekunder2: "", kd_prosedur_sekunder2: "",
    prosedur_sekunder3: "", kd_prosedur_sekunder3: "",
    alergi: "",
    diet: "",
    lab_belum: "",
    edukasi: "",
    keadaan: "Membaik",
    ket_keadaan: "",
    cara_keluar: "Atas Izin Dokter",
    ket_keluar: "",
    dilanjutkan: "Kembali Ke RS",
    ket_dilanjutkan: "",
    kontrol: "",
    obat_pulang: "",
  });

  const [loadingForm, setLoadingForm] = useState(false);

  const clearForm = () => {
    setForm({
      no_rawat: "", tanggal: "", no_rkm_medis: "", nm_pasien: "", nm_dokter: "", kd_dokter: "",
      diagnosa_awal: "", alasan: "",
      keluhan_utama: "", pemeriksaan_fisik: "", jalannya_penyakit: "",
      pemeriksaan_penunjang: "", hasil_laborat: "",
      tindakan_dan_operasi: "", obat_di_rs: "",
      diagnosa_utama: "", kd_diagnosa_utama: "",
      diagnosa_sekunder: "", kd_diagnosa_sekunder: "",
      diagnosa_sekunder2: "", kd_diagnosa_sekunder2: "",
      diagnosa_sekunder3: "", kd_diagnosa_sekunder3: "",
      diagnosa_sekunder4: "", kd_diagnosa_sekunder4: "",
      prosedur_utama: "", kd_prosedur_utama: "",
      prosedur_sekunder: "", kd_prosedur_sekunder: "",
      prosedur_sekunder2: "", kd_prosedur_sekunder2: "",
      prosedur_sekunder3: "", kd_prosedur_sekunder3: "",
      alergi: "", diet: "", lab_belum: "", edukasi: "",
      keadaan: "Membaik", ket_keadaan: "",
      cara_keluar: "Atas Izin Dokter", ket_keluar: "",
      dilanjutkan: "Kembali Ke RS", ket_dilanjutkan: "",
      kontrol: "", obat_pulang: "",
    });
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await searchRanapVisit({ q: search, page, limit, tgl_from: tglFrom, tgl_to: tglTo, kd_pj: kdPj || undefined, ruangan: ruangan || undefined });
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
    getBangsal().then(setRuanganOptions).catch((e) => console.error("getBangsal:", e));
    getRanapPenjab().then(setPenjabOptions).catch((e) => console.error("getRanapPenjab:", e));
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
      const s = await getResumeRanapStats();
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
  }, [search, tglFrom, tglTo, kdPj, ruangan, page, limit, refreshKey, view]);

  const handleContextMenu = (e: React.MouseEvent, visit: any) => {
    e.preventDefault();
    const willShowResume = !visit.has_resume;
    const willShowLaporan = (visit.has_booking_operasi || visit.has_operasi) && !visit.has_laporan_operasi;
    if (willShowLaporan && visit.status_bayar === "Sudah Bayar") {
      setNotif({ type: "error", message: "Tidak dapat membuat laporan operasi", detail: "Pasien sudah bayar, laporan operasi baru dapat menambah tagihan pasien." });
      return;
    }
    if (!willShowResume && !willShowLaporan) {
      setNotif({ type: "info", message: "", detail: "Pasien sudah diresume dan/atau laporan operasi sudah ada. Untuk edit buka menu Laporan Resume atau Laporan Operasi." });
      return;
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
      diagnosa_awal: "", alasan: "",
      keluhan_utama: "", pemeriksaan_fisik: "", jalannya_penyakit: "",
      pemeriksaan_penunjang: "", hasil_laborat: "",
      tindakan_dan_operasi: "", obat_di_rs: "",
      diagnosa_utama: "", kd_diagnosa_utama: "",
      diagnosa_sekunder: "", kd_diagnosa_sekunder: "",
      diagnosa_sekunder2: "", kd_diagnosa_sekunder2: "",
      diagnosa_sekunder3: "", kd_diagnosa_sekunder3: "",
      diagnosa_sekunder4: "", kd_diagnosa_sekunder4: "",
      prosedur_utama: "", kd_prosedur_utama: "",
      prosedur_sekunder: "", kd_prosedur_sekunder: "",
      prosedur_sekunder2: "", kd_prosedur_sekunder2: "",
      prosedur_sekunder3: "", kd_prosedur_sekunder3: "",
      alergi: "", diet: "", lab_belum: "", edukasi: "",
      keadaan: "Membaik", ket_keadaan: "",
      cara_keluar: "Atas Izin Dokter", ket_keluar: "",
      dilanjutkan: "Kembali Ke RS", ket_dilanjutkan: "",
      kontrol: "", obat_pulang: "",
    };

    if (edit) {
      try {
        const [resume, fill] = await Promise.all([
          getResumeRanap(visit.no_rawat),
          getResumeRanapAutoFill(visit.no_rawat).catch(() => ({})),
        ]);
        setExistingResume(resume);
        // Merge: auto-fill provides defaults, resume overrides only non-empty values
        const merged = { ...base, ...fill };
        for (const key of Object.keys(resume)) {
          const val = resume[key];
          if (val !== null && val !== undefined && val !== '') {
            merged[key] = val;
          }
        }
        merged.kontrol = resume.kontrol ? resume.kontrol.slice(0, 10) : "";
        merged.keadaan = merged.keadaan || "Membaik";
        merged.cara_keluar = merged.cara_keluar || "Atas Izin Dokter";
        merged.dilanjutkan = merged.dilanjutkan || "Kembali Ke RS";
        setForm(merged);
      } catch {
        setError("Gagal memuat data resume");
      }
    } else {
      setExistingResume(null);
      setLoadingForm(true);
      try {
        const fill = await getResumeRanapAutoFill(visit.no_rawat);
        setForm({ ...base, ...fill, keadaan: fill.keadaan || "Membaik", cara_keluar: fill.cara_keluar || "Atas Izin Dokter", dilanjutkan: fill.dilanjutkan || "Kembali Ke RS" });
      } catch {
        setForm(base);
      }
      setLoadingForm(false);
    }
    setView("form");
  };

  const handleBatal = () => {
    setView("list"); setCurrentVisit(null); setExistingResume(null);
    setIsEditing(false); clearForm(); setError(""); setSuccess("");
    setRefreshKey(k => k + 1);
  };

  const handleSave = async () => {
    setNotif(null);
    try {
      const payload = { ...form };
      if (payload.kontrol) payload.kontrol = payload.kontrol + "T00:00:00";
      if (isEditing) { await updateResumeRanap(form.no_rawat, payload); }
      else { await createResumeRanap(payload); }
      setNotif({ type: "success", message: isEditing ? "Data berhasil diperbarui" : "Resume Rawat Inap berhasil disimpan" });
      setTimeout(() => { setNotif(null); handleBatal(); }, 1500);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || "Gagal menyimpan resume";
      setNotif({ type: "error", message: "Resume Rawat Inap - Gagal menyimpan", detail: `Penyebab: ${errMsg}` });
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
            <h1>{isEditing ? "Edit Resume Rawat Inap" : "Buat Resume Rawat Inap"}</h1>
            <button className="btn btn-danger-outline" onClick={handleBatal}>Kembali</button>
          </div>
          <div className="form-loading">
            {[1,2,3,4,5,6,7,8].map((i) => (
              <div key={i} className="shimmer-card">
                <div className="shimmer-line w-30" />
                <div className="shimmer-grid">
                  <div className="shimmer-line h-32" />
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
          <h1>{isEditing ? "Edit Resume Rawat Inap" : "Buat Resume Rawat Inap"}</h1>
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
                  <input value={form.no_rkm_medis} readOnly />
                </div>
                <div className="form-group">
                  <label>Nama Pasien</label>
                  <input value={form.nm_pasien} readOnly />
                </div>
              </div>
              <div className="form-grid-3" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label>Dokter P.J.</label>
                  <input value={(form as any).nm_dokter_dpjp || form.nm_dokter || ""} readOnly />
                </div>
                <div className="form-group">
                  <label>Ruang / Kamar</label>
                  <input value={(form as any).ruang || "—"} readOnly />
                </div>
                <div className="form-group">
                  <label>Tanggal Registrasi</label>
                  <input value={form.tanggal} readOnly />
                </div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">2</span> Dokter Pengirim &amp; Diagnosa Awal</div>
            <div className="section-body">
              <div className="form-grid-3" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label>Kode Dokter Pengirim</label>
                  <input value={(form as any).kd_dokter_pengirim || "—"} readOnly />
                </div>
                <div className="form-group">
                  <label>Nama Dokter Pengirim</label>
                  <input value={(form as any).nm_dokter_pengirim || "—"} readOnly />
                </div>
                <div className="form-group">
                  <label>&nbsp;</label>
                  <input value="" readOnly style={{ opacity: 0 }} />
                </div>
              </div>
              <div className="section-divider" />
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Diagnosa Awal Masuk</label>
                  <input {...f("diagnosa_awal")} />
                </div>
                <div className="form-group">
                  <label>Alasan Masuk Dirawat</label>
                  <input {...f("alasan")} />
                </div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">3</span> Anamnesis &amp; Pemeriksaan</div>
            <div className="section-body">
              <div className="form-group">
                <label>Keluhan Utama / Riwayat Penyakit</label>
                <textarea rows={3} {...f("keluhan_utama")} />
              </div>
              <div className="form-group">
                <label>Pemeriksaan Fisik</label>
                <textarea rows={3} {...f("pemeriksaan_fisik")} />
              </div>
              <div className="form-group">
                <label>Jalannya Penyakit Selama Perawatan</label>
                <textarea rows={3} {...f("jalannya_penyakit")} />
              </div>
              <div className="form-group">
                <label>Pemeriksaan Penunjang / Radiologi Terpenting</label>
                <textarea rows={3} {...f("pemeriksaan_penunjang")} />
              </div>
              <div className="form-group">
                <label>Pemeriksaan Penunjang / Laboratorium Terpenting</label>
                <textarea rows={3} {...f("hasil_laborat")} />
              </div>
              <div className="form-group">
                <label>Tindakan / Operasi Selama Perawatan</label>
                <textarea rows={3} {...f("tindakan_dan_operasi")} />
              </div>
              <div className="form-group">
                <label>Obat-obatan Selama Perawatan</label>
                <textarea rows={3} {...f("obat_di_rs")} />
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">4</span> Diagnosa</div>
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
            <div className="section-header"><span className="section-icon">6</span> Informasi Tambahan</div>
            <div className="section-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Alergi Obat</label>
                  <input {...f("alergi")} />
                </div>
                <div className="form-group">
                  <label>Diet</label>
                  <input {...f("diet")} />
                </div>
              </div>
              <div className="form-group">
                <label>Hasil Laboratorium Yang Belum Selesai (Pending)</label>
                <textarea rows={2} {...f("lab_belum")} />
              </div>
              <div className="form-group">
                <label>Instruksi / Anjuran Dan Edukasi (Follow Up)</label>
                <textarea rows={2} {...f("edukasi")} />
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">7</span> Kondisi Pulang</div>
            <div className="section-body">
              <div className="form-grid-4">
                <div className="form-group">
                  <label>Keadaan Pulang</label>
                  <select {...f("keadaan")}>
                    <option value="Membaik">Membaik</option>
                    <option value="Sembuh">Sembuh</option>
                    <option value="Keadaan Khusus">Keadaan Khusus</option>
                    <option value="Meninggal">Meninggal</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Ket. Keadaan</label>
                  <input {...f("ket_keadaan")} />
                </div>
                <div className="form-group">
                  <label>Cara Keluar</label>
                  <select {...f("cara_keluar")}>
                    <option value="Atas Izin Dokter">Atas Izin Dokter</option>
                    <option value="Pindah RS">Pindah RS</option>
                    <option value="Pulang Atas Permintaan Sendiri">Pulang Atas Permintaan Sendiri</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Ket. Cara Keluar</label>
                  <input {...f("ket_keluar")} />
                </div>
              </div>
              <div className="form-grid-3" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label>Dilanjutkan</label>
                  <select {...f("dilanjutkan")}>
                    <option value="Kembali Ke RS">Kembali Ke RS</option>
                    <option value="RS Lain">RS Lain</option>
                    <option value="Dokter Luar">Dokter Luar</option>
                    <option value="Puskesmes">Puskesmas</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Ket. Dilanjutkan</label>
                  <input {...f("ket_dilanjutkan")} />
                </div>
                <div className="form-group">
                  <label>Kontrol Kembali</label>
                  <input type="date" {...f("kontrol")} />
                </div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">8</span> Obat Pulang</div>
            <div className="section-body">
              <div className="form-group">
                <label>Obat-obatan Waktu Pulang</label>
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
          <h1>Rawat Inap</h1>
          <p className="text-muted">Data pasien rawat inap</p>
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
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total Pasien Bulan Ini</div>
            </div>
            <div className="stat-card" style={{
              background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
              borderRadius: 12, padding: "18px 20px", color: "#fff"
            }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{stats?.bpjs_umum ?? 0}</div>
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
              <label>Ruangan</label>
              <select value={ruangan}
                onChange={(e) => { setRuangan(e.target.value); setPage(1); }}>
                <option value="">Semua Ruangan</option>
                {ruanganOptions.map((o) => <option key={o.kd_bangsal} value={o.kd_bangsal}>{o.nm_bangsal}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (() => {
        const v = contextMenu.visit;
        const showResume = !!(!v.has_resume);
        const showLaporan = !!((v.has_booking_operasi || v.has_operasi) && !v.has_laporan_operasi);
        if (!showResume && !showLaporan) return null;
        return (
          <div ref={menuRef} className="context-menu" style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 1000 }}>
            {showResume && <button onClick={() => { const w = v; openForm(w, !!w.has_resume); }}>Resume Pasien</button>}
            {showLaporan && <button onClick={() => { setContextMenu(null); navigate(`/laporan-operasi/${v.no_rawat}`); }}>Laporan Operasi</button>}
          </div>
        );
      })()}

      <div className="table-toolbar">
        <div className="table-info">{!loading && <span>Menampilkan {list.length} dari {total} data</span>}</div>
        <div className="table-limit">
          <label>Tampilkan</label>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
            {LIMIT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
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
            const initial = (item.nm_pasien || "?")[0].toUpperCase();
            const colors = ["#2563eb","#16a34a","#f59e0b","#dc2626","#8b5cf6","#ec4899","#06b6d4","#f97316"];
            const color = colors[idx % colors.length];
            return (
              <div key={item.no_rawat} className="patient-card" onContextMenu={(e) => handleContextMenu(e, item)} style={{ animationDelay: `${(idx % limit) * 30}ms` }}>
                <div style={{ position: "absolute", top: ".65rem", right: ".75rem", display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <div className="patient-card-badge" style={{ background: item.has_resume ? "#dcfce7" : "#fef3c7", color: item.has_resume ? "#16a34a" : "#f59e0b" }}>
                    {item.has_resume ? "Sudah Resume" : "Belum Resume"}
                  </div>
                  {item.has_laporan_operasi ? (
                    <div className="patient-card-badge" style={{ background: "#dbeafe", color: "#2563eb" }}>Laporan Operasi Sudah Ada</div>
                  ) : item.has_booking_operasi ? (
                    <div className="patient-card-badge" style={{ background: "#fef3c7", color: "#d97706" }}>Belum Ada Laporan Operasi</div>
                  ) : item.has_operasi ? (
                    <div className="patient-card-badge" style={{ background: "#f3e8ff", color: "#9333ea" }}>Sudah Operasi</div>
                  ) : null}
                </div>
                <div className="patient-card-main">
                  <div className="patient-avatar" style={{ background: color }}>{initial}</div>
                  <div className="patient-details">
                    <div className="patient-name">{item.nm_pasien || "-"}</div>
                    <div className="patient-meta">
                      <span>No. RM: {item.no_rkm_medis}</span>
                      <span className="meta-dot">&bull;</span>
                      <span>{item.no_rawat}</span>
                    </div>
                    <div className="patient-meta text-muted">
                      <span>{item.tgl_registrasi ? new Date(item.tgl_registrasi).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "-"}</span>
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
                    <span>{item.nm_bangsal || "-"}</span>
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
