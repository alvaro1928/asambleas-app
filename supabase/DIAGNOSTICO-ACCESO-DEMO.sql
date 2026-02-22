-- =====================================================
-- DIAGNÓSTICO: acceso con test1@ en asamblea de demostración
-- =====================================================
-- IMPORTANTE: Ejecuta esto en el mismo proyecto Supabase que usa la web
-- (asamblea.online / NEXT_PUBLIC_SUPABASE_URL). Si ejecutas en otra base, no verás el problema.
-- Sustituye 'H49Z-3WVM' por tu código de acceso si es otro.
-- =====================================================

-- 1) Asamblea con este código: debe existir, is_demo=true, sandbox_usar_unidades_reales=false
SELECT
  a.id AS asamblea_id,
  a.nombre,
  a.codigo_acceso,
  a.is_demo,
  a.sandbox_usar_unidades_reales,
  a.organization_id
FROM asambleas a
WHERE a.codigo_acceso = 'H49Z-3WVM';

-- 2) Unidades demo de ese organization_id: deben existir 10 con test1@...test10@
-- (usa el organization_id del resultado anterior si hace falta)
SELECT
  u.id,
  u.organization_id,
  u.torre,
  u.numero,
  u.email,
  u.email_propietario,
  u.is_demo
FROM unidades u
WHERE u.organization_id = (
  SELECT a.organization_id FROM asambleas a WHERE a.codigo_acceso = 'H49Z-3WVM' LIMIT 1
)
AND u.is_demo = true
ORDER BY u.numero;

-- 3) Que la función validar_votante_asamblea sea SECURITY DEFINER
SELECT
  p.proname AS function_name,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'validar_votante_asamblea';

-- 4) Paso a paso: qué ve la función (para localizar el fallo)
WITH codigo_ok AS (
  SELECT asamblea_id, organization_id
  FROM validar_codigo_acceso('H49Z-3WVM')
  WHERE acceso_valido = true
),
asam AS (
  SELECT
    a.id,
    a.organization_id,
    COALESCE(a.is_demo, false) AS is_demo,
    COALESCE(a.sandbox_usar_unidades_reales, false) AS sandbox_reales
  FROM asambleas a
  WHERE a.id = (SELECT asamblea_id FROM codigo_ok LIMIT 1)
),
v_unidades_is_demo AS (
  SELECT
    CASE WHEN asam.is_demo AND asam.sandbox_reales THEN false ELSE asam.is_demo END AS valor
  FROM asam
)
SELECT
  '1. validar_codigo_acceso' AS paso,
  (SELECT COUNT(*) FROM codigo_ok) AS filas,
  (SELECT asamblea_id::text FROM codigo_ok LIMIT 1) AS detalle
UNION ALL
SELECT
  '2. asamblea is_demo, sandbox_reales',
  (SELECT COUNT(*) FROM asam),
  (SELECT is_demo::text || ', ' || sandbox_reales::text FROM asam LIMIT 1)
UNION ALL
SELECT
  '3. v_unidades_is_demo (true=buscar demo)',
  (SELECT COUNT(*) FROM v_unidades_is_demo),
  (SELECT valor::text FROM v_unidades_is_demo LIMIT 1)
UNION ALL
SELECT
  '4. unidades que coinciden (org + is_demo + email)',
  (SELECT COUNT(*) FROM unidades u
   WHERE u.organization_id = (SELECT organization_id FROM asam LIMIT 1)
     AND u.is_demo = (SELECT valor FROM v_unidades_is_demo LIMIT 1)
     AND LOWER(TRIM(COALESCE(u.email, u.email_propietario, ''))) = 'test1@asambleas.online'),
  NULL;

-- 5) Llamada directa a la función
SELECT * FROM validar_votante_asamblea('H49Z-3WVM', 'test1@asambleas.online');
