import { Routes, Route, Navigate } from "react-router-dom";
import { getCurrentUser } from "./services/api";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import AuditLog from "./pages/AuditLog";
import ResumeRalan from "./pages/ResumeRalan";
import ResumeRanap from "./pages/ResumeRanap";
import LaporanOperasi from "./pages/LaporanOperasi";
import LaporanResume from "./pages/LaporanResume";
import GantiPassword from "./pages/GantiPassword";
import Profile from "./pages/Profile";

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route
          path="resume-ralan"
          element={<ProtectedRoute roles={["doctor"]}><ResumeRalan /></ProtectedRoute>}
        />
        <Route
          path="resume-ranap"
          element={<ProtectedRoute roles={["doctor"]}><ResumeRanap /></ProtectedRoute>}
        />
        <Route
          path="laporan-operasi/*"
          element={<ProtectedRoute roles={["doctor"]}><LaporanOperasi /></ProtectedRoute>}
        />
        <Route
          path="laporan-resume"
          element={<ProtectedRoute roles={["doctor"]}><LaporanResume /></ProtectedRoute>}
        />
        <Route
          path="ganti-password"
          element={<ProtectedRoute><GantiPassword /></ProtectedRoute>}
        />
        <Route
          path="users"
          element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>}
        />
        <Route
          path="audit-logs"
          element={<ProtectedRoute roles={["admin"]}><AuditLog /></ProtectedRoute>}
        />
      </Route>
    </Routes>
  );
}
