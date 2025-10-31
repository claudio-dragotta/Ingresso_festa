import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AppLayout.css";
import ThemeToggle from "./ThemeToggle";

const AppLayout = () => {
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " active" : ""}`;

  return (
    <div className="app-shell">
      <header className={`app-header ${!isAdmin ? "entrance-mode" : ""}`}>
        <div className="header-content">
          {isAdmin ? (
            <>
              <div className="header-left">
                <NavLink to="/" className="brand" aria-label="Home">
                  <span className="brand-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 20l4-10"/>
                      <path d="M10 20l4-10"/>
                      <path d="M16 20l4-10"/>
                      <path d="M3 7h18"/>
                      <path d="M6 3l1 4"/>
                      <path d="M17 3l1 4"/>
                    </svg>
                  </span>
                  <h1>Festa 8 Novembre</h1>
                </NavLink>
                <span className="role-badge">Admin</span>
              </div>

              <nav className="header-nav">
                <ThemeToggle />
                <NavLink to="/dashboard" className={navLinkClass}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  Dashboard
                </NavLink>
                <NavLink to="/users" className={navLinkClass}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4h-8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Utenti
                </NavLink>
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
            </>
          ) : (
            <div className="entrance-header">
              <h1>Festa 8 Novembre</h1>
              <div className="entrance-actions">
                <ThemeToggle />
                <button type="button" onClick={handleLogout} className="logout-button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Esci
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;



