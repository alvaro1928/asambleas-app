-- =====================================================
-- COMPLETAR TABLA UNIDADES CON COLUMNAS FALTANTES
-- =====================================================

-- 1. Ver columnas ACTUALES de la tabla unidades
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'unidades'
ORDER BY ordinal_position;

-- Anota qué columnas YA existen

-- =====================================================
-- 2. Agregar TODAS las columnas necesarias
-- =====================================================

-- Nombre del propietario
ALTER TABLE unidades
ADD COLUMN IF NOT EXISTS nombre_propietario TEXT;

-- Email del propietario
ALTER TABLE unidades
ADD COLUMN IF NOT EXISTS email TEXT;

-- Teléfono del propietario
ALTER TABLE unidades
ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Tipo de unidad (Apartamento, Local, Casa, etc.)
ALTER TABLE unidades
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Apartamento';

-- =====================================================
-- 3. Crear índices para búsquedas rápidas
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_unidades_email ON unidades(email);
CREATE INDEX IF NOT EXISTS idx_unidades_nombre ON unidades(nombre_propietario);
CREATE INDEX IF NOT EXISTS idx_unidades_tipo ON unidades(tipo);

-- =====================================================
-- 4. Verificar que TODO se agregó correctamente
-- =====================================================

SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'unidades'
ORDER BY ordinal_position;

-- Deberías ver TODAS estas columnas:
-- - id
-- - organization_id
-- - torre
-- - numero
-- - coeficiente
-- - nombre_propietario (NUEVO)
-- - email (NUEVO)
-- - telefono (NUEVO)
-- - tipo (NUEVO)
-- - created_at

-- =====================================================
-- 5. Ver tus unidades actuales
-- =====================================================

SELECT 
  id,
  torre,
  numero,
  nombre_propietario,
  email,
  telefono,
  tipo,
  coeficiente
FROM unidades
ORDER BY torre, numero;

-- =====================================================
-- 6. Actualizar una unidad de prueba con datos completos
-- =====================================================

-- Copia el ID de una de tus unidades del paso 5
-- y actualízala con datos de prueba:

-- UPDATE unidades
-- SET 
--   nombre_propietario = 'Juan Pérez',
--   email = 'juan.perez@email.com',
--   telefono = '3001234567',
--   tipo = 'Apartamento'
-- WHERE id = 'tu-id-aqui'::UUID;

-- O si prefieres actualizar por torre y número:

-- UPDATE unidades
-- SET 
--   nombre_propietario = 'María García',
--   email = 'maria.garcia@email.com',
--   telefono = '3007654321',
--   tipo = 'Apartamento'
-- WHERE torre = 'A' AND numero = '101';

-- =====================================================
-- 7. VERIFICAR QUE LA ACTUALIZACIÓN FUNCIONÓ
-- =====================================================

-- SELECT 
--   torre,
--   numero,
--   nombre_propietario,
--   email,
--   telefono
-- FROM unidades
-- WHERE email IS NOT NULL
-- ORDER BY torre, numero;
