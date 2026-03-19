import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { useState, useEffect } from "react";
import "./AppLayout.css";
import ThemeToggle from "./ThemeToggle";
import ToastContainer from "./Toast";

const AppLayout = () => {
  const { logout, isAdmin, role } = useAuth();
  const { currentEvent, clearEvent, hasModule } = useEvent();
  const showShuttles = (role === "ADMIN" || role === "ORGANIZER" || role === "SHUTTLE") && hasModule("shuttles");
  const canScan = role === "ADMIN" || role === "ORGANIZER" || role === "ENTRANCE";
  const isShuttle = role === "SHUTTLE";
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const canSeeDashboard = isAdmin || role === "ORGANIZER";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleChangeEvent = () => {
    clearEvent();
    navigate("/select-event", { replace: true });
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? " active" : ""}`;

  const eventName = currentEvent?.name ?? "Evento";

  return (
    <div className="app-shell">
      <header className={`app-header${!isAdmin ? " entrance-mode" : ""}${scrolled ? " scrolled" : ""}`}>
        <div className="header-content">
          <div className="header-left">
            <NavLink to="/" className="brand" aria-label="Home">
              <h1>{eventName}</h1>
            </NavLink>
            <span className={`role-badge ${isAdmin ? "admin" : (role ?? "").toLowerCase()}`}>
              {role === "ADMIN" ? "Admin" : role === "ORGANIZER" ? "Organizzatore" : role === "SHUTTLE" ? "Navetta" : "Ingresso"}
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="header-nav desktop-nav">
            <ThemeToggle />
            {canSeeDashboard && (
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
              <>
                <NavLink to="/users" className={navLinkClass}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4h-8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Utenti
                </NavLink>
                {hasModule("expenses") && (
                  <NavLink to="/expenses" className={navLinkClass}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    Spese
                  </NavLink>
                )}
              </>
            )}
            {!isShuttle && (
              <NavLink to="/search" className={navLinkClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                Ricerca
              </NavLink>
            )}
            {canScan && (
              <NavLink to="/scan" className={navLinkClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                  <rect x="7" y="7" width="4" height="4" rx="0.5"/>
                  <rect x="13" y="7" width="4" height="4" rx="0.5"/>
                  <rect x="7" y="13" width="4" height="4" rx="0.5"/>
                  <rect x="13" y="13" width="4" height="4" rx="0.5"/>
                </svg>
                Scanner QR
              </NavLink>
            )}
            {canSeeDashboard && (
              <NavLink to="/pre-registrations" className={navLinkClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
                Pre-registrazioni
              </NavLink>
            )}
            {showShuttles && (
              <NavLink to="/shuttles" className={navLinkClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 13h18M5 6h14a2 2 0 0 1 2 2v10H3V8a2 2 0 0 1 2-2Z"/>
                  <path d="M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                </svg>
                Navette
              </NavLink>
            )}
            {!isShuttle && hasModule("tshirts") && (
              <NavLink to="/tshirts" className={navLinkClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 3c-1.2 1-2.6 2-4 2s-2.8-1-4-2L4 6l2 2v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l2-2-4-3z"/>
                  <path d="M9 8h6"/>
                </svg>
                Magliette
              </NavLink>
            )}
            <button type="button" onClick={handleChangeEvent} className="nav-link change-event-button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              Cambia
            </button>
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
            {canSeeDashboard && (
              <NavLink to="/dashboard" className={navLinkClass} onClick={closeMobileMenu}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  <span>Dashboard</span>
                </NavLink>
            )}
            {isAdmin && (
              <>
                <NavLink to="/users" className={navLinkClass} onClick={closeMobileMenu}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4h-8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>Utenti</span>
                </NavLink>
                {hasModule("expenses") && (
                  <NavLink to="/expenses" className={navLinkClass} onClick={closeMobileMenu}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    <span>Spese</span>
                  </NavLink>
                )}
              </>
            )}
            {showShuttles && (
              <NavLink to="/shuttles" className={navLinkClass} onClick={closeMobileMenu}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 13h18M5 6h14a2 2 0 0 1 2 2v10H3V8a2 2 0 0 1 2-2Z"/>
                  <path d="M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>
                </svg>
                <span>Navette</span>
              </NavLink>
            )}
            {!isShuttle && (
              <NavLink to="/search" className={navLinkClass} onClick={closeMobileMenu}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <span>Ricerca</span>
              </NavLink>
            )}
            {canScan && (
              <NavLink to="/scan" className={navLinkClass} onClick={closeMobileMenu}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                  <rect x="7" y="7" width="4" height="4" rx="0.5"/>
                  <rect x="13" y="7" width="4" height="4" rx="0.5"/>
                  <rect x="7" y="13" width="4" height="4" rx="0.5"/>
                  <rect x="13" y="13" width="4" height="4" rx="0.5"/>
                </svg>
                <span>Scanner QR</span>
              </NavLink>
            )}
            {canSeeDashboard && (
              <NavLink to="/pre-registrations" className={navLinkClass} onClick={closeMobileMenu}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
                <span>Pre-registrazioni</span>
              </NavLink>
            )}
            {!isShuttle && hasModule("tshirts") && (
              <NavLink to="/tshirts" className={navLinkClass} onClick={closeMobileMenu}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 3c-1.2 1-2.6 2-4 2s-2.8-1-4-2L4 6l2 2v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8l2-2-4-3z"/>
                  <path d="M9 8h6"/>
                </svg>
                <span>Magliette</span>
              </NavLink>
            )}
            <button
              type="button"
              onClick={() => { handleChangeEvent(); closeMobileMenu(); }}
              className="nav-link change-event-button mobile"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
              <span>Cambia festa</span>
            </button>
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
      <ToastContainer />
    </div>
  );
};

export default AppLayout;
