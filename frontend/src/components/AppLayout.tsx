import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AppLayout = () => {
  const { logout } = useAuth();
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
        <h1>Ingresso Festa</h1>
        <nav>
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/scanner" className={navLinkClass}>
            Scanner
          </NavLink>
          <button type="button" onClick={handleLogout} className="logout-button">
            Esci
          </button>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
