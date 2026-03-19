-- =====================================================
-- OPTIMIZACION BD: VOTACION Y ASISTENCIA
-- =====================================================
-- Script idempotente: crea indices faltantes para reducir
-- latencia en validacion de votantes, poderes, quorum y
-- estadisticas de votacion.
-- =====================================================

-- Unidades: validacion por organizacion + email/telefono
CREATE INDEX IF NOT EXISTS idx_unidades_org_email_prop_lower
  ON unidades (organization_id, lower(email_propietario));

CREATE INDEX IF NOT EXISTS idx_unidades_org_email_lower
  ON unidades (organization_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_unidades_org_telefono_prop
  ON unidades (organization_id, telefono_propietario);

CREATE INDEX IF NOT EXISTS idx_unidades_org_telefono
  ON unidades (organization_id, telefono);

-- Poderes: busqueda por asamblea/estado/apoderado y unidad otorgante
CREATE INDEX IF NOT EXISTS idx_poderes_asamblea_estado_email_receptor_lower
  ON poderes (asamblea_id, estado, lower(email_receptor));

CREATE INDEX IF NOT EXISTS idx_poderes_asamblea_estado_unidad_otorgante
  ON poderes (asamblea_id, estado, unidad_otorgante_id);

-- Preguntas: filtros por asamblea y estado (abierta/cerrada)
CREATE INDEX IF NOT EXISTS idx_preguntas_asamblea_estado
  ON preguntas (asamblea_id, estado);

-- Votos: estadisticas y validaciones por pregunta/unidad/opcion
CREATE INDEX IF NOT EXISTS idx_votos_pregunta_unidad
  ON votos (pregunta_id, unidad_id);

CREATE INDEX IF NOT EXISTS idx_votos_pregunta_opcion
  ON votos (pregunta_id, opcion_id);

-- Quorum: accesos frecuentes por asamblea/unidad y por id de asamblea
CREATE INDEX IF NOT EXISTS idx_quorum_asamblea_asamblea_unidad
  ON quorum_asamblea (asamblea_id, unidad_id);

CREATE INDEX IF NOT EXISTS idx_quorum_asamblea_asamblea_id
  ON quorum_asamblea (asamblea_id);

-- Registro de verificacion: lectura por asamblea, contexto y sesion actual
CREATE INDEX IF NOT EXISTS idx_verif_reg_asamblea_pregunta_creado
  ON verificacion_asistencia_registro (asamblea_id, pregunta_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_verif_reg_quorum_pregunta
  ON verificacion_asistencia_registro (quorum_asamblea_id, pregunta_id);

-- Sesiones de verificacion: consultas por asamblea/pregunta/cierre
CREATE INDEX IF NOT EXISTS idx_verif_sesiones_asamblea_pregunta_cierre
  ON verificacion_asamblea_sesiones (asamblea_id, pregunta_id, cierre_at DESC);

