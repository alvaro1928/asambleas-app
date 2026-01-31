-- =====================================================
-- Límites parametrizables por plan (planes)
-- =====================================================
-- Ejecutar después de PLANES-TABLA-Y-SEED.sql.
-- Añade columnas para que la lógica use estos valores
-- (max preguntas por asamblea, acta detallada, etc.).
-- =====================================================

-- Límite de preguntas por asamblea (plan Free suele ser 2; Pro/Pilot ilimitado o alto)
ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS max_preguntas_por_asamblea INTEGER NOT NULL DEFAULT 2;

-- Si el plan incluye acta con auditoría detallada (descarga e historial de votos)
ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS incluye_acta_detallada BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN planes.max_preguntas_por_asamblea IS 'Máximo de preguntas de votación por asamblea; la app aplica este límite.';
COMMENT ON COLUMN planes.incluye_acta_detallada IS 'Si true, el plan permite descargar acta con auditoría detallada (quién votó, cuándo, IP, etc.).';

-- Valores por defecto según plan
UPDATE planes SET max_preguntas_por_asamblea = 2,  incluye_acta_detallada = false WHERE key = 'free';
UPDATE planes SET max_preguntas_por_asamblea = 999, incluye_acta_detallada = true  WHERE key = 'pro';
UPDATE planes SET max_preguntas_por_asamblea = 999, incluye_acta_detallada = true  WHERE key = 'pilot';
