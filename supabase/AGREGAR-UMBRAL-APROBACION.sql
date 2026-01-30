-- =====================================================
-- Umbral de aprobación por pregunta (mayoría calificada)
-- =====================================================
-- Permite definir un % mínimo (ej. 50, 70, 100) para mostrar
-- "Aprobado" / "No aprobado" según el resultado de la votación.
-- Ejecutar en Supabase SQL Editor.
-- =====================================================

ALTER TABLE preguntas
  ADD COLUMN IF NOT EXISTS umbral_aprobacion NUMERIC(5, 2) NULL;

COMMENT ON COLUMN preguntas.umbral_aprobacion IS 'Porcentaje mínimo del coeficiente total (o nominal) para considerar la pregunta aprobada. Ej: 50 (simple), 70 (calificada), 100 (unanimidad). NULL = no mostrar etiqueta Aprobado/No aprobado.';
