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

-- 4) Llamada directa: debe devolver puede_votar=true y unidades_propias con 1 UUID
--    (Si devuelve puede_votar=false, el problema está en la BD o en la función.)
SELECT * FROM validar_votante_asamblea('H49Z-3WVM', 'test1@asambleas.online');
