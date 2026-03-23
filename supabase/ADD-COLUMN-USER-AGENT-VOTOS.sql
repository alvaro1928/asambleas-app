-- Opcional: trazabilidad en la fila vigente de `votos` (el panel delegado ya no depende de esta columna).
-- Ejecutar en Supabase SQL Editor si quieres guardar user_agent en `votos` además de en `historial_votos`.

ALTER TABLE public.votos ADD COLUMN IF NOT EXISTS user_agent TEXT;

COMMENT ON COLUMN public.votos.user_agent IS 'Navegador o marca literal p.ej. delegado; opcional si la RPC solo usa historial_votos.';
