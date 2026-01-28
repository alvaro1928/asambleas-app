-- =====================================================
-- DIAGNÓSTICO: ¿Por qué no funciona el código?
-- =====================================================

-- 1. Ver TODAS tus asambleas y su estado de acceso público
SELECT 
  id,
  nombre,
  fecha,
  estado,
  codigo_acceso,
  acceso_publico,
  CASE 
    WHEN codigo_acceso IS NULL THEN '❌ Sin código'
    WHEN acceso_publico = false THEN '⚠️ Código existe pero está desactivado'
    WHEN acceso_publico = true THEN '✅ Activo'
  END AS diagnostico
FROM asambleas
ORDER BY created_at DESC;

-- Si ves NULL en codigo_acceso, necesitas activar la votación
-- Si ves false en acceso_publico, necesitas activarla
-- Si ves true, el código debería funcionar

-- =====================================================
-- 2. Activar votación pública para UNA asamblea
-- =====================================================
-- Copia el ID de tu asamblea del resultado anterior
-- y reemplaza 'tu-asamblea-id-aqui' con ese ID:

-- SELECT * FROM activar_votacion_publica(
--   'tu-asamblea-id-aqui'::UUID,
--   'http://localhost:3000'
-- );

-- Ejemplo real:
-- SELECT * FROM activar_votacion_publica(
--   '123e4567-e89b-12d3-a456-426614174000'::UUID,
--   'http://localhost:3000'
-- );

-- =====================================================
-- 3. Verificar el código generado
-- =====================================================
-- Después de ejecutar activar_votacion_publica, ejecuta:

-- SELECT 
--   id,
--   nombre,
--   codigo_acceso,
--   url_publica,
--   acceso_publico
-- FROM asambleas
-- WHERE codigo_acceso IS NOT NULL;

-- Esto te mostrará el código y la URL correcta
