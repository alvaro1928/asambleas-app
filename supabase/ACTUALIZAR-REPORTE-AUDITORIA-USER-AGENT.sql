-- Añade user_agent al reporte de auditoría (dispositivo/navegador del votante)
-- Hay que borrar la función antes porque no se puede cambiar el tipo de retorno.
DROP FUNCTION IF EXISTS reporte_auditoria_pregunta(uuid);

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
  ip_address TEXT,
  user_agent TEXT
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
    h.ip_address,
    h.user_agent
  FROM historial_votos h
  JOIN unidades u ON h.unidad_id = u.id
  JOIN opciones_pregunta op ON h.opcion_id = op.id
  LEFT JOIN opciones_pregunta op_ant ON h.opcion_anterior_id = op_ant.id
  WHERE h.pregunta_id = p_pregunta_id
  ORDER BY h.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reporte_auditoria_pregunta IS 'Reporte de auditoría: quién votó, cuándo, IP y dispositivo (user_agent)';
