import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import "./LoginPage.css";

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const { currentEvent } = useEvent();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  const REMEMBER_ENABLED_KEY = "ingresso-remember-enabled";
  const REMEMBER_USERNAME_KEY = "ingresso-remember-username";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(currentEvent ? "/" : "/select-event", { replace: true });
    }
  }, [isAuthenticated, currentEvent, navigate]);

  // Prefill username if user asked to remember it
  useEffect(() => {
    try {
      const enabled = localStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
      if (enabled) {
        setRemember(true);
        const saved = localStorage.getItem(REMEMBER_USERNAME_KEY);
        if (saved) setUsername(saved);
      }
    } catch {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      setLoading(true);
      await login(username, password);
      // Persist username preference after successful login
      try {
        if (remember) {
          localStorage.setItem(REMEMBER_ENABLED_KEY, "true");
          localStorage.setItem(REMEMBER_USERNAME_KEY, username.trim());
        } else {
          localStorage.removeItem(REMEMBER_ENABLED_KEY);
          localStorage.removeItem(REMEMBER_USERNAME_KEY);
        }
      } catch {
        // ignore storage errors
      }
    } catch (err) {
      setError("Credenziali non valide. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleRememberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    setRemember(next);
    try {
      if (next) {
        localStorage.setItem(REMEMBER_ENABLED_KEY, "true");
        if (username.trim()) {
          localStorage.setItem(REMEMBER_USERNAME_KEY, username.trim());
        }
      } else {
        localStorage.removeItem(REMEMBER_ENABLED_KEY);
        localStorage.removeItem(REMEMBER_USERNAME_KEY);
      }
    } catch {
      // ignore
    }
  };


  return (
    <div className="login-page">
      <div className="login-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
                        <div className="login-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20l-3-3h6l-3 3z"/>
                <path d="M8 9a4 4 0 118 0c0 2.5-2 5-4 7-2-2-4-4.5-4-7z"/>
                <circle cx="12" cy="5" r="2"/>
              </svg>
            </div>
            <h1>Festa 8 Novembre</h1>
            <p>Sistema di Gestione Ingressi</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  id="username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Inserisci username"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <input
                  id="password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Inserisci password"
                  required
                />
              </div>
            </div>

            <div className="form-options">
              <label className="remember-toggle">
                <input type="checkbox" checked={remember} onChange={handleRememberChange} />
                <span>Ricorda username</span>
              </label>
            </div>

            {error && (
              <div className="error-message">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Accesso in corso...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Accedi
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;



