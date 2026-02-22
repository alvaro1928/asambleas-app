'use client'

/**
 * Banner fijo que se muestra en todas las vistas de una asamblea cuando is_demo es true.
 * Deja claro que es un entorno de pruebas y que los resultados son simulados.
 */
export function StickyBanner() {
  return (
    <div
      role="alert"
      className="sticky top-0 z-20 w-full bg-amber-500/90 dark:bg-amber-600/90 text-amber-950 dark:text-amber-100 px-4 py-2 text-center text-sm font-medium shadow-md print:hidden"
    >
      Entorno de pruebas: estás viendo una asamblea de demostración. Los resultados aquí mostrados son simulados y no tienen validez legal.
    </div>
  )
}
