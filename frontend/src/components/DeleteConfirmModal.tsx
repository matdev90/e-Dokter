import { useEffect, useState } from "react";

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  identifier: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export default function DeleteConfirmModal({ open, title, message, identifier, onCancel, onConfirm, loading }: DeleteConfirmModalProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setExiting(false);
    }
  }, [open]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      onCancel();
    }, 250);
  };

  const handleConfirm = () => {
    onConfirm();
  };

  if (!visible && !open) return null;

  return (
    <div
      className={`delete-modal-overlay ${exiting ? "exiting" : ""}`}
      onClick={handleClose}
    >
      <div
        className={`delete-modal-card ${exiting ? "exiting" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-modal-icon-wrap">
          <div className="delete-modal-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>
        </div>

        <h3 className="delete-modal-title">{title}</h3>
        <p className="delete-modal-message">{message}</p>

        <div className="delete-modal-id">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>{identifier}</span>
        </div>

        <div className="delete-modal-actions">
          <button className="btn btn-outline" onClick={handleClose} disabled={loading}>
            Batal
          </button>
          <button className="btn btn-delete" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <span className="delete-spinner" />
                Menghapus...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Hapus
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
