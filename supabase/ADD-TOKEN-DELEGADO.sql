-- ============================================================
-- ADD-TOKEN-DELEGADO.sql
--
-- Agrega soporte para el acceso de "asistente delegado":
-- El administrador puede generar un enlace con token UUID que
-- permite a una persona de confianza:
--   1. Registrar asistencia de unidades en la asamblea.
--   2. Votar en nombre de unidades (voto asistido).
--
-- El token es un UUID aleatorio almacenado en asambleas.
-- NULL = sin delegado activo.
-- Se puede revocar/regenerar en cualquier momento.
-- ============================================================

ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS token_delegado UUID;

COMMENT ON COLUMN asambleas.token_delegado IS
  'Token UUID del asistente delegado. NULL = sin delegado activo.
   El enlace /asistir/[codigo]?t=[token] permite votar y registrar
   asistencia en nombre de las unidades. Puede revocarse en cualquier momento.';

-- Índice parcial para búsquedas por token (solo filas con token activo)
CREATE INDEX IF NOT EXISTS idx_asambleas_token_delegado
  ON asambleas(token_delegado)
  WHERE token_delegado IS NOT NULL;
