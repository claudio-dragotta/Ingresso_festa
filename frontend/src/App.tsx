import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import SearchPage from "./pages/SearchPage";
import UsersPage from "./pages/UsersPage";
import TshirtsPage from "./pages/TshirtsPage";
import ExpensesPage from "./pages/ExpensesPage";
import ShuttlesPage from "./pages/ShuttlesPage";
import { useAuth } from "./context/AuthContext";

const App = () => {
  const { isAdmin, isAuthenticated, role } = useAuth();
  const canSeeShuttles = role === "ADMIN" || role === "ORGANIZER" || role === "SHUTTLE";

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
        {isAdmin && <Route path="/users" element={<UsersPage />} />}
        {isAdmin && <Route path="/expenses" element={<ExpensesPage />} />}
        <Route path="/search" element={<SearchPage />} />
        {canSeeShuttles && <Route path="/shuttles" element={<ShuttlesPage />} />}
        <Route path="/tshirts" element={<TshirtsPage />} />

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
