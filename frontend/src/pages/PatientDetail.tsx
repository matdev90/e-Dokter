import { useState, useEffect, FormEvent, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getPatient, getRecords, createRecord, lockRecord, addAddendum,
  uploadAttachment, searchICD10, updatePatient, getCurrentUser, type ICD10Code,
} from "../services/api";

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"records" | "profile">("records");
  const [showCreate, setShowCreate] = useState(false);
  const [diagnosisQuery, setDiagnosisQuery] = useState("");
  const [diagnosisResults, setDiagnosisResults] = useState<ICD10Code[]>([]);
  const [diagnosisTimer, setDiagnosisTimer] = useState<any>(null);
  const user = getCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [recordForm, setRecordForm] = useState({
    subjective: "", objective: "", assessment: "", plan: "",
    diagnosisCode: "", diagnosisDescription: "",
  });

  useEffect(() => {
    if (!id) return;
    getPatient(id).then(setPatient).catch(() => {});
    getRecords(id).then(setRecords).catch(() => {});
  }, [id]);

  const handleICD10Search = (q: string) => {
    setDiagnosisQuery(q);
    if (diagnosisTimer) clearTimeout(diagnosisTimer);
    if (q.length < 2) { setDiagnosisResults([]); return; }
    const timer = setTimeout(() => {
      searchICD10(q).then(setDiagnosisResults).catch(() => {});
    }, 300);
    setDiagnosisTimer(timer);
  };

  const selectDiagnosis = (d: ICD10Code) => {
    setRecordForm({ ...recordForm, diagnosisCode: d.code, diagnosisDescription: d.description });
    setDiagnosisQuery(`${d.code} - ${d.description}`);
    setDiagnosisResults([]);
  };

  const handleCreateRecord = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await createRecord({ patientId: id, ...recordForm });
    setShowCreate(false);
    setRecordForm({ subjective: "", objective: "", assessment: "", plan: "", diagnosisCode: "", diagnosisDescription: "" });
    setDiagnosisQuery("");
    const updated = await getRecords(id);
    setRecords(updated);
  };

  const handleLock = async (recordId: string) => {
    await lockRecord(recordId);
    const updated = await getRecords(id!);
    setRecords(updated);
  };

  const handleAddendum = async (recordId: string) => {
    const content = prompt("Tambah addendum:");
    if (!content) return;
    await addAddendum(recordId, content);
    const updated = await getRecords(id!);
    setRecords(updated);
  };

  const handleUpload = async (recordId?: string) => {
    const file = fileRef.current?.files?.[0];
    if (!file || !id) return;
    await uploadAttachment(file, id, recordId);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleEditProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await updatePatient(id, patient);
    const updated = await getPatient(id);
    setPatient(updated);
    alert("Data pasien berhasil diperbarui");
  };

  if (!patient) {
    return <div className="empty-state">Memuat...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>{patient.name}</h1>
        <button className={`btn ${activeTab === "records" ? "btn-primary" : "btn-outline"}`} onClick={() => setActiveTab("records")}>Rekam Medis</button>
        <button className={`btn ${activeTab === "profile" ? "btn-primary" : "btn-outline"}`} onClick={() => setActiveTab("profile")}>Profil</button>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: ".75rem" }}>
          <div><strong>No. RM:</strong> {patient.medicalRecordNumber}</div>
          <div><strong>NIK:</strong> {patient.nik || "-"}</div>
          <div><strong>No. HP:</strong> {patient.phone || "-"}</div>
          <div><strong>Jenis Kelamin:</strong> {patient.gender || "-"}</div>
          <div><strong>Gol. Darah:</strong> {patient.bloodType || "-"}</div>
          <div><strong>Alergi:</strong> {patient.allergies || "-"}</div>
        </div>
      </div>

      {activeTab === "profile" && (
        <div className="card">
          <form onSubmit={handleEditProfile}>
            <div className="form-row">
              <div className="form-group">
                <label>Nama</label>
                <input value={patient.name || ""} onChange={(e) => setPatient({ ...patient, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>NIK</label>
                <input value={patient.nik || ""} onChange={(e) => setPatient({ ...patient, nik: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Tanggal Lahir</label>
                <input type="date" value={patient.birthDate?.split(" ")[0] || ""} onChange={(e) => setPatient({ ...patient, birthDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Jenis Kelamin</label>
                <select value={patient.gender || ""} onChange={(e) => setPatient({ ...patient, gender: e.target.value })}>
                  <option value="">--</option>
                  <option value="male">Laki-laki</option>
                  <option value="female">Perempuan</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Alamat</label>
              <textarea value={patient.address || ""} onChange={(e) => setPatient({ ...patient, address: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>No. HP</label>
                <input value={patient.phone || ""} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Gol. Darah</label>
                <select value={patient.bloodType || ""} onChange={(e) => setPatient({ ...patient, bloodType: e.target.value })}>
                  <option value="">--</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                  <option value="O">O</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Alergi</label>
              <input value={patient.allergies || ""} onChange={(e) => setPatient({ ...patient, allergies: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
          </form>
        </div>
      )}

      {activeTab === "records" && (
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Rekam Medis Baru</button>
          </div>

          {records.length === 0 && <div className="empty-state">Belum ada rekam medis</div>}

          {records.map((r: any) => (
            <div key={r.id} className="record-card">
              <div className="record-header">
                <div className="meta">
                  {new Date(r.visitDate).toLocaleDateString("id-ID")} | {r.doctorName || `Dr. ${r.doctorId}`}
                  {r.isLocked && <span className="badge" style={{ marginLeft: ".5rem", background: "#fef2f2", color: "var(--danger)" }}>Terkunci</span>}
                </div>
                <div style={{ display: "flex", gap: ".35rem" }}>
                  {!r.isLocked && user?.role === "doctor" && (
                    <button className="btn btn-outline btn-sm" onClick={() => handleLock(r.id)}>Kunci</button>
                  )}
                  {!r.isLocked && (
                    <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
                      Upload File
                      <input type="file" hidden onChange={() => handleUpload(r.id)} />
                    </label>
                  )}
                </div>
              </div>

              {r.diagnosisCode && (
                <div className="record-field">
                  <div className="label">Diagnosis (ICD-10)</div>
                  <div className="value">{r.diagnosisCode} - {r.diagnosisDescription}</div>
                </div>
              )}

              <div className="soap-grid" style={{ marginTop: ".5rem" }}>
                {r.subjective && <div className="soap-section"><h4>S - Subjective</h4><p>{r.subjective}</p></div>}
                {r.objective && <div className="soap-section"><h4>O - Objective</h4><p>{r.objective}</p></div>}
                {r.assessment && <div className="soap-section"><h4>A - Assessment</h4><p>{r.assessment}</p></div>}
                {r.plan && <div className="soap-section"><h4>P - Plan</h4><p>{r.plan}</p></div>}
              </div>

              {r.addendums && r.addendums.length > 0 && (
                <div style={{ marginTop: ".75rem", padding: ".75rem", background: "#f8fafc", borderRadius: "var(--radius)" }}>
                  <strong style={{ fontSize: ".85rem" }}>Addendum</strong>
                  {r.addendums.map((a: any) => (
                    <div key={a.id} style={{ fontSize: ".85rem", marginTop: ".5rem" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: ".8rem" }}>{new Date(a.createdAt).toLocaleString("id-ID")}</div>
                      <p style={{ whiteSpace: "pre-wrap" }}>{a.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {!r.isLocked && (
                <button className="btn btn-outline btn-sm" style={{ marginTop: ".5rem" }} onClick={() => handleAddendum(r.id)}>+ Addendum</button>
              )}
            </div>
          ))}

          {showCreate && (
            <div className="modal-overlay" onClick={() => setShowCreate(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "650px" }}>
                <h2>Rekam Medis Baru</h2>
                <form onSubmit={handleCreateRecord}>
                  <div className="soap-grid">
                    <div className="form-group">
                      <label>S - Subjective</label>
                      <textarea
                        placeholder="Keluhan pasien, riwayat penyakit..."
                        value={recordForm.subjective}
                        onChange={(e) => setRecordForm({ ...recordForm, subjective: e.target.value })}
                        style={{ minHeight: "100px" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>O - Objective</label>
                      <textarea
                        placeholder="Tanda vital, pemeriksaan fisik..."
                        value={recordForm.objective}
                        onChange={(e) => setRecordForm({ ...recordForm, objective: e.target.value })}
                        style={{ minHeight: "100px" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>A - Assessment</label>
                      <textarea
                        placeholder="Diagnosis kerja, diagnosis banding..."
                        value={recordForm.assessment}
                        onChange={(e) => setRecordForm({ ...recordForm, assessment: e.target.value })}
                        style={{ minHeight: "100px" }}
                      />
                    </div>
                    <div className="form-group">
                      <label>P - Plan</label>
                      <textarea
                        placeholder="Tata laksana, terapi, rencana..."
                        value={recordForm.plan}
                        onChange={(e) => setRecordForm({ ...recordForm, plan: e.target.value })}
                        style={{ minHeight: "100px" }}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ position: "relative" }}>
                    <label>Diagnosis (ICD-10)</label>
                    <input
                      placeholder="Cari diagnosis..."
                      value={diagnosisQuery}
                      onChange={(e) => handleICD10Search(e.target.value)}
                    />
                    {diagnosisResults.length > 0 && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0,
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius)", zIndex: 10, maxHeight: "200px", overflowY: "auto",
                      }}>
                        {diagnosisResults.map((d) => (
                          <div
                            key={d.code}
                            style={{ padding: ".5rem .75rem", cursor: "pointer", fontSize: ".85rem", borderBottom: "1px solid var(--border)" }}
                            onClick={() => selectDiagnosis(d)}
                          >
                            <strong>{d.code}</strong> - {d.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Batal</button>
                    <button type="submit" className="btn btn-primary">Simpan</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <input type="file" ref={fileRef} hidden onChange={() => handleUpload()} />
        </div>
      )}
    </div>
  );
}
