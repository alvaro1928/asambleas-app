"use client";

import { Moon, Sun } from "lucide-react";
import { useAppTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

interface AdminThemeToggleProps {
  /** Muestra texto "Modo claro / Modo oscuro" (p. ej. página de acceso). */
  showLabel?: boolean;
  className?: string;
  /** Título accesible / tooltip */
  title?: string;
}

export function AdminThemeToggle({
  showLabel = false,
  className,
  title,
}: AdminThemeToggleProps) {
  const { theme, toggle } = useAppTheme();
  const isDark = theme === "dark";
  const defaultTitle = isDark
    ? "Cambiar a modo claro (recomendado para lectura diurna)"
    : "Cambiar a modo oscuro (recomendado para proyección o salas con poca luz)";

  return (
    <button
      type="button"
      onClick={toggle}
      title={title ?? defaultTitle}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-3xl border px-3 py-2 text-sm font-medium transition-colors shrink-0",
        "border-slate-200 bg-white/90 text-slate-800 hover:bg-slate-50",
        "dark:border-white/20 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800/80",
        showLabel ? "min-w-0" : "p-2",
        className,
      )}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Moon className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {showLabel && (
        <span className="hidden sm:inline">
          {isDark ? "Modo claro" : "Modo oscuro"}
        </span>
      )}
    </button>
  );
}
