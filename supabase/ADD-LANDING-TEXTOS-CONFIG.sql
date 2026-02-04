-- Textos editables de la landing (mensajes publicitarios y botón de contacto).
-- Los créditos se venden en la app; el botón WhatsApp es para "Contactanos", no compra.

ALTER TABLE configuracion_global
  ADD COLUMN IF NOT EXISTS texto_hero_precio TEXT;

ALTER TABLE configuracion_global
  ADD COLUMN IF NOT EXISTS texto_ahorro TEXT;

ALTER TABLE configuracion_global
  ADD COLUMN IF NOT EXISTS cta_whatsapp_text TEXT;

COMMENT ON COLUMN configuracion_global.texto_hero_precio IS 'Frase bajo el hero (ej. Paga solo por lo que usas: X COP por unidad). Vacío = usar texto por defecto con precio.';
COMMENT ON COLUMN configuracion_global.texto_ahorro IS 'Frase de ahorro (ej. Ahorra un 75%...). Vacío = usar texto por defecto.';
COMMENT ON COLUMN configuracion_global.cta_whatsapp_text IS 'Texto del botón de contacto WhatsApp (ej. Contactanos). Los créditos se venden en la app.';

UPDATE configuracion_global
SET cta_whatsapp_text = COALESCE(cta_whatsapp_text, 'Contactanos')
WHERE key = 'landing';
