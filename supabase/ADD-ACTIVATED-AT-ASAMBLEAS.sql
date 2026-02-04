-- =====================================================
-- Ventana de gracia (3 días) para asambleas activas
-- =====================================================
-- activated_at: timestamp en que la asamblea pasó a estado 'activa'.
-- Durante 72 horas el administrador puede ajustar preguntas/unidades.
-- Pasado ese periodo (o al finalizar), la estructura es solo lectura.
-- =====================================================

ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

COMMENT ON COLUMN asambleas.activated_at IS 'Momento en que la asamblea se activó (estado activa). Ventana de gracia de 3 días para ajustes.';

CREATE INDEX IF NOT EXISTS idx_asambleas_activated_at ON asambleas(activated_at) WHERE activated_at IS NOT NULL;
