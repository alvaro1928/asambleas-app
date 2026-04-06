-- ============================================================
-- Días de ventana de gracia tras activar asamblea (antes: 3 fijos).
-- Por defecto 5; editable en Super Admin → Ajustes globales.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE configuracion_global
  ADD COLUMN IF NOT EXISTS ventana_gracia_activacion_dias INTEGER NOT NULL DEFAULT 5;

COMMENT ON COLUMN configuracion_global.ventana_gracia_activacion_dias IS
  'Tras activar una asamblea, el gestor puede editar estructura durante estos días; luego pasa a solo lectura o cierre automático.';

UPDATE configuracion_global
SET ventana_gracia_activacion_dias = 5
WHERE key = 'landing' AND (ventana_gracia_activacion_dias IS NULL OR ventana_gracia_activacion_dias < 1);
