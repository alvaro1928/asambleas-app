-- =====================================================
-- ÍNDICES RECOMENDADOS TRAS REPORTE DE SLOW QUERIES
-- =====================================================
-- Ejecutar en Supabase SQL Editor si alguno de estos
-- índices no existe aún en tu base de datos.
-- Todos usan IF NOT EXISTS para ser idempotentes.
-- =====================================================

-- Votos: usados por calcular_quorum_asamblea y calcular_estadisticas_pregunta
CREATE INDEX IF NOT EXISTS idx_votos_pregunta
  ON votos(pregunta_id);

CREATE INDEX IF NOT EXISTS idx_votos_pregunta_unidad
  ON votos(pregunta_id, unidad_id);

CREATE INDEX IF NOT EXISTS idx_votos_pregunta_opcion
  ON votos(pregunta_id, opcion_id);

-- Preguntas: listado por asamblea y quórum
CREATE INDEX IF NOT EXISTS idx_preguntas_asamblea
  ON preguntas(asamblea_id);

-- Opciones: listado por pregunta (ORDER BY orden)
-- Nota: idx_opciones_pregunta(pregunta_id) suele existir ya (AGREGAR-OPCIONES-PREGUNTA.sql)
CREATE INDEX IF NOT EXISTS idx_opciones_pregunta_orden
  ON opciones_pregunta(pregunta_id, orden);

-- Unidades: quórum por conjunto (organization_id)
CREATE INDEX IF NOT EXISTS idx_unidades_organization_id
  ON unidades(organization_id);

-- Asambleas: búsqueda por organización (p. ej. CREAR-MODULO-ASAMBLEAS.sql)
CREATE INDEX IF NOT EXISTS idx_asambleas_organization
  ON asambleas(organization_id);
