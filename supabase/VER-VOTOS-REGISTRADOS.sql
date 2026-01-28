-- =====================================================
-- VER VOTOS REGISTRADOS Y ESTADÍSTICAS
-- =====================================================

-- 1. Ver todos los votos registrados
SELECT 
  v.id,
  p.texto_pregunta,
  u.torre,
  u.numero,
  u.coeficiente,
  o.texto_opcion as opcion_votada,
  v.votante_email,
  v.created_at
FROM votos v
INNER JOIN preguntas p ON p.id = v.pregunta_id
INNER JOIN unidades u ON u.id = v.unidad_id
INNER JOIN opciones_pregunta o ON o.id = v.opcion_id
ORDER BY v.created_at DESC;

-- 2. Resumen por pregunta
SELECT 
  p.texto_pregunta,
  COUNT(v.id) as total_votos,
  SUM(u.coeficiente) as suma_coeficientes
FROM preguntas p
LEFT JOIN votos v ON v.pregunta_id = p.id
LEFT JOIN unidades u ON u.id = v.unidad_id
GROUP BY p.id, p.texto_pregunta
ORDER BY p.created_at DESC;

-- 3. Votos por opción
SELECT 
  p.texto_pregunta,
  o.texto_opcion,
  COUNT(v.id) as votos,
  SUM(u.coeficiente) as coeficiente_total
FROM opciones_pregunta o
INNER JOIN preguntas p ON p.id = o.pregunta_id
LEFT JOIN votos v ON v.opcion_id = o.id
LEFT JOIN unidades u ON u.id = v.unidad_id
GROUP BY p.id, p.texto_pregunta, o.id, o.texto_opcion, o.orden
ORDER BY p.texto_pregunta, o.orden;
