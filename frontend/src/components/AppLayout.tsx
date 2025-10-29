import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AppLayout.css";
import ThemeToggle from "./ThemeToggle";

const AppLayout = () => {
  const { logout, isAdmin, role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? " active" : ""}`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎉 Festa 8 Novembre</h1>
            <span className="role-badge">{role === "ADMIN" ? "Admin" : "Ingresso"}</span>
          </div>

          <nav className="header-nav">
            <ThemeToggle />
            {isAdmin && (
              <NavLink to="/dashboard" className={navLinkClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
                Dashboard
              </NavLink>
            )}

            {isAdmin && (
              <NavLink to="/users" className={navLinkClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4h-8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Utenti
              </NavLink>
            )}

            <NavLink to="/search" className={navLinkClass}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              Ricerca
            </NavLink>

            <button type="button" onClick={handleLogout} className="logout-button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Esci
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;

