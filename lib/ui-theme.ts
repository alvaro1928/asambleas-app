/** Clave única para tema claro/oscuro en panel admin y vistas relacionadas. */
export const THEME_STORAGE_KEY = "asambleas_ui_theme" as const;

/** Compatibilidad con la clave anterior de la página de acceso. */
export const LEGACY_ACCESO_THEME_KEY = "acceso_visual_theme" as const;

export const THEME_EVENT = "asambleas-ui-theme" as const;

export type UiTheme = "light" | "dark";

export function getStoredTheme(): UiTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
    const legacy = localStorage.getItem(LEGACY_ACCESO_THEME_KEY);
    if (legacy === "light" || legacy === "dark") {
      localStorage.setItem(THEME_STORAGE_KEY, legacy);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function applyTheme(theme: UiTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function persistTheme(theme: UiTheme): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(LEGACY_ACCESO_THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}
