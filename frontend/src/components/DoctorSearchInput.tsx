import { useState, useEffect, useRef } from "react";
import { searchDokter } from "../services/api";

interface DoctorSearchInputProps {
  value: string;
  onChange: (kode: string) => void;
  placeholder?: string;
  displayName?: string;
}

export default function DoctorSearchInput({ value, onChange, placeholder, displayName }: DoctorSearchInputProps) {
  const [query, setQuery] = useState(displayName || value);
  const [results, setResults] = useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userEdited, setUserEdited] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!userEdited) setQuery(displayName || value);
  }, [value, displayName, userEdited]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = (q: string) => {
    setUserEdited(true);
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchDokter(q);
        setResults(r);
        setOpen(r.length > 0);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  };

  const select = (kd: string) => {
    onChange(kd);
    const sel = results.find((r) => r.kd_dokter === kd);
    setQuery(sel ? sel.nm_dokter : kd);
    setUserEdited(false);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <input
        placeholder={placeholder || "Kode dokter"}
        value={query}
        onChange={(e) => doSearch(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
      />
      {loading && <span style={{ position: "absolute", right: 8, top: 8, fontSize: ".75rem", color: "var(--text-muted)" }}>...</span>}
      {open && (
        <div style={{
          position: "absolute", left: 0, top: "100%", zIndex: 30, marginTop: 2,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)",
          minWidth: 280, maxHeight: 240, overflowY: "auto",
        }}>
          {results.map((d) => (
            <div key={d.kd_dokter}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: ".85rem",
                borderBottom: "1px solid var(--border)", transition: "background .15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              onClick={() => select(d.kd_dokter)}
            >
              <strong>{d.nm_dokter}</strong>
              <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: ".8rem" }}>{d.kd_dokter}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}