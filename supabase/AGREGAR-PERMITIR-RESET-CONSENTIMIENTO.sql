-- Permite desactivar desde Configuración el botón de reset masivo de consentimiento LOPD en la página de asamblea.
ALTER TABLE public.configuracion_poderes
  ADD COLUMN IF NOT EXISTS permitir_reset_consentimiento_general BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.configuracion_poderes.permitir_reset_consentimiento_general IS
  'Si es true, los administradores pueden usar "Reset consentimiento" en la página de la asamblea (borra todas las aceptaciones LOPD de esa asamblea).';
