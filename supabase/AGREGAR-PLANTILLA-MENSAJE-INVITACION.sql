-- Plantilla configurable para el mensaje de invitación (WhatsApp/correo).
-- Variables soportadas en el texto:
-- {asamblea}, {fecha}, {url}, {conjunto}

ALTER TABLE configuracion_poderes
  ADD COLUMN IF NOT EXISTS plantilla_mensaje_invitacion TEXT;

COMMENT ON COLUMN configuracion_poderes.plantilla_mensaje_invitacion IS
'Plantilla opcional para el mensaje de invitación de votación (WhatsApp y correo). Si está vacía, la app usa mensaje por defecto.';
