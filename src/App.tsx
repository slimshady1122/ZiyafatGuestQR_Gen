import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import MainPage from "./pages/MainPage";
import ScanPage from "./pages/ScanPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          color: "var(--text-secondary)",
        }}
      >
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Welcome page */}
      <Route path="/" element={<MainPage />} />

      {/* Doorkeeper — no login required */}
      <Route path="/scan" element={<ScanPage />} />

      {/* Admin — login required */}
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
