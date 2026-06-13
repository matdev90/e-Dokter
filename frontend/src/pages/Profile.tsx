import { useState, useRef } from "react";
import { getCurrentUser } from "../services/api";

export default function Profile() {
  const user = getCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(localStorage.getItem("profilePhoto"));
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhoto(dataUrl);
      localStorage.setItem("profilePhoto", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setSaving(true);
    const stored = localStorage.getItem("user");
    if (stored) {
      const u = JSON.parse(stored);
      u.name = name;
      localStorage.setItem("user", JSON.stringify(u));
    }
    setTimeout(() => {
      setSaving(false);
      setSuccess("Profil berhasil diperbarui");
      setTimeout(() => setSuccess(""), 2000);
    }, 300);
  };

  const initial = user?.name?.charAt(0).toUpperCase() || "U";

  return (
    <div>
      <div className="page-header">
        <h1>Profil Saya</h1>
      </div>

      <div className="profile-layout">
        <div className="card profile-photo-card">
          <div className="photo-section">
            <div className="avatar-profile" onClick={() => fileRef.current?.click()}>
              {photo ? <img src={photo} alt="Profile" /> : <span>{initial}</span>}
              <div className="avatar-overlay">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            <p className="text-muted fs-small" style={{ marginTop: ".5rem" }}>Klik untuk mengganti foto</p>
          </div>
          <div className="profile-meta">
            <div className="meta-item"><span className="meta-label">Role</span><span className="meta-value badge-role">{user?.role}</span></div>
            <div className="meta-item"><span className="meta-label">Email</span><span className="meta-value">{user?.email}</span></div>
            <div className="meta-item"><span className="meta-label">Kode Dokter</span><span className="meta-value">{user?.doctor_code || "-"}</span></div>
            <div className="meta-item"><span className="meta-label">Spesialisasi</span><span className="meta-value">{user?.spesialisasi || "-"}</span></div>
          </div>
        </div>

        <div className="card" style={{ flex: 1 }}>
          <h3 style={{ marginBottom: "1rem" }}>Informasi Profil</h3>
          {success && <div className="alert alert-success">{success}</div>}
          <div className="form-group">
            <label>Nama Lengkap</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={user?.email || ""} readOnly className="readonly-input" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <input value={user?.role || ""} readOnly className="readonly-input" />
          </div>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}
