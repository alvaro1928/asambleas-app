-- =====================================================
-- Configuración: máximo poderes por apoderado (ya existe)
-- y plantilla adicional para correos de votación
-- =====================================================

-- Texto opcional que se incluye en los correos de enlace de votación.
-- Ej: enlace a Teams, Google Meet, o instrucciones adicionales.
ALTER TABLE configuracion_poderes
  ADD COLUMN IF NOT EXISTS plantilla_adicional_correo TEXT;

COMMENT ON COLUMN configuracion_poderes.plantilla_adicional_correo IS 'Texto opcional que se añade a los correos de enlace de votación. Ej: enlace a sesión Teams/Meet. Si está vacío se usa solo la plantilla por defecto.';
