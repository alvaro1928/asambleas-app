-- =====================================================
-- VER VOTOS REGISTRADOS POR EMAIL
-- =====================================================

-- Reemplaza 'tu-email@aqui.com' con tu email real
-- El email debe ser el que usaste para votar

SELECT 
  v.id as voto_id,
  p.texto_pregunta,
  u.torre,
  u.numero,
  u.coeficiente,
  o.texto_opcion as opcion_votada,
  v.votante_email,
  v.es_poder,
  v.created_at,
  -- IDs importantes para debug
  v.pregunta_id,
  v.unidad_id,
  v.opcion_id
FROM votos v
INNER JOIN preguntas p ON p.id = v.pregunta_id
INNER JOIN unidades u ON u.id = v.unidad_id
INNER JOIN opciones_pregunta o ON o.id = v.opcion_id
WHERE v.votante_email = 'REEMPLAZA-CON-TU-EMAIL'
ORDER BY v.created_at DESC;

-- Si no ves resultados, intenta buscar por nombre de pregunta:
-- SELECT 
--   v.id as voto_id,
--   v.votante_email,
--   p.texto_pregunta,
--   u.torre,
--   u.numero,
--   o.texto_opcion
-- FROM votos v
-- INNER JOIN preguntas p ON p.id = v.pregunta_id
-- INNER JOIN unidades u ON u.id = v.unidad_id  
-- INNER JOIN opciones_pregunta o ON o.id = v.opcion_id
-- WHERE p.texto_pregunta LIKE '%aprueba%'
-- ORDER BY v.created_at DESC;
