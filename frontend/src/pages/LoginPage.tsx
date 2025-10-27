import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, from, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      setLoading(true);
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError("Credenziali non valide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ maxWidth: "480px" }}>
      <div className="card">
        <h1>Accesso Operatore</h1>
        <p>Inserisci le credenziali amministratore per accedere alla dashboard.</p>
        <form onSubmit={handleSubmit} className="grid" style={{ gap: "1rem", marginTop: "1rem" }}>
          <label className="grid" style={{ gap: "0.5rem" }}>
            <span>Username</span>
            <input
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="grid" style={{ gap: "0.5rem" }}>
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <div className="result-card error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Accesso in corso..." : "Entra"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
