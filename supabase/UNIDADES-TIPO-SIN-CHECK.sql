-- =====================================================
-- UNIDADES: quitar check constraint en columna tipo
-- =====================================================
-- El constraint unidades_tipo_check solo permitía
-- ('apartamento', 'casa', 'local', 'parqueadero', 'bodega').
-- Al importar, Excel/CSV suelen traer 'Apartamento', 'Apto', 'Casa', etc.
-- Se elimina el CHECK para permitir cualquier texto.
-- El backend normaliza a minúsculas antes de guardar.
-- =====================================================

-- Eliminar el check constraint (el nombre puede ser unidades_tipo_check en PostgreSQL)
ALTER TABLE unidades
  DROP CONSTRAINT IF EXISTS unidades_tipo_check;

-- Opcional: asegurar default en minúsculas para nuevas filas
ALTER TABLE unidades
  ALTER COLUMN tipo SET DEFAULT 'apartamento';

COMMENT ON COLUMN unidades.tipo IS 'Tipo de unidad (ej. apartamento, apto, casa, local). Sin restricción de valores; el backend guarda en minúsculas.';
