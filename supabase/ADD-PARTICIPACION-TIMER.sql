-- =====================================================
-- CRONOMETRO INDICADOR DE PARTICIPACION (tiempo de intervención)
-- =====================================================
-- Reglas:
-- - No cierra preguntas ni afecta lógica de votación.
-- - Fuente de verdad en DB: end_at (activo/inactivo) y default_minutes por asamblea.

-- 1) Estado activo del ciclo (si NULL => inactivo)
ALTER TABLE asambleas
ADD COLUMN IF NOT EXISTS participacion_timer_end_at TIMESTAMPTZ NULL;

-- 2) Minutos por defecto a mostrar cuando el timer está inactivo
ALTER TABLE asambleas
ADD COLUMN IF NOT EXISTS participacion_timer_default_minutes INTEGER NOT NULL DEFAULT 5;

