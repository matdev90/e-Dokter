import { useState, useRef, useEffect, useCallback } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { getCurrentUser, logout, getSetting, getNotifications } from "../services/api";

const APP_VERSION = "1.0.0";

export default function Layout() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<string | null>(localStorage.getItem("profilePhoto"));
  const [hospitalName, setHospitalName] = useState("");
  const [logoError, setLogoError] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [notifData, setNotifData] = useState<any>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatClock = useCallback(() => {
    return clock.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [clock]);

  const formatClockDate = useCallback(() => {
    return clock.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }, [clock]);

  useEffect(() => {
    const cached = localStorage.getItem("hospitalSetting");
    if (cached) {
      setHospitalName(JSON.parse(cached).nama_instansi);
    }
    getSetting()
      .then((s) => {
        setHospitalName(s.nama_instansi);
        localStorage.setItem("hospitalSetting", JSON.stringify(s));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    const interval = setInterval(() => {
      const p = localStorage.getItem("profilePhoto");
      if (p !== photo) setPhoto(p);
    }, 500);
    return () => {
      document.removeEventListener("mousedown", handler);
      clearInterval(interval);
    };
  }, [photo]);

  useEffect(() => {
    getNotifications().then(setNotifData).catch(() => {});
    const t = setInterval(() => {
      getNotifications().then(setNotifData).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const Avatar = ({ size }: { size: "sm" | "lg" }) => (
    <div className={`avatar-${size}`}>
      {photo ? (
        <img src={photo} alt="Profile" className="avatar-img" />
      ) : (
        user?.name?.charAt(0).toUpperCase() || "U"
      )}
    </div>
  );

  return (
    <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <header className="topnavbar">
        <div className="topnavbar-left">
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          {logoError ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" style={{ marginRight: 8 }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          ) : (
            <img src={`${import.meta.env.BASE_URL}assets/images/logo.png`} alt="Logo"
              style={{ height: 28, marginRight: 8, borderRadius: 4 }}
              onError={() => setLogoError(true)} />
          )}
          <span className="brand-text">e-Dokter</span>
          {hospitalName && (
            <>
              <span className="brand-separator">|</span>
              <span className="brand-sub">{hospitalName}</span>
            </>
          )}
        </div>

        <div className="topnavbar-center">
          <div className="topnavbar-clock">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="clock-time">{formatClock()}</span>
            <span className="clock-sep">|</span>
            <span className="clock-date">{formatClockDate()}</span>
          </div>
        </div>

        <div className="topnavbar-right">
          <div className="notif-wrapper" ref={notifRef}>
            <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {(notifData && (notifData.belum_resume_ralan + notifData.belum_resume_ranap + notifData.total_belum_laporan_operasi) > 0) && (
                <span className="notif-badge">
                  {notifData.belum_resume_ralan + notifData.belum_resume_ranap + notifData.total_belum_laporan_operasi}
                </span>
              )}
            </button>
            {notifOpen && notifData && (
              <div className="notif-dropdown">
                <div className="notif-header">Notifikasi &amp; Pengingat</div>
                <div className="notif-list">
                  {notifData.belum_resume_ralan > 0 && (
                    <NavLink to="/resume-ralan" className="notif-item" onClick={() => setNotifOpen(false)}>
                      <div className="notif-icon" style={{ background: "#fef3c7" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/>
                        </svg>
                      </div>
                      <div className="notif-text">
                        <strong>{notifData.belum_resume_ralan} pasien</strong> rawat jalan belum diresume hari ini
                      </div>
                    </NavLink>
                  )}
                  {notifData.belum_resume_ranap > 0 && (
                    <NavLink to="/resume-ranap" className="notif-item" onClick={() => setNotifOpen(false)}>
                      <div className="notif-icon" style={{ background: "#fef3c7" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                      </div>
                      <div className="notif-text">
                        <strong>{notifData.belum_resume_ranap} pasien</strong> rawat inap belum diresume bulan ini
                      </div>
                    </NavLink>
                  )}
                  {notifData.total_belum_laporan_operasi > 0 && (
                    <NavLink to="/laporan-operasi" className="notif-item" onClick={() => setNotifOpen(false)}>
                      <div className="notif-icon" style={{ background: "#dbeafe" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      </div>
                      <div className="notif-text">
                        <strong>{notifData.total_belum_laporan_operasi} pasien</strong> sudah dioperasi tapi belum laporan operasi
                      </div>
                    </NavLink>
                  )}
                  {notifData.belum_resume_ralan === 0 && notifData.belum_resume_ranap === 0 && notifData.total_belum_laporan_operasi === 0 && (
                    <div className="notif-empty">Semua sudah lengkap ✓</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="profile-wrapper" ref={dropdownRef}>
            <button className="profile-btn" onClick={() => setProfileOpen(!profileOpen)}>
            <Avatar size="sm" />
            <div className="profile-info">
              <span className="profile-name">{user?.name || "User"}</span>
              <span className="profile-role">{user?.spesialisasi || user?.role}</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-header">
                <Avatar size="lg" />
                <div>
                  <div className="fw-600">{user?.name}</div>
                  <div className="text-muted fs-small">{user?.email}</div>
                </div>
              </div>
              <div className="dropdown-divider" />
              <NavLink to="/profile" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Profil Saya
              </NavLink>
              <NavLink to="/ganti-password" className="dropdown-item" onClick={() => setProfileOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                Ubah Password
              </NavLink>
              <div className="dropdown-divider" />
              <button className="dropdown-item" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
              </button>
            </div>
          )}
          </div>
        </div>
      </header>

      <aside className="sidebar">
        <nav>
          <NavLink to="/" end onClick={() => setProfileOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/resume-ralan" onClick={() => setProfileOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13" cy="5" r="2.5"/>
              <path d="M4 16a8 8 0 1 0 16 0"/>
              <path d="M9 11h7l2 5h-4"/>
              <path d="M14 16h5l-1 4h-4"/>
            </svg>
            <span>Rawat Jalan</span>
          </NavLink>
          <NavLink to="/resume-ranap" onClick={() => setProfileOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="11" width="20" height="10" rx="1.5"/>
              <path d="M2 21v2"/>
              <path d="M22 21v2"/>
              <path d="M7 14h4v3H7z"/>
              <path d="M13 14h4v3h-4z"/>
              <path d="M7 11V8a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3"/>
            </svg>
            <span>Rawat Inap</span>
          </NavLink>
          <NavLink to="/laporan-operasi" onClick={() => setProfileOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              <path d="M9 14h6"/><path d="M9 18h6"/><path d="M9 10h2"/>
            </svg>
            <span>Laporan Operasi</span>
          </NavLink>
          <NavLink to="/laporan-resume" onClick={() => setProfileOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span>Laporan Resume</span>
          </NavLink>
          {user?.role === "admin" && (
            <>
              <NavLink to="/users" onClick={() => setProfileOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                <span>Pengguna</span>
              </NavLink>
              <NavLink to="/audit-logs" onClick={() => setProfileOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Audit Log</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-version">
          <span className="version-brand">e-Dokter</span>
          {hospitalName && <span className="version-hospital">{hospitalName}</span>}
          <span className="version-number">v{APP_VERSION}</span>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
