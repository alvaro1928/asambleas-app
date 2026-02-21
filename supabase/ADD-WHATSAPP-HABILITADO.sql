-- =====================================================
-- Activar/desactivar envío masivo WhatsApp para todos los usuarios.
-- Super Admin puede desactivarlo mientras la plantilla está en verificación en Meta.
-- =====================================================

ALTER TABLE configuracion_whatsapp
  ADD COLUMN IF NOT EXISTS habilitado BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN configuracion_whatsapp.habilitado IS 'Si false, ningún usuario puede enviar notificaciones masivas por WhatsApp. Super Admin controla esto (ej. mientras la plantilla está en verificación en Meta).';
