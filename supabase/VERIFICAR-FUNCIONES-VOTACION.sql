-- =====================================================
-- SCRIPT DE VERIFICACIÓN: Funciones de Votación
-- =====================================================
-- Ejecuta este script para verificar si las funciones
-- necesarias ya existen en tu base de datos
-- =====================================================

-- 1. Verificar si existen las columnas en asambleas
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'asambleas'
  AND column_name IN ('codigo_acceso', 'url_publica', 'acceso_publico');

-- Si retorna 3 filas, las columnas existen ✅
-- Si retorna 0 filas, necesitas ejecutar AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql ❌

-- 2. Verificar si existe la función generar_codigo_acceso
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'generar_codigo_acceso';

-- Si retorna 1 fila, la función existe ✅
-- Si retorna 0 filas, necesitas ejecutar AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql ❌

-- 3. Verificar si existe la función activar_votacion_publica
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'activar_votacion_publica';

-- Si retorna 1 fila, la función existe ✅
-- Si retorna 0 filas, necesitas ejecutar AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql ❌

-- 4. Verificar si existe la función validar_codigo_acceso
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'validar_codigo_acceso';

-- Si retorna 1 fila, la función existe ✅
-- Si retorna 0 filas, necesitas ejecutar AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql ❌

-- 5. Verificar si existe la función validar_votante_asamblea
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'validar_votante_asamblea';

-- Si retorna 1 fila, la función existe ✅
-- Si retorna 0 filas, necesitas ejecutar AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql ❌

-- =====================================================
-- RESUMEN DE VERIFICACIÓN
-- =====================================================
-- Ejecuta esta consulta final para ver un resumen:

SELECT 
  'Columnas en asambleas' AS verificacion,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ OK'
    ELSE '❌ FALTAN'
  END AS estado
FROM information_schema.columns
WHERE table_name = 'asambleas'
  AND column_name IN ('codigo_acceso', 'url_publica', 'acceso_publico')

UNION ALL

SELECT 
  'Función: generar_codigo_acceso' AS verificacion,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ OK'
    ELSE '❌ FALTA'
  END AS estado
FROM information_schema.routines
WHERE routine_name = 'generar_codigo_acceso'

UNION ALL

SELECT 
  'Función: activar_votacion_publica' AS verificacion,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ OK'
    ELSE '❌ FALTA'
  END AS estado
FROM information_schema.routines
WHERE routine_name = 'activar_votacion_publica'

UNION ALL

SELECT 
  'Función: validar_codigo_acceso' AS verificacion,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ OK'
    ELSE '❌ FALTA'
  END AS estado
FROM information_schema.routines
WHERE routine_name = 'validar_codigo_acceso'

UNION ALL

SELECT 
  'Función: validar_votante_asamblea' AS verificacion,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ OK'
    ELSE '❌ FALTA'
  END AS estado
FROM information_schema.routines
WHERE routine_name = 'validar_votante_asamblea';

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- Si TODO está OK, deberías ver:
--
-- | verificacion                        | total | estado |
-- |-------------------------------------|-------|--------|
-- | Columnas en asambleas               |   3   | ✅ OK  |
-- | Función: generar_codigo_acceso      |   1   | ✅ OK  |
-- | Función: activar_votacion_publica   |   1   | ✅ OK  |
-- | Función: validar_codigo_acceso      |   1   | ✅ OK  |
-- | Función: validar_votante_asamblea   |   1   | ✅ OK  |
-- =====================================================
