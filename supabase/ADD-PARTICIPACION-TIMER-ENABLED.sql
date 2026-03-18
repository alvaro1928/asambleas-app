-- =====================================================
-- CRONOMETRO INDICADOR: HABILITAR/DESHABILITAR (UX + seguridad)
-- =====================================================
-- Por defecto, el cronómetro está habilitado en todas las asambleas.
-- Si se deshabilita, el cronómetro no debe aparecer ni poder activarse.

ALTER TABLE asambleas
ADD COLUMN IF NOT EXISTS participacion_timer_enabled BOOLEAN NOT NULL DEFAULT true;

-- Recomendación: al deshabilitar, limpiar el end_at para no dejar ciclos colgados.
-- (Si el usuario ya deshabilitó desde UI, esta regla no es necesaria; pero ayuda ante inconsistencias.)
UPDATE asambleas
SET participacion_timer_end_at = NULL
WHERE participacion_timer_enabled = false;

