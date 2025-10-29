import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import SearchPage from "./pages/SearchPage";
import { useAuth } from "./context/AuthContext";

const App = () => {
  const { isAdmin, isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Admin ha accesso a entrambe le pagine */}
        <Route path="/dashboard" element={isAdmin ? <AdminDashboard /> : <Navigate to="/search" replace />} />
        <Route path="/search" element={<SearchPage />} />

        {/* Redirect basato sul ruolo */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to={isAdmin ? "/dashboard" : "/search"} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
