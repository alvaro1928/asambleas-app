-- ================================================================
-- SCRIPT PARA LIMPIAR TODOS LOS DATOS DE LA APLICACIÓN
-- ================================================================
-- ⚠️  ADVERTENCIA: Este script borrará TODOS los datos de:
--    - Usuarios (profiles)
--    - Conjuntos (organizations)
--    - Unidades
--    - Asambleas
--    - Preguntas y Opciones
--    - Votos
--    - Poderes
--    - Configuraciones
--
-- ⚠️  ESTO ES IRREVERSIBLE. Solo ejecuta si estás seguro.
-- ================================================================

BEGIN;

-- 1. Borrar votos e historial (lo más dependiente primero)
DELETE FROM historial_votos;
DELETE FROM votos;

-- 2. Borrar opciones de preguntas
DELETE FROM opciones_pregunta;

-- 3. Borrar preguntas
DELETE FROM preguntas;

-- 4. Borrar poderes y configuraciones
DELETE FROM poderes;
DELETE FROM configuracion_poderes;

-- 5. Borrar asambleas
DELETE FROM asambleas;

-- 6. Borrar unidades
DELETE FROM unidades;

-- 7. Borrar conjuntos
DELETE FROM organizations;

-- 8. Borrar perfiles de usuarios
DELETE FROM profiles;

COMMIT;

-- ================================================================
-- VERIFICACIÓN: Contar registros restantes
-- ================================================================
SELECT 'profiles' as tabla, COUNT(*) as registros FROM profiles
UNION ALL
SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'unidades', COUNT(*) FROM unidades
UNION ALL
SELECT 'asambleas', COUNT(*) FROM asambleas
UNION ALL
SELECT 'preguntas', COUNT(*) FROM preguntas
UNION ALL
SELECT 'opciones_pregunta', COUNT(*) FROM opciones_pregunta
UNION ALL
SELECT 'votos', COUNT(*) FROM votos
UNION ALL
SELECT 'historial_votos', COUNT(*) FROM historial_votos
UNION ALL
SELECT 'poderes', COUNT(*) FROM poderes
UNION ALL
SELECT 'configuracion_poderes', COUNT(*) FROM configuracion_poderes;

-- ================================================================
-- ✅ Si todo está en 0, la limpieza fue exitosa
-- ================================================================
