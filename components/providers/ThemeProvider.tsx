"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  THEME_EVENT,
  applyTheme,
  getStoredTheme,
  persistTheme,
  type UiTheme,
} from "@/lib/ui-theme";

interface ThemeContextValue {
  theme: UiTheme;
  setTheme: (t: UiTheme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<UiTheme>("light");

  useEffect(() => {
    const stored = getStoredTheme();
    const resolved: UiTheme =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setThemeState(resolved);
    applyTheme(resolved);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "asambleas_ui_theme" || !e.newValue) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    };
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent<UiTheme>;
      if (ce.detail === "light" || ce.detail === "dark") {
        setThemeState(ce.detail);
        applyTheme(ce.detail);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, onCustom as EventListener);
    };
  }, []);

  const setTheme = useCallback((t: UiTheme) => {
    setThemeState(t);
    persistTheme(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: UiTheme = prev === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme debe usarse dentro de ThemeProvider");
  }
  return ctx;
}
