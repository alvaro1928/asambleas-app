-- =====================================================
-- Añadir color_principal_hex a configuracion_global.
-- Usado como variable CSS --color-primary en la app.
-- =====================================================

ALTER TABLE configuracion_global
  ADD COLUMN IF NOT EXISTS color_principal_hex TEXT;

COMMENT ON COLUMN configuracion_global.color_principal_hex IS 'Color principal en hex (ej. #4f46e5) para branding; se aplica como variable CSS --color-primary';

UPDATE configuracion_global
SET color_principal_hex = COALESCE(color_principal_hex, '#4f46e5')
WHERE key = 'landing';
