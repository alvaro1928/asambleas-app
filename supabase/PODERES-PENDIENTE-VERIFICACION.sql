-- =====================================================
-- PODERES: estado pendiente_verificacion (registro desde votación)
-- =====================================================
-- Los votantes pueden declarar un poder recibido; queda en
-- pendiente_verificacion hasta que un gestor lo active (tras revisar
-- documento físico o archivo). Solo estado = 'activo' cuenta para votar.
--
-- Ejecutar en Supabase → SQL Editor
-- =====================================================

-- 1) Ampliar valores permitidos en estado
ALTER TABLE public.poderes DROP CONSTRAINT IF EXISTS poderes_estado_check;

ALTER TABLE public.poderes
  ADD CONSTRAINT poderes_estado_check
  CHECK (estado IN ('activo', 'revocado', 'usado', 'pendiente_verificacion'));

COMMENT ON COLUMN public.poderes.estado IS
  'activo: válido para votar | revocado | usado | pendiente_verificacion: registrado por el apoderado, pendiente de validación del gestor';

-- 2) Un solo “trámite abierto” (activo O pendiente) por (asamblea, unidad otorgante, apoderado).
--    Sustituye el índice solo-activo y evita duplicar activo + pendiente para la misma delegación.
DROP INDEX IF EXISTS public.poderes_activo_por_unidad_asamblea;
DROP INDEX IF EXISTS public.poderes_activo_otorgante_email_receptor;
DROP INDEX IF EXISTS public.poderes_pendiente_otorgante_email_receptor;

CREATE UNIQUE INDEX IF NOT EXISTS poderes_activo_o_pendiente_otorgante_email
ON public.poderes (
  asamblea_id,
  unidad_otorgante_id,
  lower(trim(email_receptor))
)
WHERE estado IN ('activo', 'pendiente_verificacion');

COMMENT ON INDEX public.poderes_activo_o_pendiente_otorgante_email IS
  'A lo sumo un poder activo o pendiente de verificación por misma unidad otorgante y mismo apoderado (identificador).';
