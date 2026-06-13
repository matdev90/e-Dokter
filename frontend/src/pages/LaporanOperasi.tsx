import { useState, useEffect, FormEvent, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getOperasiList, getOperasiDetail, createOperasi, updateOperasi, deleteOperasi, signOperasi, getOperasiAutoFill, getPatients, searchICD10, getOperasiBangsal, getOperasiStats, getOperasiPenjab, searchPaketOperasi, getBookingOperasi } from "../services/api";
import CenteredNotification from "../components/CenteredNotification";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import DoctorSearchInput from "../components/DoctorSearchInput";
import EmployeeSearchInput from "../components/EmployeeSearchInput";

interface ICD10Code { code: string; description: string; }

const LIMIT_OPTIONS = [10, 20, 30, 40, 50];

const STAT_GRADIENTS = [
  { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" },
  { bg: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" },
];

export default function LaporanOperasi() {
  const params = useParams();
  const no_rawat = params['*'] ? params['*'].replace(/^\//, '') : undefined;
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "form">(no_rawat ? "form" : "list");
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [tglFrom, setTglFrom] = useState("");
  const [tglTo, setTglTo] = useState("");
  const [ruanganFilter, setRuanganFilter] = useState("");
  const [ruanganOptions, setRuanganOptions] = useState<{ kd_bangsal: string; nm_bangsal: string }[]>([]);
  const [pjFilter, setPjFilter] = useState("");
  const [pjOptions, setPjOptions] = useState<{ kd_pj: string; png_jawab: string }[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [operasiStats, setOperasiStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [jenisRawat, setJenisRawat] = useState("");
  const [editingModal, setEditingModal] = useState<any>(null);
  const [editModalForm, setEditModalForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [notif, setNotif] = useState<{ type: "success" | "error"; message: string; detail?: string } | null>(null);

  const [form, setForm] = useState({
    no_rkm_medis: "", nm_pasien: "", tanggal: "", no_rawat: "",
    jenis_anasthesi: "Umum", kategori: "Kecil", status: "",
    operator1: "", operator2: "", operator3: "",
    asisten_operator1: "", asisten_operator2: "", asisten_operator3: "",
    instrumen: "", dokter_anak: "", perawaat_resusitas: "",
    dokter_anestesi: "", asisten_anestesi: "", asisten_anestesi2: "",
    bidan: "", bidan2: "", bidan3: "", perawat_luar: "",
    omloop: "", omloop2: "", omloop3: "", omloop4: "", omloop5: "",
    dokter_pjanak: "", dokter_umum: "",
    diagnosa_preop: "", diagnosa_postop: "",
    jaringan_dieksekusi: "", selesaioperasi: "",
    permintaan_pa: "Tidak", nomor_implan: "", laporan_operasi: "",
    nama_operasi: "", biaya_operasi: 0, kode_paket: "",
  });

  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [patientTimer, setPatientTimer] = useState<any>(null);

  const [preOpQuery, setPreOpQuery] = useState("");
  const [preOpResults, setPreOpResults] = useState<ICD10Code[]>([]);
  const [preOpTimer, setPreOpTimer] = useState<any>(null);
  const [postOpQuery, setPostOpQuery] = useState("");
  const [postOpResults, setPostOpResults] = useState<ICD10Code[]>([]);
  const [postOpTimer, setPostOpTimer] = useState<any>(null);

  const [selectedPaket, setSelectedPaket] = useState<any[]>([]);
  const [savedNoRawat, setSavedNoRawat] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [loadingForm, setLoadingForm] = useState(false);
  const [operator1Nama, setOperator1Nama] = useState("");
  const [asistenOp1Nama, setAsistenOp1Nama] = useState("");
  const [asistenOp2Nama, setAsistenOp2Nama] = useState("");
  const [asistenOp3Nama, setAsistenOp3Nama] = useState("");
  const [bidanNama, setBidanNama] = useState("");
  const [bidan2Nama, setBidan2Nama] = useState("");
  const [bidan3Nama, setBidan3Nama] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const toDisplayDate = (stored: string) => stored ? stored.split("T")[0].split("-").reverse().join("/") : "";
  const toDisplayTime = (stored: string) => {
    const t = stored ? stored.split("T")[1] : undefined;
    return (t ? t.slice(0,5) : "") + ":00";
  };
  const fromDisplayDate = (display: string) => display ? display.split("/").reverse().join("-") : "";
  const fromDisplayTime = (display: string) => display ? display.slice(0,5) : "";

  const tanggalDateDisp = toDisplayDate(form.tanggal);
  const tanggalTimeDisp = toDisplayTime(form.tanggal);
  const updateTanggal = (part: "date" | "time", val: string) => {
    const d = part === "date" ? fromDisplayDate(val) : fromDisplayDate(tanggalDateDisp);
    const t = part === "time" ? fromDisplayTime(val) : fromDisplayTime(tanggalTimeDisp);
    updateField("tanggal", t ? `${d}T${t}` : d);
  };

  const selesaiDateDisp = toDisplayDate(form.selesaioperasi);
  const selesaiTimeDisp = toDisplayTime(form.selesaioperasi);
  const updateSelesai = (part: "date" | "time", val: string) => {
    const d = part === "date" ? fromDisplayDate(val) : fromDisplayDate(selesaiDateDisp);
    const t = part === "time" ? fromDisplayTime(val) : fromDisplayTime(selesaiTimeDisp);
    updateField("selesaioperasi", t ? `${d}T${t}` : d);
  };

  useEffect(() => {
    getOperasiBangsal().then(setRuanganOptions).catch(() => {});
    getOperasiPenjab().then(setPjOptions).catch(() => {});
    getOperasiStats().then(setOperasiStats).catch(() => {}).finally(() => setLoadingStats(false));
  }, []);

  const loadOperasiStats = (params?: { tgl_from?: string; tgl_to?: string; pj?: string }) => {
    setLoadingStats(true);
    getOperasiStats(params).then(setOperasiStats).catch(() => {}).finally(() => setLoadingStats(false));
  };

  const loadList = () => {
    setLoading(true);
    getOperasiList({
      search, page, limit,
      ruangan: ruanganFilter || undefined,
      jenis: jenisRawat || undefined,
      pj: pjFilter || undefined,
      tgl_from: tglFrom || undefined,
      tgl_to: tglTo || undefined,
    }).then((res) => {
      setList(res.data || []);
      setTotalPages(res.pagination?.totalPages || 0);
      setTotal(res.pagination?.total || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadList(); }, [page, limit, search, ruanganFilter, jenisRawat, pjFilter, tglFrom, tglTo]);

  useEffect(() => {
    if (no_rawat && no_rawat !== "new") {
      setView("form");
      setSavedNoRawat(no_rawat);
      setLoadingForm(true);
      Promise.all([
        getOperasiDetail(no_rawat).catch(() => null),
        getOperasiAutoFill(no_rawat).catch(() => ({})),
        getBookingOperasi(no_rawat).catch(() => null),
      ]).then(([detail, fill, booking]) => {
        // Check payment status
        const fillData = fill as any;
        if (fillData?.status_bayar === "Sudah Bayar") {
          setNotif({ type: "error", message: "Perhatian! Pasien sudah bayar.", detail: "Membuat atau mengubah laporan operasi dapat menambah tagihan pasien." });
        }

        // Determine nama_operasi from booking (priority) or auto-fill
        let namaOperasi = "";
        if (booking?.nama_operasi) {
          namaOperasi = booking.nama_operasi;
        } else if ((fill as any)?.nama_operasi) {
          namaOperasi = (fill as any).nama_operasi;
        }

        if (detail) {
          setHasExisting(true);
          const f: any = { ...form };
          Object.keys(f).forEach((k) => {
            if ((detail as any)[k] !== undefined && (detail as any)[k] !== null) (f as any)[k] = (detail as any)[k];
          });
          if (fill) {
            Object.keys(f).forEach((k) => {
              if ((fill as any)[k] !== undefined && (fill as any)[k] !== null && !(f as any)[k]) (f as any)[k] = (fill as any)[k];
            });
          }
          if (namaOperasi) f.nama_operasi = namaOperasi;
          f.laporan_operasi = "";
          setForm(f);
          if ((fill as any)?.operator1_nama) setOperator1Nama((fill as any).operator1_nama);
          if ((fill as any)?.asisten_operator1_nama) setAsistenOp1Nama((fill as any).asisten_operator1_nama);
          if ((fill as any)?.asisten_operator2_nama) setAsistenOp2Nama((fill as any).asisten_operator2_nama);
          if ((fill as any)?.asisten_operator3_nama) setAsistenOp3Nama((fill as any).asisten_operator3_nama);
          if ((fill as any)?.bidan_nama) setBidanNama((fill as any).bidan_nama);
          if ((fill as any)?.bidan2_nama) setBidan2Nama((fill as any).bidan2_nama);
          if ((fill as any)?.bidan3_nama) setBidan3Nama((fill as any).bidan3_nama);
          if (detail.nm_pasien) setPatientSearch(detail.nm_pasien);
          if (detail.diagnosa_preop) {
            searchICD10(detail.diagnosa_preop).then((r: ICD10Code[]) => {
              const m = r.find((x: ICD10Code) => x.code === detail.diagnosa_preop);
              setPreOpQuery(m ? `${m.code} - ${m.description}` : detail.diagnosa_preop);
            }).catch(() => setPreOpQuery(detail.diagnosa_preop));
          }
          if (detail.diagnosa_postop) {
            searchICD10(detail.diagnosa_postop).then((r: ICD10Code[]) => {
              const m = r.find((x: ICD10Code) => x.code === detail.diagnosa_postop);
              setPostOpQuery(m ? `${m.code} - ${m.description}` : detail.diagnosa_postop);
            }).catch(() => setPostOpQuery(detail.diagnosa_postop));
          }
        } else if (fill) {
          setHasExisting(false);
          const merged = { ...fill };
          if (namaOperasi) merged.nama_operasi = namaOperasi;
          setForm((prev: any) => ({ ...prev, ...merged }));
          if ((fill as any).operator1_nama) setOperator1Nama((fill as any).operator1_nama);
          if ((fill as any).asisten_operator1_nama) setAsistenOp1Nama((fill as any).asisten_operator1_nama);
          if ((fill as any).asisten_operator2_nama) setAsistenOp2Nama((fill as any).asisten_operator2_nama);
          if ((fill as any).asisten_operator3_nama) setAsistenOp3Nama((fill as any).asisten_operator3_nama);
          if ((fill as any).bidan_nama) setBidanNama((fill as any).bidan_nama);
          if ((fill as any).bidan2_nama) setBidan2Nama((fill as any).bidan2_nama);
          if ((fill as any).bidan3_nama) setBidan3Nama((fill as any).bidan3_nama);
          if ((fill as any).nm_pasien) setPatientSearch((fill as any).nm_pasien);
        }

        // Auto-fill paket operasi search from nama_operasi
        if (namaOperasi) {
          searchPaketOperasi(namaOperasi).then((data) => {
            if (data && data.length > 0) {
              const kode = (detail as any)?.kode_paket || (fill as any)?.kode_paket || "";
              const match = kode ? data.find((p: any) => p.kode_paket === kode) : data[0];
              if (match) setSelectedPaket([{ ...match, selected: true }]);
            }
          }).catch(() => {});
        }
      }).finally(() => setLoadingForm(false));
    } else if (no_rawat === "new") {
      setView("form");
      setSavedNoRawat(null);
      setHasExisting(false);
      setOperator1Nama("");
      setAsistenOp1Nama("");
      setAsistenOp2Nama("");
      setAsistenOp3Nama("");
      setBidanNama("");
      setBidan2Nama("");
      setBidan3Nama("");
    }
  }, [no_rawat, formVersion]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchText); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const handlePatientSearch = (q: string) => {
    setPatientSearch(q);
    if (patientTimer) clearTimeout(patientTimer);
    if (q.length < 2) { setPatientResults([]); return; }
    const timer = setTimeout(() => {
      getPatients(q, 1).then((res) => {
        setPatientResults(res.data || res.rows || res || []);
      }).catch(() => {});
    }, 300);
    setPatientTimer(timer);
  };

  const selectPatient = (p: any) => {
    setForm({ ...form, no_rkm_medis: p.no_rkm_medis, nm_pasien: p.nm_pasien || p.name });
    setPatientSearch(p.nm_pasien || p.name);
    setPatientResults([]);
  };

  const handleICD10Search = (q: string, type: "pre" | "post") => {
    if (type === "pre") {
      setPreOpQuery(q);
      if (preOpTimer) clearTimeout(preOpTimer);
      if (q.length < 2) { setPreOpResults([]); return; }
      const timer = setTimeout(() => { searchICD10(q).then(setPreOpResults).catch(() => {}); }, 300);
      setPreOpTimer(timer);
    } else {
      setPostOpQuery(q);
      if (postOpTimer) clearTimeout(postOpTimer);
      if (q.length < 2) { setPostOpResults([]); return; }
      const timer = setTimeout(() => { searchICD10(q).then(setPostOpResults).catch(() => {}); }, 300);
      setPostOpTimer(timer);
    }
  };

  const selectICD10 = (d: ICD10Code, type: "pre" | "post") => {
    if (type === "pre") {
      setForm({ ...form, diagnosa_preop: d.code });
      setPreOpQuery(`${d.code} - ${d.description}`);
      setPreOpResults([]);
    } else {
      setForm({ ...form, diagnosa_postop: d.code });
      setPostOpQuery(`${d.code} - ${d.description}`);
      setPostOpResults([]);
    }
  };

  const updateField = (field: string, value: any) => setForm((prev: any) => ({ ...prev, [field]: value }));

  const OPERATION_TEMPLATES = [
    { label: "Operasi Bersih", text: "Luka operasi dirawat secara steril. Tidak ditemukan tanda-tanda infeksi. Perawatan post operasi: rawat luka, antibiotik profilaksis, kontrol sesuai jadwal." },
    { label: "Operasi Laparotomi", text: "Dilakukan laparotomi eksplorasi. Temuan intraoperatif: [deskripsi temuan]. Tindakan: [nama tindakan]. Perdarahan: [jumlah] cc. Kontrol perdarahan baik. Instrumen dan kasa dihitung lengkap. Luka ditutup berlapis." },
    { label: "Operasi Orthopedi", text: "Dilakukan tindakan operasi orthopedi. Approach: [approach]. Temuan intraoperatif: [deskripsi]. Implan yang digunakan: [jenis implan]. Fiksasi stabil. Perdarahan: [jumlah] cc. Luka dirawat steril." },
    { label: "Operasi Caesar (SC)", text: "Dilakukan seksio sesarea. Laparotomi sesuai Pfannenstiel. Kavum abdomen dibuka. Ditemukan [deskripsi cairan/perlengketan]. Histerotomi segmen bawah rahim. Lahir bayi [jenis kelamin], BB [berat] gram, PB [panjang] cm, APGAR [nilai]. Plasenta lahir lengkap. Histerorafi. Peritonisasi. Luka ditutup berlapis." },
    { label: "Operasi Hernia", text: "Dilakukan herniorafi. Inkisi di area [lokasi]. Ditemukan hernia [jenis] langsung/tidak langsung. Kantung hernia dibebaskan dan dijahit. Dilakukan [herniorafi/McVay/Lichtenstein]. Fasia diperkuat. Perdarahan minimal. Luka ditutup." },
    { label: "Operasi Katarak", text: "Dilakukan operasi katarak dengan teknik [fakoemulsifikasi/EKPK]. Kapsulotomi sentral. Fakoemulsifikasi lensa. Implantasi IOL [tipe] di dalam kantung kapsul. Viskoelastik diirigasi. Sayatan [lokasi] ditutup dengan hidrasi stroma. OK." },
  ];
  const [showTemplates, setShowTemplates] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const insertTemplate = (text: string) => {
    updateField("laporan_operasi", text);
    setShowTemplates(false);
  };

  const validateForm = () => {
    const missing: string[] = [];
    if (!form.no_rawat) missing.push("No. Rawat");
    if (!form.nm_pasien) missing.push("Nama Pasien");
    if (!form.operator1) missing.push("Operator 1");
    if (!form.laporan_operasi) missing.push("Isi Laporan Operasi");
    if (missing.length) {
      setNotif({ type: "error", message: "Form belum lengkap", detail: `Harap isi: ${missing.join(", ")}` });
      return false;
    }
    return true;
  };

  const handleSave = async (sign: boolean) => {
    if (!validateForm()) return;
    setNotif(null); setLoading(true);
    try {
      const payload: any = {
        ...form,
        tanggal: form.tanggal,
        kode_paket: selectedPaket.length > 0 ? selectedPaket[0].kode_paket : (form as any).kode_paket || "-",
      };

      if (selectedPaket.length > 0) {
        const p = selectedPaket[0];
        payload.biayaoperator1 = p.operator1;
        payload.biayaoperator2 = p.operator2;
        payload.biayaoperator3 = p.operator3;
        payload.biayaasisten_operator1 = p.asisten_operator1;
        payload.biayaasisten_operator2 = p.asisten_operator2;
        payload.biayaasisten_operator3 = p.asisten_operator3;
        payload.biayainstrumen = p.instrumen;
        payload.biayadokter_anak = p.dokter_anak;
        payload.biayaperawaat_resusitas = p.perawaat_resusitas;
        payload.biayadokter_anestesi = p.dokter_anestesi;
        payload.biayaasisten_anestesi = p.asisten_anestesi;
        payload.biayaasisten_anestesi2 = p.asisten_anestesi2;
        payload.biayabidan = p.bidan;
        payload.biayabidan2 = p.bidan2;
        payload.biayabidan3 = p.bidan3;
        payload.biayaperawat_luar = p.perawat_luar;
        payload.biayaalat = p.alat;
        payload.biayasewaok = p.sewa_ok;
        payload.akomodasi = p.akomodasi;
        payload.bagian_rs = p.bagian_rs;
        payload.biaya_omloop = p.omloop;
        payload.biaya_omloop2 = p.omloop2;
        payload.biaya_omloop3 = p.omloop3;
        payload.biaya_omloop4 = p.omloop4;
        payload.biaya_omloop5 = p.omloop5;
        payload.biayasarpras = p.sarpras;
        payload.biaya_dokter_pjanak = p.dokter_pjanak;
        payload.biaya_dokter_umum = p.dokter_umum;
      }
      const targetNoRawat = savedNoRawat || no_rawat;
      const isUpdate = targetNoRawat && targetNoRawat !== "new" && hasExisting;
      if (isUpdate) {
        await updateOperasi(targetNoRawat, payload);
        if (sign) await signOperasi(targetNoRawat, form.tanggal);
      } else {
        const result = await createOperasi(payload);
        const newRawat = result.no_rawat || form.no_rawat;
        setSavedNoRawat(newRawat);
        setHasExisting(true);
        setForm((prev: any) => ({ ...prev, no_rawat: newRawat }));
        if (sign && newRawat) await signOperasi(newRawat, form.tanggal);
      }
      setNotif({ type: "success", message: isUpdate ? "Data berhasil diperbarui" : "Laporan Operasi berhasil disimpan" });
      loadList();
      loadOperasiStats({ tgl_from: tglFrom || undefined, tgl_to: tglTo || undefined, pj: pjFilter || undefined });
      setFormVersion(v => v + 1);
      setView("list");
      setTimeout(() => navigate(-1), 1500);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || "Gagal menyimpan";
      setNotif({ type: "error", message: "Laporan Operasi - Gagal menyimpan", detail: `Penyebab: ${errMsg}` });
    } finally { setLoading(false); }
  };

  const handlePreview = async (no_rawat: string) => {
    try {
      const detail = await getOperasiDetail(no_rawat);
      setPreview(detail);
    } catch {
      alert("Gagal memuat detail laporan operasi");
    }
  };

  const handleEditOperasi = async (no_rawat: string) => {
    try {
      const detail = await getOperasiDetail(no_rawat);
      setEditingModal(detail);
      const f: any = {};
      Object.keys(detail).forEach((k) => {
        const val = detail[k];
        if ((k === "tanggal" || k === "selesaioperasi") && val) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            const ss = String(d.getSeconds()).padStart(2, "0");
            const hasTime = val.includes("T") && (d.getHours() || d.getMinutes() || d.getSeconds());
            f[k] = hasTime ? `${y}-${m}-${day}T${hh}:${mm}:${ss}` : `${y}-${m}-${day}`;
            return;
          }
        }
        f[k] = val ?? "";
      });
      setEditModalForm(f);
    } catch {
      alert("Gagal memuat data laporan operasi");
    }
  };

  const handleEditOperasiSave = async () => {
    setSavingEdit(true);
    setNotif(null);
    try {
      const fields = ["no_rawat","tanggal","diagnosa_preop","diagnosa_postop","jaringan_dieksekusi","selesaioperasi","permintaan_pa","nomor_implan","laporan_operasi"];
      const payload: any = {};
      fields.forEach((f) => { payload[f] = editModalForm[f] ?? ""; });
      await updateOperasi(editingModal.no_rawat, payload);
      setEditingModal(null);
      loadList();
      loadOperasiStats({ tgl_from: tglFrom || undefined, tgl_to: tglTo || undefined, pj: pjFilter || undefined });
      setNotif({ type: "success", message: "Laporan Operasi berhasil diperbarui" });
      setTimeout(() => setNotif(null), 1500);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || "Gagal memperbarui";
      setNotif({ type: "error", message: "Laporan Operasi - Gagal memperbarui", detail: `Penyebab: ${errMsg}` });
    }
    setSavingEdit(false);
  };

  const handleDelete = async (no_rawat: string) => {
    try {
      await deleteOperasi(no_rawat);
      setConfirmDelete(null);
      loadList();
      loadOperasiStats({ tgl_from: tglFrom || undefined, tgl_to: tglTo || undefined, pj: pjFilter || undefined });
      setNotif({ type: "success", message: "Laporan operasi berhasil dihapus" });
      setTimeout(() => setNotif(null), 1500);
    } catch {
      setNotif({ type: "error", message: "Gagal menghapus laporan operasi" });
    }
  };

  const dropdownStyle: any = {
    position: "absolute", top: "100%", left: 0, right: 0,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: "var(--radius)", zIndex: 10, maxHeight: 200, overflowY: "auto",
  };

  if (view === "form") {
    if (loadingForm) {
      return (
        <div className="page-fade-in">
          <div className="page-header">
            <h1>Laporan Operasi</h1>
            <button className="btn btn-danger-outline" onClick={() => { setView("list"); navigate("/laporan-operasi"); }}>Kembali</button>
          </div>
          <div className="form-loading">
            {[1,2,3,4].map(i => (
              <div key={i} className="shimmer-card">
                <div className="shimmer-line w-30" />
                <div className="shimmer-grid"><div className="shimmer-line h-32" /><div className="shimmer-line h-32" /></div>
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
          <h1>{savedNoRawat && savedNoRawat !== "new" ? "Edit Laporan Operasi" : "Buat Laporan Operasi"}</h1>
          <button className="btn btn-danger-outline" onClick={() => { setView("list"); navigate("/laporan-operasi"); }}>Kembali</button>
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
              <div style={{ fontSize: 28, fontWeight: 700 }}>{operasiStats?.total ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total Laporan Operasi</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                <span>Ralan: {operasiStats?.ralan?.total ?? 0}</span>
                <span>Ranap: {operasiStats?.ranap?.total ?? 0}</span>
              </div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[1].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{operasiStats?.ralan?.total ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Rawat Jalan</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                <span>BPJS: {operasiStats?.ralan?.bpjs ?? 0}</span>
                <span>Umum: {operasiStats?.ralan?.umum ?? 0}</span>
              </div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[2].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{operasiStats?.ranap?.total ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Rawat Inap</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                <span>BPJS: {operasiStats?.ranap?.bpjs ?? 0}</span>
                <span>Umum: {operasiStats?.ranap?.umum ?? 0}</span>
              </div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[3].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{(operasiStats?.ralan?.bpjs ?? 0) + (operasiStats?.ranap?.bpjs ?? 0)}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total BPJS</div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[4].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{(operasiStats?.ralan?.umum ?? 0) + (operasiStats?.ranap?.umum ?? 0)}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total Umum</div>
            </div>
          </>
        )}
      </div>

      {notif && (
        <CenteredNotification type={notif.type} message={notif.message} detail={notif.detail}
          onClose={() => setNotif(null)} autoClose={notif.type === "success" ? 2500 : 0} />
      )}

        <div className="form-scroll">
          <div className="section-card">
            <div className="section-header"><span className="section-icon">1</span> Identitas Pasien</div>
            <div className="section-body">
              <div className="form-group" style={{ position: "relative" }}>
                <label>Cari Pasien</label>
                <input placeholder="Nama pasien..." value={patientSearch}
                  onChange={(e) => handlePatientSearch(e.target.value)}
                  disabled={!!savedNoRawat && savedNoRawat !== "new"} />
                {patientResults.length > 0 && (
                  <div style={dropdownStyle}>
                    {patientResults.map((p: any, i: number) => (
                      <div key={i} style={{ padding: ".5rem .75rem", cursor: "pointer", fontSize: ".85rem", borderBottom: "1px solid var(--border)" }}
                        onClick={() => selectPatient(p)}>
                        {p.nm_pasien || p.name} ({p.no_rkm_medis})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.nm_pasien && (
                <div style={{ padding: ".5rem .75rem", background: "var(--bg)", borderRadius: "var(--radius)", fontSize: ".9rem", marginTop: ".5rem" }}>
                  <strong>Pasien:</strong> {form.nm_pasien} ({form.no_rkm_medis})
                </div>
              )}
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Tanggal Operasi</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="text" placeholder="DD/MM/YYYY" value={tanggalDateDisp}
                      onChange={(e) => updateTanggal("date", e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                    <input type="text" placeholder="HH:MM:SS" value={tanggalTimeDisp}
                      onChange={(e) => updateTanggal("time", e.target.value)} style={{ width: 120 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label>No Rawat</label>
                  <input value={form.no_rawat} onChange={(e) => updateField("no_rawat", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Nama Operasi</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input value={form.nama_operasi} onChange={(e) => updateField("nama_operasi", e.target.value)}
                      placeholder="Otomatis dari jadwal operasi" style={{ flex: 1 }} />
                    {form.biaya_operasi > 0 && <span style={{ fontSize: ".85rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Rp {Number(form.biaya_operasi).toLocaleString("id-ID")}</span>}
                  </div>
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Jenis Anasthesi</label>
                  <select value={form.jenis_anasthesi} onChange={(e) => updateField("jenis_anasthesi", e.target.value)}>
                    <option value="">--</option><option value="Umum">Umum</option><option value="Regional">Regional</option>
                    <option value="Lokal">Lokal</option><option value="MAC">MAC</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Kategori</label>
                  <select value={form.kategori} onChange={(e) => updateField("kategori", e.target.value)}>
                    <option value="">-</option><option value="Khusus">Khusus</option><option value="Besar">Besar</option>
                    <option value="Sedang">Sedang</option><option value="Kecil">Kecil</option>
                    <option value="Elektive">Elektive</option><option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status Rawat</label>
                  <select value={form.status} onChange={(e) => updateField("status", e.target.value)}>
                    <option value="">--</option><option value="Ranap">Ranap</option><option value="Ralan">Ralan</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">2</span> Tim Operasi</div>
            <div className="section-body">
              <div className="form-grid-3">
                <div className="form-group"><label>Operator 1</label>
                  <DoctorSearchInput value={form.operator1} onChange={(v) => updateField("operator1", v)} displayName={operator1Nama || undefined} placeholder="Cari dokter..." />
                </div>
                <div className="form-group"><label>Operator 2</label><DoctorSearchInput value={form.operator2} onChange={(v) => updateField("operator2", v)} placeholder="Kode dokter" /></div>
                <div className="form-group"><label>Operator 3</label><DoctorSearchInput value={form.operator3} onChange={(v) => updateField("operator3", v)} placeholder="Kode dokter" /></div>
              </div>
              <div className="form-grid-3">
                <div className="form-group"><label>Asisten Op 1</label><EmployeeSearchInput value={form.asisten_operator1} onChange={(v) => updateField("asisten_operator1", v)} displayName={asistenOp1Nama || undefined} onSelectName={setAsistenOp1Nama} /></div>
                <div className="form-group"><label>Asisten Op 2</label><EmployeeSearchInput value={form.asisten_operator2} onChange={(v) => updateField("asisten_operator2", v)} displayName={asistenOp2Nama || undefined} onSelectName={setAsistenOp2Nama} /></div>
                <div className="form-group"><label>Asisten Op 3</label><EmployeeSearchInput value={form.asisten_operator3} onChange={(v) => updateField("asisten_operator3", v)} displayName={asistenOp3Nama || undefined} onSelectName={setAsistenOp3Nama} /></div>
              </div>
              <div className="form-grid-3">
                <div className="form-group"><label>Instrumen</label><DoctorSearchInput value={form.instrumen} onChange={(v) => updateField("instrumen", v)} /></div>
                <div className="form-group"><label>Dokter Anak</label><DoctorSearchInput value={form.dokter_anak} onChange={(v) => updateField("dokter_anak", v)} /></div>
                <div className="form-group"><label>Perawat Resusitasi</label><DoctorSearchInput value={form.perawaat_resusitas} onChange={(v) => updateField("perawaat_resusitas", v)} /></div>
              </div>
              <div className="form-grid-3">
                <div className="form-group"><label>Dokter Anestesi</label><DoctorSearchInput value={form.dokter_anestesi} onChange={(v) => updateField("dokter_anestesi", v)} /></div>
                <div className="form-group"><label>Asisten Anestesi 1</label><DoctorSearchInput value={form.asisten_anestesi} onChange={(v) => updateField("asisten_anestesi", v)} /></div>
                <div className="form-group"><label>Asisten Anestesi 2</label><DoctorSearchInput value={form.asisten_anestesi2} onChange={(v) => updateField("asisten_anestesi2", v)} /></div>
              </div>
              <div className="form-grid-3">
                <div className="form-group"><label>Bidan 1</label><EmployeeSearchInput value={form.bidan} onChange={(v) => updateField("bidan", v)} displayName={bidanNama || undefined} onSelectName={setBidanNama} /></div>
                <div className="form-group"><label>Bidan 2</label><EmployeeSearchInput value={form.bidan2} onChange={(v) => updateField("bidan2", v)} displayName={bidan2Nama || undefined} onSelectName={setBidan2Nama} /></div>
                <div className="form-group"><label>Bidan 3</label><EmployeeSearchInput value={form.bidan3} onChange={(v) => updateField("bidan3", v)} displayName={bidan3Nama || undefined} onSelectName={setBidan3Nama} /></div>
              </div>
              <div className="form-grid-3">
                <div className="form-group"><label>Perawat Luar</label><DoctorSearchInput value={form.perawat_luar} onChange={(v) => updateField("perawat_luar", v)} /></div>
                <div className="form-group"><label>Omloop 1</label><DoctorSearchInput value={form.omloop} onChange={(v) => updateField("omloop", v)} /></div>
                <div className="form-group"><label>Omloop 2</label><DoctorSearchInput value={form.omloop2} onChange={(v) => updateField("omloop2", v)} /></div>
              </div>
              <div className="form-grid-3">
                <div className="form-group"><label>Omloop 3</label><DoctorSearchInput value={form.omloop3} onChange={(v) => updateField("omloop3", v)} /></div>
                <div className="form-group"><label>Omloop 4</label><DoctorSearchInput value={form.omloop4} onChange={(v) => updateField("omloop4", v)} /></div>
                <div className="form-group"><label>Omloop 5</label><DoctorSearchInput value={form.omloop5} onChange={(v) => updateField("omloop5", v)} /></div>
              </div>
              <div className="form-grid-3">
                <div className="form-group"><label>Dokter Pjanak</label><DoctorSearchInput value={form.dokter_pjanak} onChange={(v) => updateField("dokter_pjanak", v)} /></div>
                <div className="form-group"><label>Dokter Umum</label><DoctorSearchInput value={form.dokter_umum} onChange={(v) => updateField("dokter_umum", v)} /></div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">3</span> Paket Operasi</div>
            <div className="section-body">
              <div className="form-group">
                <label>Operasi</label>
                <div style={{ padding: "8px 12px", background: "var(--bg)", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontSize: ".9rem", fontWeight: 500 }}>
                  {selectedPaket.length > 0
                    ? `${selectedPaket[0].nm_perawatan} (${selectedPaket[0].kode_paket})`
                    : form.nama_operasi
                      ? form.nama_operasi
                      : (form.kode_paket && form.kode_paket !== "-" ? `Kode: ${form.kode_paket}` : "-")}
                </div>
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">4</span> Diagnosis</div>
            <div className="section-body">
              <div className="form-group" style={{ position: "relative" }}>
                <label>Diagnosa Pre-op (ICD-10)</label>
                <div className="icd-input-wrap">
                  <input placeholder="Cari diagnosis..." value={preOpQuery}
                    onChange={(e) => handleICD10Search(e.target.value, "pre")} />
                  {form.diagnosa_preop && (
                    <button type="button" className="icd-search-btn" onClick={() => { setForm({...form, diagnosa_preop: ""}); setPreOpQuery(""); }}
                      title="Hapus">✕</button>
                  )}
                </div>
                {preOpResults.length > 0 && (
                  <div className="icd-dropdown">
                    {preOpResults.map((d) => (
                      <div key={d.code} className="icd-dropdown-item" onClick={() => selectICD10(d, "pre")}>
                        <span className="icd-dropdown-code">{d.code}</span> {d.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ position: "relative" }}>
                <label>Diagnosa Post-op (ICD-10)</label>
                <div className="icd-input-wrap">
                  <input placeholder="Cari diagnosis..." value={postOpQuery}
                    onChange={(e) => handleICD10Search(e.target.value, "post")} />
                  {form.diagnosa_postop && (
                    <button type="button" className="icd-search-btn" onClick={() => { setForm({...form, diagnosa_postop: ""}); setPostOpQuery(""); }}
                      title="Hapus">✕</button>
                  )}
                </div>
                {postOpResults.length > 0 && (
                  <div className="icd-dropdown">
                    {postOpResults.map((d) => (
                      <div key={d.code} className="icd-dropdown-item" onClick={() => selectICD10(d, "post")}>
                        <span className="icd-dropdown-code">{d.code}</span> {d.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header"><span className="section-icon">4</span> Laporan Operasi</div>
            <div className="section-body">
              <div className="form-group">
                <label>Jaringan Dieksekusi</label>
                <input value={form.jaringan_dieksekusi} onChange={(e) => updateField("jaringan_dieksekusi", e.target.value)} />
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Selesai Operasi</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="text" placeholder="DD/MM/YYYY" value={selesaiDateDisp}
                      onChange={(e) => updateSelesai("date", e.target.value)} style={{ flex: 1, minWidth: 0 }} />
                    <input type="text" placeholder="HH:MM:SS" value={selesaiTimeDisp}
                      onChange={(e) => updateSelesai("time", e.target.value)} style={{ width: 120 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Permintaan PA</label>
                  <select value={form.permintaan_pa} onChange={(e) => updateField("permintaan_pa", e.target.value)}>
                    <option value="Ya">Ya</option><option value="Tidak">Tidak</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nomor Implan</label>
                  <input value={form.nomor_implan} onChange={(e) => updateField("nomor_implan", e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Laporan Operasi</label>
                <textarea value={form.laporan_operasi} onChange={(e) => updateField("laporan_operasi", e.target.value)}
                  style={{ minHeight: 250 }} />
                <div style={{ marginTop: 8, position: "relative" }} ref={templateRef}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowTemplates(!showTemplates)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: "middle" }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Template Operasi
                  </button>
                  {showTemplates && (
                    <div style={{
                      position: "absolute", left: 0, top: "100%", zIndex: 20, marginTop: 4,
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)",
                      minWidth: 280, maxHeight: 320, overflowY: "auto",
                    }}>
                      {OPERATION_TEMPLATES.map((t, i) => (
                        <button key={i} type="button" onClick={() => insertTemplate(t.text)}
                          style={{
                            display: "block", width: "100%", padding: "10px 14px", border: "none",
                            borderBottom: i < OPERATION_TEMPLATES.length - 1 ? "1px solid var(--border)" : "none",
                            background: "none", cursor: "pointer", textAlign: "left",
                            fontSize: ".85rem", color: "var(--text)", fontFamily: "inherit",
                            transition: "background .15s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                          <div style={{ fontWeight: 600 }}>{t.label}</div>
                          <div style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.text}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-danger-outline" onClick={() => { setView("list"); navigate("/laporan-operasi"); }}>Batal</button>
            <button className="btn btn-primary" onClick={() => handleSave(false)} disabled={loading}>
              {loading ? "Menyimpan..." : (hasExisting && (savedNoRawat || (no_rawat && no_rawat !== "new")) ? "Update" : "Simpan")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h1>Laporan Operasi</h1>
          <p className="text-muted">Data laporan operasi pasien</p>
        </div>
        <div className="table-stats">
          <span className="stat-chip">{total} laporan</span>
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
              <div style={{ fontSize: 28, fontWeight: 700 }}>{operasiStats?.total ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total Laporan Operasi</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                <span>Ralan: {operasiStats?.ralan?.total ?? 0}</span>
                <span>Ranap: {operasiStats?.ranap?.total ?? 0}</span>
              </div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[1].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{operasiStats?.ralan?.total ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Rawat Jalan</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                <span>BPJS: {operasiStats?.ralan?.bpjs ?? 0}</span>
                <span>Umum: {operasiStats?.ralan?.umum ?? 0}</span>
              </div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[2].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{operasiStats?.ranap?.total ?? 0}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Rawat Inap</div>
              <div style={{ display: "flex", gap: 12, fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                <span>BPJS: {operasiStats?.ranap?.bpjs ?? 0}</span>
                <span>Umum: {operasiStats?.ranap?.umum ?? 0}</span>
              </div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[3].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{(operasiStats?.ralan?.bpjs ?? 0) + (operasiStats?.ranap?.bpjs ?? 0)}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total BPJS</div>
            </div>
            <div className="stat-card" style={{ background: STAT_GRADIENTS[4].bg, borderRadius: 12, padding: "18px 20px", color: "#fff" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{(operasiStats?.ralan?.umum ?? 0) + (operasiStats?.ranap?.umum ?? 0)}</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Total Umum</div>
            </div>
          </>
        )}
      </div>

      {notif && (
        <CenteredNotification type={notif.type} message={notif.message} detail={notif.detail}
          onClose={() => setNotif(null)} autoClose={notif.type === "success" ? 1500 : 0} />
      )}

      <div className="filter-bar filter-bar-modern">
        <div className="filter-form">
          <div className="filter-row">
            <div className="filter-group">
              <label>Nama Pasien</label>
              <input placeholder="Cari pasien..." value={searchText}
                onChange={(e) => setSearchText(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>Dari Tanggal</label>
              <input type="date" value={tglFrom}
                onChange={(e) => { setTglFrom(e.target.value); setPage(1); loadOperasiStats({ tgl_from: e.target.value || undefined, tgl_to: tglTo || undefined, pj: pjFilter || undefined }); }} />
            </div>
            <div className="filter-group">
              <label>Sampai Tanggal</label>
              <input type="date" value={tglTo}
                onChange={(e) => { setTglTo(e.target.value); setPage(1); loadOperasiStats({ tgl_from: tglFrom || undefined, tgl_to: e.target.value || undefined, pj: pjFilter || undefined }); }} />
            </div>
            <div className="filter-group">
              <label>Jenis Rawat</label>
              <select value={jenisRawat}
                onChange={(e) => { setJenisRawat(e.target.value); setPage(1); }}>
                <option value="">Semua Jenis</option>
                <option value="Ralan">Rawat Jalan</option>
                <option value="Ranap">Rawat Inap</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Ruang Rawat</label>
              <select value={ruanganFilter}
                onChange={(e) => { setRuanganFilter(e.target.value); setPage(1); }}>
                <option value="">Semua Ruangan</option>
                {ruanganOptions.map((o) => <option key={o.kd_bangsal} value={o.kd_bangsal}>{o.nm_bangsal}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Penanggung Jawab</label>
              <select value={pjFilter}
                onChange={(e) => { setPjFilter(e.target.value); setPage(1); loadOperasiStats({ tgl_from: tglFrom || undefined, tgl_to: tglTo || undefined, pj: e.target.value || undefined }); }}>
                <option value="">Semua PJ</option>
                {pjOptions.map((o) => <option key={o.kd_pj} value={o.kd_pj}>{o.png_jawab}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="table-toolbar">
        <div className="table-info">{!loading && <span>Menampilkan {list.length} dari {total} data</span>}</div>
        <div className="table-limit">
          <label>Tampilkan</label>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
            {LIMIT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="patient-skeleton">
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton-card"><div className="skeleton-line w-60" /><div className="skeleton-line w-40" /><div className="skeleton-line w-80" /></div>)}
        </div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-muted)", marginBottom: ".5rem" }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>Belum ada laporan operasi</p>
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
                    <div className="patient-meta text-muted">
                      <span>{item.tanggal ? new Date(item.tanggal).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "-"}</span>
                    </div>
                  </div>
                </div>
                <div className="patient-card-footer">
                  <div className="footer-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>{item.operator || item.operator1 || "-"}</span>
                  </div>
                  <div className="footer-info">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <span>{item.diagnosa_preop || "-"}</span>
                  </div>
                  {item.ruang_rawat && (
                    <div className="footer-info">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span>{item.ruang_rawat}</span>
                    </div>
                  )}
                  {item.has_booking_operasi && item.booking_info && (() => {
                    const parts = item.booking_info.split("|");
                    return (
                      <div className="footer-info" style={{ color: "#92400e" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>Jadwal: {parts[0]} {parts[1]?.slice(0,5)} ({parts[2] || "-"})</span>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", paddingTop: 10, marginTop: 10, borderTop: "1px solid var(--border)" }}>
                  <button className="btn btn-outline btn-sm" onClick={() => handlePreview(item.no_rawat)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Lihat
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => handleEditOperasi(item.no_rawat)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>
                  <button className="btn btn-outline btn-sm"
                    style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                    onClick={() => setConfirmDelete(item.no_rawat)}>
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

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal-content" style={{ padding: "2rem", maxWidth: 700, width: "90%", maxHeight: "85vh", overflow: "auto", background: "var(--surface)", borderRadius: "var(--radius-lg)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3>Preview Laporan Operasi</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setPreview(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                <div><strong>No. Rawat:</strong> {preview.no_rawat}</div>
                <div><strong>Tanggal:</strong> {preview.tanggal ? new Date(preview.tanggal).toLocaleDateString("id-ID") : "-"}</div>
                <div><strong>Diagnosa Pre Op:</strong> {preview.diagnosa_preop || "-"}</div>
                <div><strong>Diagnosa Post Op:</strong> {preview.diagnosa_postop || "-"}</div>
                <div><strong>Jaringan Dieksekusi:</strong> {preview.jaringan_dieksekusi || "-"}</div>
                <div><strong>Selesai Operasi:</strong> {preview.selesaioperasi || "-"}</div>
                <div><strong>Permintaan PA:</strong> {preview.permintaan_pa || "-"}</div>
                <div><strong>Nomor Implan:</strong> {preview.nomor_implan || "-"}</div>
              </div>
            </div>

            <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid var(--border)" }} />

            <div style={{ fontSize: 13 }}>
              <strong>Laporan Operasi:</strong>
              <div style={{ marginTop: 4, padding: 12, background: "var(--bg)", borderRadius: "var(--radius)", whiteSpace: "pre-wrap" }}>
                {preview.laporan_operasi || "-"}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary btn-sm" onClick={() => { const nr = preview.no_rawat; setPreview(null); handleEditOperasi(nr); }}>
                Edit Laporan
              </button>
            </div>
          </div>
        </div>
      )}

      {editingModal && (
        <div className="modal-overlay" onClick={() => setEditingModal(null)}>
          <div className="modal-content" style={{ padding: "1.5rem", maxWidth: 700, width: "90%", maxHeight: "90vh", overflow: "auto", background: "var(--surface)", borderRadius: "var(--radius-lg)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>Edit Laporan Operasi - {editModalForm.nm_pasien || editModalForm.no_rawat}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setEditingModal(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>No. Rawat</label>
                  <input value={editModalForm.no_rawat || ""} onChange={(e) => setEditModalForm({...editModalForm, no_rawat: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Tanggal</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="text" placeholder="DD/MM/YYYY" value={toDisplayDate(editModalForm.tanggal || "")}
                      onChange={(e) => {
                        const t = toDisplayTime(editModalForm.tanggal || "");
                        setEditModalForm({...editModalForm, tanggal: fromDisplayDate(e.target.value) + "T" + fromDisplayTime(t)});
                      }} style={{ flex: 1, minWidth: 0 }} />
                    <input type="text" placeholder="HH:MM:SS" value={toDisplayTime(editModalForm.tanggal || "")}
                      onChange={(e) => {
                        const d = toDisplayDate(editModalForm.tanggal || "");
                        setEditModalForm({...editModalForm, tanggal: fromDisplayDate(d) + "T" + fromDisplayTime(e.target.value)});
                      }} style={{ width: 120 }} />
                  </div>
                </div>
              </div>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Diagnosa Pre Op</label>
                  <input value={editModalForm.diagnosa_preop || ""} onChange={(e) => setEditModalForm({...editModalForm, diagnosa_preop: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Diagnosa Post Op</label>
                  <input value={editModalForm.diagnosa_postop || ""} onChange={(e) => setEditModalForm({...editModalForm, diagnosa_postop: e.target.value})} />
                </div>
              </div>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Jaringan Dieksekusi</label>
                  <input value={editModalForm.jaringan_dieksekusi || ""} onChange={(e) => setEditModalForm({...editModalForm, jaringan_dieksekusi: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Selesai Operasi</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="text" placeholder="DD/MM/YYYY" value={toDisplayDate(editModalForm.selesaioperasi || "")}
                      onChange={(e) => {
                        const t = toDisplayTime(editModalForm.selesaioperasi || "");
                        setEditModalForm({...editModalForm, selesaioperasi: fromDisplayDate(e.target.value) + "T" + fromDisplayTime(t)});
                      }} style={{ flex: 1, minWidth: 0 }} />
                    <input type="text" placeholder="HH:MM:SS" value={toDisplayTime(editModalForm.selesaioperasi || "")}
                      onChange={(e) => {
                        const d = toDisplayDate(editModalForm.selesaioperasi || "");
                        setEditModalForm({...editModalForm, selesaioperasi: fromDisplayDate(d) + "T" + fromDisplayTime(e.target.value)});
                      }} style={{ width: 120 }} />
                  </div>
                </div>
              </div>
              <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="form-group">
                  <label>Permintaan PA</label>
                  <select value={editModalForm.permintaan_pa || "Tidak"} onChange={(e) => setEditModalForm({...editModalForm, permintaan_pa: e.target.value})}>
                    <option value="Ya">Ya</option><option value="Tidak">Tidak</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nomor Implan</label>
                  <input value={editModalForm.nomor_implan || ""} onChange={(e) => setEditModalForm({...editModalForm, nomor_implan: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Laporan Operasi</label>
                <textarea value={editModalForm.laporan_operasi || ""} onChange={(e) => setEditModalForm({...editModalForm, laporan_operasi: e.target.value})} rows={8} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setEditingModal(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleEditOperasiSave} disabled={savingEdit}>{savingEdit ? "Menyimpan..." : "Update"}</button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={!!confirmDelete}
        title="Hapus Laporan Operasi"
        message="Yakin ingin menghapus laporan operasi ini? Data yang sudah dihapus tidak dapat dikembalikan."
        identifier={confirmDelete || ""}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
      />
    </div>
  );
}