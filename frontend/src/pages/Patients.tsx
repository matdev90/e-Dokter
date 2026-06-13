import { useState, useEffect, FormEvent } from "react";
import { Link } from "react-router-dom";
import { getPatients, createPatient } from "../services/api";

export default function Patients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", nik: "", phone: "", address: "" });
  const [error, setError] = useState("");

  const load = () => {
    getPatients(search, page).then((res) => {
      setPatients(res.data);
      setTotalPages(res.pagination?.totalPages || 0);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, [page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createPatient(form);
      setShowCreate(false);
      setForm({ name: "", nik: "", phone: "", address: "" });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create patient");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Pasien</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Pasien Baru</button>
      </div>

      <form className="search-bar" onSubmit={handleSearch}>
        <input placeholder="Cari nama, NIK, atau no RM..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="btn btn-primary">Cari</button>
      </form>

      <div className="card">
        {patients.length === 0 ? (
          <div className="empty-state">Belum ada data pasien</div>
        ) : (
          <table>
            <thead><tr><th>No. RM</th><th>Nama</th><th>NIK</th><th>No. HP</th><th></th></tr></thead>
            <tbody>
              {patients.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.medicalRecordNumber}</td>
                  <td>{p.name}</td>
                  <td>{p.nik || "-"}</td>
                  <td>{p.phone || "-"}</td>
                  <td><Link to={`/patients/${p.id}`} className="btn btn-outline btn-sm">Detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Pasien Baru</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Nama *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>NIK</label>
                  <input value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>No. HP</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Alamat</label>
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
