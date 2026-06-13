import { useState, useEffect, FormEvent } from "react";
import { getUsers, createUser, updateUser } from "../services/api";

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "assistant" });
  const [error, setError] = useState("");

  const load = () => {
    getUsers().then((res) => setUsers(res)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createUser(form);
      setShowCreate(false);
      setForm({ email: "", password: "", name: "", role: "assistant" });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed");
    }
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    try {
      await updateUser(editUser.id, { name: editUser.name, role: editUser.role });
      setEditUser(null);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Pengguna</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Pengguna Baru</button>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                <td><button className="btn btn-outline btn-sm" onClick={() => setEditUser(u)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Pengguna Baru</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Nama</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="doctor">Dokter</option>
                  <option value="assistant">Asisten</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Pengguna</h2>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Nama</label>
                <input required value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}>
                  <option value="doctor">Dokter</option>
                  <option value="assistant">Asisten</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEditUser(null)}>Batal</button>
                <button type="submit" className="btn btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
