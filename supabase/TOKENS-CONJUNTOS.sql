-- =====================================================
-- Añadir tokens_disponibles a la tabla conjuntos (organizations).
-- Plan Pro por asamblea: el conjunto consume 1 token al activar una asamblea Pro.
-- =====================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tokens_disponibles INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN organizations.tokens_disponibles IS 'Asambleas Pro disponibles; se descuenta 1 al activar una asamblea con más de 2 preguntas o acta detallada';
