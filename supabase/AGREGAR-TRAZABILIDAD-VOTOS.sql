-- =====================================================
-- TRAZABILIDAD Y AUDITORÍA DE VOTOS (LEY 675)
-- =====================================================
-- Cumple con los requisitos legales de registro y 
-- transparencia en votaciones de propiedad horizontal
-- =====================================================

-- =====================================================
-- TABLA: historial_votos
-- =====================================================
-- Registra TODOS los votos (incluyendo cambios)
-- para cumplir con trazabilidad y auditoría
CREATE TABLE IF NOT EXISTS historial_votos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voto_id UUID REFERENCES votos(id) ON DELETE CASCADE, -- NULL si es el primer voto
  pregunta_id UUID REFERENCES preguntas(id) ON DELETE CASCADE NOT NULL,
  unidad_id UUID REFERENCES unidades(id) ON DELETE CASCADE NOT NULL,
  opcion_id UUID REFERENCES opciones_pregunta(id) ON DELETE CASCADE NOT NULL,
  votante_email TEXT NOT NULL,
  votante_nombre TEXT,
  es_poder BOOLEAN DEFAULT false,
  poder_id UUID REFERENCES poderes(id),
  accion TEXT CHECK (accion IN ('crear', 'modificar')) NOT NULL, -- Tipo de acción
  opcion_anterior_id UUID REFERENCES opciones_pregunta(id), -- Opción anterior (si modificó)
  ip_address TEXT, -- IP del votante (opcional para auditoría)
  user_agent TEXT, -- Navegador/dispositivo (opcional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_historial_pregunta ON historial_votos(pregunta_id);
CREATE INDEX IF NOT EXISTS idx_historial_unidad ON historial_votos(unidad_id);
CREATE INDEX IF NOT EXISTS idx_historial_votante ON historial_votos(votante_email);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_votos(created_at);

COMMENT ON TABLE historial_votos IS 'Registro completo de todos los votos y modificaciones (trazabilidad Ley 675)';
COMMENT ON COLUMN historial_votos.accion IS 'crear: primer voto | modificar: cambió su voto';
COMMENT ON COLUMN historial_votos.opcion_anterior_id IS 'Opción que tenía antes (solo para modificaciones)';

-- Deshabilitar RLS
ALTER TABLE historial_votos DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNCIÓN: Registrar voto con trazabilidad
-- =====================================================
-- Registra un voto (nuevo o modificación) con historial completo
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
  -- Verificar si la pregunta está abierta
  IF NOT EXISTS (
    SELECT 1 FROM preguntas 
    WHERE id = p_pregunta_id AND estado = 'abierta'
  ) THEN
    RAISE EXCEPTION 'La pregunta no está abierta para votación';
  END IF;

  -- Verificar si ya votó
  SELECT id, opcion_id INTO v_voto_existente, v_opcion_anterior
  FROM votos
  WHERE pregunta_id = p_pregunta_id
    AND unidad_id = p_unidad_id;

  IF v_voto_existente IS NOT NULL THEN
    -- Ya votó, actualizar (modificación)
    v_accion := 'modificar';
    
    UPDATE votos
    SET 
      opcion_id = p_opcion_id,
      votante_email = p_votante_email,
      votante_nombre = p_votante_nombre,
      es_poder = p_es_poder,
      poder_id = p_poder_id
    WHERE id = v_voto_existente;
    
    v_nuevo_voto_id := v_voto_existente;
  ELSE
    -- Primera vez que vota (creación)
    v_accion := 'crear';
    
    INSERT INTO votos (
      pregunta_id, unidad_id, opcion_id, 
      votante_email, votante_nombre, es_poder, poder_id
    )
    VALUES (
      p_pregunta_id, p_unidad_id, p_opcion_id,
      p_votante_email, p_votante_nombre, p_es_poder, p_poder_id
    )
    RETURNING id INTO v_nuevo_voto_id;
  END IF;

  -- Registrar en historial (SIEMPRE, para trazabilidad)
  INSERT INTO historial_votos (
    voto_id, pregunta_id, unidad_id, opcion_id,
    votante_email, votante_nombre, es_poder, poder_id,
    accion, opcion_anterior_id, ip_address, user_agent
  )
  VALUES (
    v_nuevo_voto_id, p_pregunta_id, p_unidad_id, p_opcion_id,
    p_votante_email, p_votante_nombre, p_es_poder, p_poder_id,
    v_accion, v_opcion_anterior, p_ip_address, p_user_agent
  );

  -- Retornar resultado
  RETURN QUERY
  SELECT 
    v_nuevo_voto_id AS voto_id,
    v_accion AS accion,
    CASE 
      WHEN v_accion = 'crear' THEN 'Voto registrado exitosamente'
      ELSE 'Voto actualizado exitosamente'
    END AS mensaje;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_voto_con_trazabilidad IS 'Registra o modifica un voto con trazabilidad completa (Ley 675)';

-- =====================================================
-- FUNCIÓN: Obtener votos de un votante
-- =====================================================
-- Permite al votante ver sus propios votos
CREATE OR REPLACE FUNCTION obtener_votos_votante(
  p_pregunta_id UUID,
  p_votante_email TEXT
)
RETURNS TABLE (
  unidad_id UUID,
  unidad_numero TEXT,
  unidad_torre TEXT,
  opcion_id UUID,
  texto_opcion TEXT,
  color_opcion TEXT,
  es_poder BOOLEAN,
  fecha_voto TIMESTAMP WITH TIME ZONE,
  puede_modificar BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.unidad_id,
    u.numero AS unidad_numero,
    u.torre AS unidad_torre,
    v.opcion_id,
    op.texto_opcion,
    op.color AS color_opcion,
    v.es_poder,
    v.created_at AS fecha_voto,
    (p.estado = 'abierta') AS puede_modificar
  FROM votos v
  JOIN unidades u ON v.unidad_id = u.id
  JOIN opciones_pregunta op ON v.opcion_id = op.id
  JOIN preguntas p ON v.pregunta_id = p.id
  WHERE v.pregunta_id = p_pregunta_id
    AND v.votante_email = p_votante_email
  ORDER BY u.torre, u.numero;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION obtener_votos_votante IS 'Obtiene todos los votos de un votante (incluyendo poderes)';

-- =====================================================
-- FUNCIÓN: Reporte de auditoría de votación
-- =====================================================
-- Genera reporte completo para auditoría (solo admin)
CREATE OR REPLACE FUNCTION reporte_auditoria_pregunta(p_pregunta_id UUID)
RETURNS TABLE (
  votante_email TEXT,
  votante_nombre TEXT,
  unidad_torre TEXT,
  unidad_numero TEXT,
  opcion_seleccionada TEXT,
  es_poder BOOLEAN,
  accion TEXT,
  opcion_anterior TEXT,
  fecha_accion TIMESTAMP WITH TIME ZONE,
  ip_address TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.votante_email,
    h.votante_nombre,
    u.torre AS unidad_torre,
    u.numero AS unidad_numero,
    op.texto_opcion AS opcion_seleccionada,
    h.es_poder,
    h.accion,
    op_ant.texto_opcion AS opcion_anterior,
    h.created_at AS fecha_accion,
    h.ip_address
  FROM historial_votos h
  JOIN unidades u ON h.unidad_id = u.id
  JOIN opciones_pregunta op ON h.opcion_id = op.id
  LEFT JOIN opciones_pregunta op_ant ON h.opcion_anterior_id = op_ant.id
  WHERE h.pregunta_id = p_pregunta_id
  ORDER BY h.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reporte_auditoria_pregunta IS 'Reporte completo de auditoría de votación (historial completo)';

-- =====================================================
-- VISTA: Resumen de participación por votante
-- =====================================================
CREATE OR REPLACE VIEW vista_participacion_votantes AS
SELECT 
  p.id AS pregunta_id,
  p.texto_pregunta,
  v.votante_email,
  v.votante_nombre,
  COUNT(v.id) AS unidades_votadas,
  SUM(u.coeficiente) AS coeficiente_total_votado,
  SUM(CASE WHEN v.es_poder THEN 1 ELSE 0 END) AS votos_con_poder,
  MIN(v.created_at) AS primer_voto,
  MAX(v.created_at) AS ultimo_voto
FROM votos v
JOIN preguntas p ON v.pregunta_id = p.id
JOIN unidades u ON v.unidad_id = u.id
GROUP BY p.id, p.texto_pregunta, v.votante_email, v.votante_nombre;

COMMENT ON VIEW vista_participacion_votantes IS 'Resumen de participación por votante (cuántas unidades votó)';

-- =====================================================
-- ÍNDICE: Mejorar rendimiento de consultas de votante
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_votos_votante_pregunta ON votos(votante_email, pregunta_id);
CREATE INDEX IF NOT EXISTS idx_votos_pregunta_opcion ON votos(pregunta_id, opcion_id);
