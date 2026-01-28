-- =====================================================
-- SCRIPT RÁPIDO PARA ABRIR UNA PREGUNTA
-- =====================================================

-- PASO 1: Ver todas las preguntas disponibles
SELECT 
  p.id,
  a.nombre as asamblea,
  p.texto_pregunta,
  p.estado,
  COUNT(o.id) as num_opciones
FROM preguntas p
INNER JOIN asambleas a ON a.id = p.asamblea_id
LEFT JOIN opciones_pregunta o ON o.pregunta_id = p.id
GROUP BY p.id, a.nombre, p.texto_pregunta, p.estado
ORDER BY a.created_at DESC, p.created_at DESC;

-- =====================================================
-- PASO 2: Abrir una pregunta específica
-- =====================================================
-- Copia el ID de la pregunta que quieres abrir del resultado anterior
-- y reemplaza 'PREGUNTA-ID-AQUI' con ese ID

-- UPDATE preguntas
-- SET estado = 'abierta'
-- WHERE id = 'PREGUNTA-ID-AQUI';

-- =====================================================
-- PASO 3: Verificar que se abrió correctamente
-- =====================================================
-- SELECT 
--   texto_pregunta,
--   estado
-- FROM preguntas
-- WHERE id = 'PREGUNTA-ID-AQUI';
