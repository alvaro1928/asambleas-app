-- =====================================================
-- SCRIPT COMPLETO PARA ARREGLAR VOTACIÓN
-- =====================================================
-- Ejecuta TODO este script de una vez
-- =====================================================

-- =====================================================
-- PASO 1: Asegurar columnas en tabla votos
-- =====================================================
ALTER TABLE votos 
ADD COLUMN IF NOT EXISTS votante_email TEXT,
ADD COLUMN IF NOT EXISTS votante_nombre TEXT,
ADD COLUMN IF NOT EXISTS es_poder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS poder_id UUID REFERENCES poderes(id);

CREATE INDEX IF NOT EXISTS idx_votos_email ON votos(votante_email);
CREATE INDEX IF NOT EXISTS idx_votos_pregunta_unidad ON votos(pregunta_id, unidad_id);

-- =====================================================
-- PASO 2: Crear/actualizar tabla historial_votos
-- =====================================================
CREATE TABLE IF NOT EXISTS historial_votos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voto_id UUID REFERENCES votos(id) ON DELETE CASCADE,
  pregunta_id UUID REFERENCES preguntas(id) ON DELETE CASCADE NOT NULL,
  unidad_id UUID REFERENCES unidades(id) ON DELETE CASCADE NOT NULL,
  opcion_id UUID REFERENCES opciones_pregunta(id) ON DELETE CASCADE NOT NULL,
  votante_email TEXT NOT NULL,
  votante_nombre TEXT,
  es_poder BOOLEAN DEFAULT false,
  poder_id UUID REFERENCES poderes(id),
  accion TEXT CHECK (accion IN ('crear', 'modificar')) NOT NULL,
  opcion_anterior_id UUID REFERENCES opciones_pregunta(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_historial_pregunta ON historial_votos(pregunta_id);
CREATE INDEX IF NOT EXISTS idx_historial_unidad ON historial_votos(unidad_id);
CREATE INDEX IF NOT EXISTS idx_historial_votante ON historial_votos(votante_email);

ALTER TABLE historial_votos DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 3: Función registrar_voto_con_trazabilidad
-- =====================================================
CREATE OR REPLACE FUNCTION registrar_voto_con_trazabilidad(
  p_pregunta_id UUID,
  p_unidad_id UUID,
  p_opcion_id UUID,
  p_votante_email TEXT,
  p_votante_nombre TEXT,
  p_es_poder BOOLEAN DEFAULT false,
  p_poder_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  voto_id UUID,
  accion TEXT,
  mensaje TEXT
) AS $$
DECLARE
  v_voto_existente UUID;
  v_opcion_anterior UUID;
  v_nuevo_voto_id UUID;
  v_accion TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM preguntas WHERE id = p_pregunta_id AND estado = 'abierta') THEN
    RAISE EXCEPTION 'La pregunta no está abierta para votación';
  END IF;

  SELECT id, opcion_id INTO v_voto_existente, v_opcion_anterior
  FROM votos WHERE pregunta_id = p_pregunta_id AND unidad_id = p_unidad_id;

  IF v_voto_existente IS NOT NULL THEN
    v_accion := 'modificar';
    UPDATE votos SET 
      opcion_id = p_opcion_id,
      votante_email = p_votante_email,
      votante_nombre = p_votante_nombre,
      es_poder = p_es_poder,
      poder_id = p_poder_id
    WHERE id = v_voto_existente;
    v_nuevo_voto_id := v_voto_existente;
  ELSE
    v_accion := 'crear';
    INSERT INTO votos (pregunta_id, unidad_id, opcion_id, votante_email, votante_nombre, es_poder, poder_id)
    VALUES (p_pregunta_id, p_unidad_id, p_opcion_id, p_votante_email, p_votante_nombre, p_es_poder, p_poder_id)
    RETURNING id INTO v_nuevo_voto_id;
  END IF;

  INSERT INTO historial_votos (
    voto_id, pregunta_id, unidad_id, opcion_id,
    votante_email, votante_nombre, es_poder, poder_id,
    accion, opcion_anterior_id, ip_address, user_agent
  ) VALUES (
    v_nuevo_voto_id, p_pregunta_id, p_unidad_id, p_opcion_id,
    p_votante_email, p_votante_nombre, p_es_poder, p_poder_id,
    v_accion, v_opcion_anterior, p_ip_address, p_user_agent
  );

  RETURN QUERY SELECT 
    v_nuevo_voto_id AS voto_id,
    v_accion AS accion,
    CASE WHEN v_accion = 'crear' THEN 'Voto registrado' ELSE 'Voto actualizado' END AS mensaje;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PASO 4: Función calcular_estadisticas_pregunta
-- =====================================================
DROP FUNCTION IF EXISTS calcular_estadisticas_pregunta(UUID);

CREATE OR REPLACE FUNCTION calcular_estadisticas_pregunta(p_pregunta_id UUID)
RETURNS TABLE (
  total_votos INTEGER,
  total_coeficiente NUMERIC(12, 6),
  resultados JSONB
) AS $$
DECLARE
  v_total_votos INTEGER;
  v_total_coeficiente NUMERIC(12, 6);
  v_resultados JSONB;
BEGIN
  -- Contar votos
  SELECT COUNT(DISTINCT v.id) INTO v_total_votos
  FROM votos v WHERE v.pregunta_id = p_pregunta_id;

  -- Sumar coeficientes
  SELECT COALESCE(SUM(u.coeficiente), 0) INTO v_total_coeficiente
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id
  WHERE v.pregunta_id = p_pregunta_id;

  -- Estadísticas por opción
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'opcion_id', op.id,
      'opcion_texto', op.texto_opcion,
      'color', op.color,
      'votos_cantidad', COALESCE(stats.votos_count, 0),
      'votos_coeficiente', COALESCE(stats.votos_coeficiente, 0),
      'porcentaje_cantidad', COALESCE(
        CASE WHEN v_total_votos > 0 THEN (stats.votos_count::NUMERIC / v_total_votos * 100) ELSE 0 END, 0
      ),
      'porcentaje_coeficiente', COALESCE(
        CASE WHEN v_total_coeficiente > 0 THEN (stats.votos_coeficiente / v_total_coeficiente * 100) ELSE 0 END, 0
      )
    )
  ) INTO v_resultados
  FROM opciones_pregunta op
  LEFT JOIN (
    SELECT 
      v.opcion_id,
      COUNT(v.id)::INTEGER AS votos_count,
      SUM(u.coeficiente)::NUMERIC(12, 6) AS votos_coeficiente
    FROM votos v
    JOIN unidades u ON v.unidad_id = u.id
    WHERE v.pregunta_id = p_pregunta_id
    GROUP BY v.opcion_id
  ) stats ON stats.opcion_id = op.id
  WHERE op.pregunta_id = p_pregunta_id;

  IF v_resultados IS NULL THEN v_resultados := '[]'::JSONB; END IF;

  RETURN QUERY SELECT v_total_votos, v_total_coeficiente, v_resultados;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
SELECT 'TODO LISTO PARA VOTAR ✅' as status;

-- Ver votos registrados
SELECT 
  COUNT(*) as votos_totales,
  COUNT(DISTINCT pregunta_id) as preguntas_con_votos,
  SUM(u.coeficiente) as coeficiente_total
FROM votos v
JOIN unidades u ON u.id = v.unidad_id;
