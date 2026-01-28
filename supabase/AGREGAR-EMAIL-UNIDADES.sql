-- =====================================================
-- AGREGAR COLUMNA EMAIL A UNIDADES
-- =====================================================

-- 1. Verificar columnas actuales de unidades
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'unidades'
ORDER BY ordinal_position;

-- =====================================================
-- 2. Agregar columna email si no existe
-- =====================================================

ALTER TABLE unidades
ADD COLUMN IF NOT EXISTS email TEXT;

-- =====================================================
-- 3. Agregar columna telefono si no existe
-- =====================================================

ALTER TABLE unidades
ADD COLUMN IF NOT EXISTS telefono TEXT;

-- =====================================================
-- 4. Crear índice para búsquedas rápidas por email
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_unidades_email ON unidades(email);

-- =====================================================
-- 5. Verificar que se agregaron las columnas
-- =====================================================

SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'unidades'
  AND column_name IN ('email', 'telefono', 'nombre_propietario');

-- Deberías ver 3 filas (email, telefono, nombre_propietario)

-- =====================================================
-- 6. Ver datos actuales de unidades
-- =====================================================

SELECT 
  id,
  torre,
  numero,
  nombre_propietario,
  email,
  telefono,
  coeficiente
FROM unidades
LIMIT 5;

-- =====================================================
-- 7. OPCIONAL: Copiar nombre_propietario a email si existe
-- =====================================================
-- Si habías puesto emails en nombre_propietario, puedes copiarlos:

-- UPDATE unidades
-- SET email = nombre_propietario
-- WHERE nombre_propietario LIKE '%@%'
--   AND (email IS NULL OR email = '');

-- =====================================================
-- 8. Actualizar unidades con email de ejemplo
-- =====================================================
-- Actualiza tus unidades con emails reales:

-- UPDATE unidades
-- SET email = 'propietario1@email.com'
-- WHERE torre = 'A' AND numero = '101';

-- UPDATE unidades
-- SET email = 'propietario2@email.com'
-- WHERE torre = 'A' AND numero = '102';

-- etc...
