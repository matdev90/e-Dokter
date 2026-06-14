import { useState, useEffect, FormEvent, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { login, getSetting } from "../services/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(true);
  const [cardVisible, setCardVisible] = useState(false);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const cached = localStorage.getItem("hospitalSetting");
    if (cached) {
      const s = JSON.parse(cached);
      setHospitalName(s.nama_instansi);
      if (s.logo) setLogoBase64(`data:image/png;base64,${s.logo}`);
    }
    getSetting()
      .then((s) => {
        setHospitalName(s.nama_instansi);
        if (s.logo) setLogoBase64(`data:image/png;base64,${s.logo}`);
        localStorage.setItem("hospitalSetting", JSON.stringify(s));
      })
      .catch(() => {
        if (!cached) setHospitalName("RS Islam S. Anggoro");
      });
    requestAnimationFrame(() => setCardVisible(true));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const minDuration = new Promise<void>((resolve) => setTimeout(resolve, 1200));
    try {
      const result = await Promise.all([login(username, password), minDuration]);
      navigate("/");
    } catch (err: any) {
      await minDuration;
      if (!err.response) {
        setError("Tidak dapat terhubung ke server. Pastikan backend berjalan.");
      } else {
        setError(err.response?.data?.error || "Login gagal");
      }
      formRef.current?.classList.add("shake");
      setTimeout(() => formRef.current?.classList.remove("shake"), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page login-page-modern">
      <div className="login-dot-grid" />
      <div className="login-particles">
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
        <div className="login-particle" />
      </div>
      <div className="login-bg-shapes">
        <div className="login-shape login-shape-1" />
        <div className="login-shape login-shape-2" />
        <div className="login-shape login-shape-3" />
        <div className="login-shape login-shape-4" />
      </div>
      <div className="login-glow-line" />
      <div className="login-glow-line" />
      <div className="login-glow-line" />

      <div className={`login-wrapper ${cardVisible ? "visible" : ""}`}>
        <form ref={formRef} className="login-card login-card-modern" onSubmit={handleSubmit}>
          <div className="login-card-header">
            <div className="login-logo-wrap">
              {logoLoaded ? (
                <img src={`${import.meta.env.BASE_URL}assets/images/logo.png`} alt="Logo"
                  onError={() => {
                    setLogoLoaded(false);
                    if (logoBase64) {
                      const img = new Image();
                      img.src = logoBase64;
                      img.onload = () => setLogoLoaded(true);
                    }
                  }} />
              ) : logoBase64 ? (
                <img src={logoBase64} alt="Logo" />
              ) : (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              )}
            </div>
            <h1>e-Dokter</h1>
            <p>{hospitalName}</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="login-fields">
            <div className="form-group">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: "middle" }}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Username
              </label>
              <div className="login-input-wrap">
                <input type="text" value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  placeholder="Username" required autoFocus />
                {username && (
                  <button type="button" className="login-input-clear" onClick={() => setUsername("")} tabIndex={-1}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6, verticalAlign: "middle" }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Password
              </label>
              <div className="login-input-wrap">
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password" required />
                <button type="button" className="login-password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? (
              <span className="btn-login-loading">
                <span className="login-loading-logo">
                  {logoBase64 ? (
                    <img src={logoBase64} alt="" />
                  ) : (
                    <img src={`${import.meta.env.BASE_URL}assets/images/logo.png`} alt=""
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  )}
                </span>
                Memproses...
              </span>
            ) : "Masuk"}
          </button>
        </form>
      </div>

      {loading && (
        <div className="login-overlay">
          <div className="login-overlay-particles">
            <div className="login-overlay-particle" />
            <div className="login-overlay-particle" />
            <div className="login-overlay-particle" />
            <div className="login-overlay-particle" />
            <div className="login-overlay-particle" />
            <div className="login-overlay-particle" />
          </div>
          <div className="login-overlay-inner">
            <div className="login-overlay-ring-outer">
              <div className="login-overlay-ring" />
              <div className="login-overlay-ring-dash" />
            </div>
            <div className="login-overlay-logo">
              {logoBase64 ? (
                <img src={logoBase64} alt="Logo RS" />
              ) : (
                <img src={`${import.meta.env.BASE_URL}assets/images/logo.png`} alt="Logo"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
            <div className="login-overlay-text">Memproses...</div>
          </div>
        </div>
      )}
    </div>
  );
}
