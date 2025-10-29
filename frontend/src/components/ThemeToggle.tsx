import { useEffect, useState } from "react";
import { applyTheme, getInitialTheme, toggleTheme, type Theme } from "../theme";

const ThemeToggle = () => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme());

  useEffect(() => {
    // Apply on mount (in case index.html didn’t run yet or SSR)
    applyTheme(theme);
  }, []);

  const handleClick = () => {
    const next = toggleTheme();
    setThemeState(next);
  };

  const switchTo = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={handleClick}
      className="theme-toggle"
      aria-label={`Attiva tema ${switchTo}`}
      title={`Tema: ${theme === "dark" ? "Scuro" : "Chiaro"}`}
    >
      {theme === "dark" ? (
        // Sun icon
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon icon
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
      <span className="theme-toggle-label">{theme === "dark" ? "Chiaro" : "Scuro"}</span>
    </button>
  );
};

export default ThemeToggle;
