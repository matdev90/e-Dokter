import { useEffect } from "react";

interface CenteredNotificationProps {
  type: "success" | "error" | "info";
  message: string;
  detail?: string;
  onClose: () => void;
  autoClose?: number;
}

export default function CenteredNotification({ type, message, detail, onClose, autoClose }: CenteredNotificationProps) {
  useEffect(() => {
    if (autoClose && autoClose > 0) {
      const timer = setTimeout(onClose, autoClose);
      return () => clearTimeout(timer);
    }
  }, [autoClose, onClose]);

  const isSuccess = type === "success";
  const isInfo = type === "info";

  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 9999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440, width: "90%", padding: 0, borderRadius: 16, overflow: "hidden",
          textAlign: "center",
          animation: "modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
        <div style={{
          padding: "2rem 2rem 1.5rem",
          background: isSuccess ? "linear-gradient(135deg, #064e3b, #065f46)" : isInfo ? "linear-gradient(135deg, #1e3a5f, #1a4971)" : "linear-gradient(135deg, #450a0a, #5f0e0e)",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: isSuccess ? "rgba(16,185,129,0.2)" : isInfo ? "rgba(59,130,246,0.2)" : "rgba(239,68,68,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
            animation: "loginLogoPulse 1.2s ease-in-out infinite",
          }}>
            {isSuccess ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : isInfo ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
          </div>
          <h3 style={{
            margin: 0, fontSize: "1.1rem", fontWeight: 700,
            color: isSuccess ? "#34d399" : isInfo ? "#60a5fa" : "#f87171",
          }}>
            {isInfo ? "Informasi Sistem" : isSuccess ? "Berhasil!" : "Gagal!"}
          </h3>
        </div>
        <div style={{ padding: "1.25rem 2rem 2rem", background: "var(--surface)" }}>
          {message && (
            <p style={{ margin: 0, fontSize: ".9rem", color: "var(--text)", lineHeight: 1.5 }}>
              {message}
            </p>
          )}
          {detail && (
            <p style={{
              margin: "8px 0 0", fontSize: ".8rem", color: "var(--text-muted)",
              background: "var(--bg)", padding: "10px 12px", borderRadius: 8,
              textAlign: "left", lineHeight: 1.5, wordBreak: "break-word",
            }}>
              {detail}
            </p>
          )}
          <button className="btn btn-primary" onClick={onClose}
            style={{ marginTop: 16, padding: "8px 24px", textAlign: "center" }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
