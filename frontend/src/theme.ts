export type Theme = "light" | "dark";

const STORAGE_KEY = "ingresso-festa-theme";

export const getStoredTheme = (): Theme | null => {
  const t = localStorage.getItem(STORAGE_KEY);
  return t === "light" || t === "dark" ? t : null;
};

export const getPreferredTheme = (): Theme => {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
};

export const getInitialTheme = (): Theme => getStoredTheme() ?? getPreferredTheme();

export const applyTheme = (theme: Theme) => {
  document.documentElement.setAttribute("data-theme", theme);
};

export const setTheme = (theme: Theme) => {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
};

export const toggleTheme = () => {
  const current = (document.documentElement.getAttribute("data-theme") as Theme) || getInitialTheme();
  const next: Theme = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
};

