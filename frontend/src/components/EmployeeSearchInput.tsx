import { useState, useEffect, useRef } from "react";
import { searchPegawai } from "../services/api";

interface EmployeeSearchInputProps {
  value: string;
  onChange: (kode: string) => void;
  placeholder?: string;
  displayName?: string;
  onSelectName?: (name: string) => void;
}

export default function EmployeeSearchInput({ value, onChange, placeholder, displayName, onSelectName }: EmployeeSearchInputProps) {
  const [query, setQuery] = useState(displayName || value);
  const [results, setResults] = useState<any[]>([]);
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

  const getKode = (item: any) => {
    return item.nip || item.nik || item.id_pegawai || item.id_karyawan
      || item.kd_pegawai || item.kode || item.id || "";
  };

  const getName = (item: any) => {
    return item.nama || item.nm_pegawai || item.nm_karyawan || item.nama_pegawai
      || item.nama_karyawan || item.nm_petugas || item.nama_petugas || item.nm_staf
      || item.nama_staf || "";
  };

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
        const r = await searchPegawai(q);
        setResults(r);
        setOpen(r.length > 0);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  };

  const select = (item: any) => {
    const kode = getKode(item);
    const name = getName(item);
    onChange(kode);
    if (onSelectName) onSelectName(name);
    setQuery(name);
    setUserEdited(false);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <input
        placeholder={placeholder || "Cari pegawai..."}
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
          {results.map((item, i) => (
            <div key={i}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: ".85rem",
                borderBottom: "1px solid var(--border)", transition: "background .15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              onClick={() => select(item)}
            >
              <strong>{getName(item)}</strong>
              <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: ".8rem" }}>{getKode(item)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
