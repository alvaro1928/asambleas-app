-- =====================================================
-- DEBUG: VERIFICAR SI LOS VOTOS SE ESTÁN GUARDANDO
-- =====================================================

-- 1. Ver si existen votos en la tabla
SELECT 
  'Votos en BD' as tipo,
  COUNT(*) as total
FROM votos;

-- 2. Ver todos los votos con detalles
SELECT 
  v.id,
  v.pregunta_id,
  v.unidad_id,
  v.opcion_id,
  v.votante_email,
  v.votante_nombre,
  v.es_poder,
  v.created_at,
  p.texto_pregunta,
  u.torre,
  u.numero,
  o.texto_opcion
FROM votos v
LEFT JOIN preguntas p ON p.id = v.pregunta_id
LEFT JOIN unidades u ON u.id = v.unidad_id
LEFT JOIN opciones_pregunta o ON o.id = v.opcion_id
ORDER BY v.created_at DESC
LIMIT 20;

-- 3. Ver columnas de la tabla votos
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'votos'
ORDER BY ordinal_position;

-- 4. Verificar que la función existe
SELECT 
  proname as funcion,
  pronargs as num_parametros
FROM pg_proc
WHERE proname = 'registrar_voto_con_trazabilidad';

-- 5. Probar la función manualmente (comentado - descomenta y ajusta los IDs)
-- SELECT * FROM registrar_voto_con_trazabilidad(
--   'PREGUNTA-ID'::UUID,
--   'UNIDAD-ID'::UUID,
--   'OPCION-ID'::UUID,
--   'test@email.com',
--   'Test Votante',
--   false,
--   NULL,
--   NULL,
--   NULL
-- );

-- 6. Ver historial de votos
SELECT 
  'Historial de votos' as tipo,
  COUNT(*) as total
FROM historial_votos;

SELECT * FROM historial_votos ORDER BY created_at DESC LIMIT 10;
