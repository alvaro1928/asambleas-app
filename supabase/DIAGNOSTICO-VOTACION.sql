-- =====================================================
-- DIAGNÓSTICO COMPLETO DEL SISTEMA DE VOTACIÓN
-- =====================================================

-- 1. Verificar que las funciones RPC existen
SELECT 
  proname as nombre_funcion,
  pronargs as num_argumentos
FROM pg_proc
WHERE proname IN (
  'calcular_estadisticas_pregunta',
  'registrar_voto_con_trazabilidad',
  'validar_codigo_acceso',
  'validar_votante_asamblea'
)
ORDER BY proname;

-- 2. Ver todas las asambleas y su configuración
SELECT 
  id,
  nombre,
  fecha,
  estado,
  acceso_publico,
  codigo_acceso,
  url_publica,
  created_at
FROM asambleas
ORDER BY created_at DESC;

-- 3. Ver preguntas de cada asamblea
SELECT 
  a.nombre as asamblea,
  a.codigo_acceso,
  a.acceso_publico,
  p.id as pregunta_id,
  p.texto_pregunta,
  p.estado as estado_pregunta,
  COUNT(DISTINCT o.id) as num_opciones,
  COUNT(DISTINCT v.id) as num_votos
FROM asambleas a
LEFT JOIN preguntas p ON p.asamblea_id = a.id
LEFT JOIN opciones_pregunta o ON o.pregunta_id = p.id
LEFT JOIN votos v ON v.pregunta_id = p.id
GROUP BY a.id, a.nombre, a.codigo_acceso, a.acceso_publico, p.id, p.texto_pregunta, p.estado
ORDER BY a.created_at DESC, p.created_at ASC;

-- 4. Ver columnas de opciones_pregunta (para diagnosticar)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'opciones_pregunta'
ORDER BY ordinal_position;

-- 5. Ver opciones de cada pregunta
SELECT 
  p.texto_pregunta,
  p.estado,
  o.*
FROM preguntas p
INNER JOIN opciones_pregunta o ON o.pregunta_id = p.id
ORDER BY p.created_at DESC, o.orden ASC;

-- 6. Ver unidades con email
SELECT 
  COUNT(*) as total_unidades,
  COUNT(email) as unidades_con_email,
  COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as emails_validos
FROM unidades;

-- 7. Ver unidades específicas con email
SELECT 
  torre,
  numero,
  nombre_propietario,
  email,
  coeficiente
FROM unidades
WHERE email IS NOT NULL AND email != ''
ORDER BY torre, numero
LIMIT 10;

-- 8. Ver votos registrados
SELECT 
  v.id,
  p.texto_pregunta,
  u.torre,
  u.numero,
  u.email,
  v.created_at
FROM votos v
INNER JOIN preguntas p ON p.id = v.pregunta_id
INNER JOIN unidades u ON u.id = v.unidad_id
ORDER BY v.created_at DESC
LIMIT 20;

-- =====================================================
-- RESUMEN EJECUTIVO
-- =====================================================

SELECT 
  'Asambleas Totales' as metrica,
  COUNT(*) as valor
FROM asambleas
UNION ALL
SELECT 
  'Asambleas con Acceso Público Activo',
  COUNT(*)
FROM asambleas
WHERE acceso_publico = true
UNION ALL
SELECT 
  'Preguntas Totales',
  COUNT(*)
FROM preguntas
UNION ALL
SELECT 
  'Preguntas Abiertas',
  COUNT(*)
FROM preguntas
WHERE estado = 'abierta'
UNION ALL
SELECT 
  'Unidades con Email',
  COUNT(*)
FROM unidades
WHERE email IS NOT NULL AND email != ''
UNION ALL
SELECT 
  'Votos Registrados',
  COUNT(*)
FROM votos;
