-- =====================================================
-- OPCIONAL: varios poderes ACTIVOS desde la misma unidad otorgante
-- (distintos apoderados / email_receptor)
-- =====================================================
-- La versión anterior solo permitía un poder activo por
-- (asamblea_id, unidad_otorgante_id). Si necesitas que una misma
-- unidad delegue a varias personas a la vez, ejecuta esto en SQL Editor.
--
-- Tras ejecutar, dos poderes activos no pueden repetir el mismo
-- (asamblea, unidad otorgante, email del apoderado normalizado).
-- =====================================================

DROP INDEX IF EXISTS poderes_activo_por_unidad_asamblea;

CREATE UNIQUE INDEX IF NOT EXISTS poderes_activo_otorgante_email_receptor
ON public.poderes (
  asamblea_id,
  unidad_otorgante_id,
  lower(trim(email_receptor))
)
WHERE estado = 'activo';

COMMENT ON INDEX poderes_activo_otorgante_email_receptor IS
  'Una misma unidad puede tener varios poderes activos si el apoderado (email) es distinto.';
