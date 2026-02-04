-- =====================================================
-- Asamblea de Simulación (Demo / Sandbox)
-- =====================================================
-- is_demo en asambleas: entorno de prueba que no consume créditos.
-- is_demo en unidades: unidades creadas por createDemoData; no editables.
-- =====================================================

-- asambleas
ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN asambleas.is_demo IS 'True = asamblea de demostración; no consume tokens ni se incluye en estadísticas globales.';

CREATE INDEX IF NOT EXISTS idx_asambleas_is_demo ON asambleas(is_demo) WHERE is_demo = true;

-- unidades (para marcar las 10 unidades de demo y bloquear su edición)
ALTER TABLE unidades
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN unidades.is_demo IS 'True = unidad creada por createDemoData; no debe modificarse ni eliminarse desde la UI.';

CREATE INDEX IF NOT EXISTS idx_unidades_is_demo ON unidades(is_demo) WHERE is_demo = true;
