import { useState, useEffect, useRef } from "react";

type ICDCode = {
  code: string;
  description: string;
};

interface IcdAutocompleteInputProps {
  label: string;
  kdField: string;
  nameField: string;
  form: Record<string, string>;
  setForm: (f: any) => void;
  searchFn: (q: string) => Promise<ICDCode[]>;
  placeholder?: string;
}

export default function IcdAutocompleteInput({
  label, kdField, nameField, form, setForm, searchFn, placeholder,
}: IcdAutocompleteInputProps) {
  const [query, setQuery] = useState(form[kdField] || "");
  const [results, setResults] = useState<ICDCode[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    setQuery(form[kdField] || "");
  }, [form[kdField], kdField]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = (q: string) => {
    setQuery(q);
    setForm({ ...form, [kdField]: q });
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      setForm({ ...form, [kdField]: q, [nameField]: "" });
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchFn(q);
        setResults(r);
        setOpen(r.length > 0);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  };

  const select = (code: ICDCode) => {
    setForm({ ...form, [kdField]: code.code, [nameField]: code.description });
    setQuery(code.code);
    setOpen(false);
  };

  return (
    <div className="icd-row">
      <div className="icd-code-group">
        <label>{label} — Kode</label>
        <div className="icd-input-wrap" ref={ref} style={{ position: "relative" }}>
          <input
            placeholder={placeholder || "Ketik kode atau nama..."}
            value={query}
            onChange={(e) => doSearch(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
          />
          {loading && (
            <span style={{ position: "absolute", right: 36, top: 8, fontSize: ".75rem", color: "#6b7280" }}>...</span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: "absolute", right: 10, top: 10, color: "#9ca3af", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          {open && (
            <div style={{
              position: "absolute", left: 0, top: "100%", zIndex: 30, marginTop: 2,
              background: "#fff", border: "1px solid #d1d5db",
              borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 300, maxHeight: 260, overflowY: "auto",
            }}>
              {results.map((item) => (
                <div key={item.code}
                  style={{
                    padding: "8px 12px", cursor: "pointer", display: "flex", gap: 10,
                    alignItems: "center", borderBottom: "1px solid #f3f4f6",
                    fontSize: ".85rem", transition: "background .15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  onClick={() => select(item)}
                >
                  <span style={{
                    fontFamily: "monospace", fontWeight: 600, fontSize: 13, color: "#2563eb",
                    background: "#eff6ff", padding: "3px 8px", borderRadius: 5, whiteSpace: "nowrap",
                  }}>
                    {item.code}
                  </span>
                  <span style={{ color: "#374151" }}>{item.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="icd-name-group">
        <label>{label} — Nama</label>
        <input
          placeholder={`Nama ${label.toLowerCase()}`}
          value={form[nameField] || ""}
          onChange={(e) => setForm({ ...form, [nameField]: e.target.value })}
        />
      </div>
    </div>
  );
}
