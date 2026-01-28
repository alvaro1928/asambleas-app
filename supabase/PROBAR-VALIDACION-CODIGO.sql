-- =====================================================
-- PRUEBA DIRECTA: Validar código de acceso
-- =====================================================

-- 1. Verificar que la asamblea existe con ese código
SELECT 
  a.id,
  a.nombre,
  a.codigo_acceso,
  a.acceso_publico,
  a.organization_id,
  o.name AS nombre_conjunto
FROM asambleas a
LEFT JOIN organizations o ON a.organization_id = o.id
WHERE a.codigo_acceso = '5759-4RXE';

-- Deberías ver 1 fila con toda la información

-- =====================================================
-- 2. Probar la función validar_codigo_acceso directamente
-- =====================================================

SELECT * FROM validar_codigo_acceso('5759-4RXE');

-- Resultado esperado:
-- asamblea_id | nombre | fecha | organization_id | nombre_conjunto | acceso_valido | mensaje
-- ------------+--------+-------+-----------------+-----------------+---------------+---------
-- [uuid]      | madero | ...   | [uuid]         | Nombre conjunto | true          | Código válido...

-- =====================================================
-- 3. Si el paso 2 falla, ejecuta esto para debug:
-- =====================================================

-- Ver si el problema es con el JOIN
SELECT 
  a.id AS asamblea_id,
  a.nombre,
  a.fecha::DATE AS fecha,
  a.organization_id,
  a.acceso_publico
FROM asambleas a
WHERE a.codigo_acceso = UPPER(TRIM('5759-4RXE'));

-- =====================================================
-- 4. Verificar que organizations tiene el name
-- =====================================================

SELECT 
  id,
  name,
  nit
FROM organizations
WHERE id IN (
  SELECT organization_id 
  FROM asambleas 
  WHERE codigo_acceso = '5759-4RXE'
);

-- Si name es NULL, ahí está el problema
