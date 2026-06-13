import { useState, useEffect } from "react";
import { getAuditLogs } from "../services/api";

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    getAuditLogs(page).then((res) => {
      setLogs(res.data || []);
      setTotalPages(res.pagination?.totalPages || 0);
    }).catch(() => {});
  }, [page]);

  return (
    <div>
      <div className="page-header"><h1>Audit Log</h1></div>
      <div className="card">
        <table>
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead>
          <tbody>
            {logs.map((l: any) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(l.createdAt).toLocaleString("id-ID")}</td>
                <td>{l.userName || l.userId}</td>
                <td>{l.action}</td>
                <td>{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
