import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import EventPickerPage from "./pages/EventPickerPage";
import AdminDashboard from "./pages/AdminDashboard";
import SearchPage from "./pages/SearchPage";
import UsersPage from "./pages/UsersPage";
import TshirtsPage from "./pages/TshirtsPage";
import ExpensesPage from "./pages/ExpensesPage";
import ShuttlesPage from "./pages/ShuttlesPage";
import QrScanPage from "./pages/QrScanPage";
import PreRegistrationsPage from "./pages/PreRegistrationsPage";
import { useAuth } from "./context/AuthContext";
import { useEvent } from "./context/EventContext";

const EventGuard = ({ children }: { children: React.ReactNode }) => {
  const { currentEvent } = useEvent();
  if (!currentEvent) {
    return <Navigate to="/select-event" replace />;
  }
  return <>{children}</>;
};

const App = () => {
  const { isAdmin, isAuthenticated, role } = useAuth();
  const { currentEvent } = useEvent();
  const location = useLocation();
  const canSeeShuttles = role === "ADMIN" || role === "ORGANIZER" || role === "SHUTTLE";
  const canSeeDashboard = role === "ADMIN" || role === "ORGANIZER";
  const canScan = role === "ADMIN" || role === "ORGANIZER" || role === "ENTRANCE";
  const isShuttle = role === "SHUTTLE";

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/select-event"
        element={
          <ProtectedRoute>
            <EventPickerPage />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <EventGuard>
              <AppLayout />
            </EventGuard>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={canSeeDashboard ? <AdminDashboard /> : <Navigate to="/search" replace />} />
        {isAdmin && <Route path="/users" element={<UsersPage />} />}
        {isAdmin && <Route path="/expenses" element={<ExpensesPage />} />}
        {!isShuttle && <Route path="/search" element={<SearchPage />} />}
        {canSeeShuttles && <Route path="/shuttles" element={<ShuttlesPage />} />}
        {!isShuttle && <Route path="/tshirts" element={<TshirtsPage />} />}
        {canScan && <Route path="/scan" element={<QrScanPage />} />}
        {canSeeDashboard && <Route path="/pre-registrations" element={<PreRegistrationsPage />} />}

        <Route
          path="/"
          element={
            isAuthenticated ? (
              currentEvent ? (
                <Navigate to={
                  isAdmin || role === "ORGANIZER" ? "/dashboard" :
                  role === "SHUTTLE" ? "/shuttles" :
                  role === "ENTRANCE" ? "/scan" :
                  "/search"
                } replace />
              ) : (
                <Navigate to="/select-event" replace />
              )
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
