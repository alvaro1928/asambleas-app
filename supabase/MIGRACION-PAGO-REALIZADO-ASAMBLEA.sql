-- =====================================================
-- Cobro único por asamblea (Opción A)
-- Añade pago_realizado a asambleas. Una vez true, no se vuelve a cobrar.
-- =====================================================

ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS pago_realizado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN asambleas.pago_realizado IS 'True cuando ya se cobró esta asamblea (una sola vez: Activar Votación o Generar Acta). No se vuelve a descontar.';

CREATE INDEX IF NOT EXISTS idx_asambleas_pago_realizado ON asambleas(pago_realizado) WHERE pago_realizado = true;
