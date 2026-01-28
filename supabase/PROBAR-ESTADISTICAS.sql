-- =====================================================
-- PROBAR FUNCIÓN DE ESTADÍSTICAS
-- =====================================================

-- PASO 1: Ver tus preguntas
SELECT 
  p.id,
  p.texto_pregunta,
  p.estado,
  a.nombre as asamblea,
  COUNT(v.id) as votos
FROM preguntas p
INNER JOIN asambleas a ON a.id = p.asamblea_id
LEFT JOIN votos v ON v.pregunta_id = p.id
GROUP BY p.id, p.texto_pregunta, p.estado, a.nombre, a.created_at, p.created_at
ORDER BY a.created_at DESC, p.created_at DESC;

-- PASO 2: Copia el ID de tu pregunta del resultado anterior
-- y reemplázalo en la siguiente consulta

-- Ejecuta la función de estadísticas (reemplaza el ID)
SELECT * FROM calcular_estadisticas_pregunta('REEMPLAZA-CON-ID-DE-TU-PREGUNTA');

-- PASO 3: Si ves resultados, copia el campo "resultados" y pégalo aquí abajo
-- para ver el JSON formateado

-- Ejemplo de salida esperada:
-- total_votos: 2
-- total_coeficiente: XX.XXXX
-- coeficiente_total_conjunto: 100.000000
-- porcentaje_participacion: XX.XX
-- resultados: [{"opcion_id": "...", "votos_cantidad": 1, "porcentaje_coeficiente_total": XX.XX}]
