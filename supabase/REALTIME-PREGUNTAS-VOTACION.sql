-- =====================================================
-- Realtime: eventos en `preguntas` para /votar (cliente)
-- =====================================================
-- La página pública se suscribe a cambios en `preguntas` (INSERT/UPDATE/DELETE)
-- para refrescar la lista sin depender solo del polling.
--
-- En proyectos nuevos de Supabase suele estar habilitado; si la suscripción no
-- recibe eventos, en Dashboard: Database → Publications → supabase_realtime
-- y asegurar que `public.preguntas` esté incluida.
--
-- Idempotente: si `preguntas` ya está en la publicación, no hace nada.
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'preguntas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.preguntas;
  END IF;
END $$;
