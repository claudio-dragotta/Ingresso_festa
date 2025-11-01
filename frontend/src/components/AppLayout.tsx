import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import "./AppLayout.css";
import ThemeToggle from "./ThemeToggle";

const AppLayout = () => {
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " active" : ""}`;

  return (
    <div className="app-shell">
      <header className={`app-header ${!isAdmin ? "entrance-mode" : ""}`}>
        <div className="header-content">
          <div className="header-left">
            <NavLink to="/" className="brand" aria-label="Home">
              <h1>Festa 8 Novembre</h1>
            </NavLink>
            <span className={`role-badge ${!isAdmin ? "entrance" : ""}`}>
              {isAdmin ? "Admin" : "Ingresso"}
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="header-nav desktop-nav">
            <ThemeToggle />
            {isAdmin ? (
              <>
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
                <NavLink to="/expenses" className={navLinkClass}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  Spese
                </NavLink>
              </>
            ) : null}
            <NavLink to="/search" className={navLinkClass}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              Ricerca
            </NavLink>
            <NavLink to="/tshirts" className={navLinkClass}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3c-1.2 1-2.6 2-4 2s-2.8-1-4-2L4 6l2 2v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l2-2-4-3z"/>
                <path d="M9 8h6"/>
              </svg>
              Magliette
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

          {/* Mobile Menu Button */}
          <div className="mobile-nav-controls">
            <ThemeToggle />
            <button
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round"/>
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round"/>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>
        )}

        {/* Mobile Menu */}
        <nav className={`mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
          <div className="mobile-menu-header">
            <h2>Menu</h2>
            <button className="mobile-menu-close" onClick={closeMobileMenu}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="mobile-menu-links">
            {isAdmin && (
              <>
                <NavLink to="/dashboard" className={navLinkClass} onClick={closeMobileMenu}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  <span>Dashboard</span>
                </NavLink>
                <NavLink to="/users" className={navLinkClass} onClick={closeMobileMenu}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4h-8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>Utenti</span>
                </NavLink>
                <NavLink to="/expenses" className={navLinkClass} onClick={closeMobileMenu}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  <span>Spese</span>
                </NavLink>
              </>
            )}
            <NavLink to="/search" className={navLinkClass} onClick={closeMobileMenu}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <span>Ricerca</span>
            </NavLink>
            <NavLink to="/tshirts" className={navLinkClass} onClick={closeMobileMenu}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3c-1.2 1-2.6 2-4 2s-2.8-1-4-2L4 6l2 2v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l2-2-4-3z"/>
                <path d="M9 8h6"/>
              </svg>
              <span>Magliette</span>
            </NavLink>
            <button type="button" onClick={() => { handleLogout(); closeMobileMenu(); }} className="logout-button mobile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Esci</span>
            </button>
          </div>
        </nav>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;



