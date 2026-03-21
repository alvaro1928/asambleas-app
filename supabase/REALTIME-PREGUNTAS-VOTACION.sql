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
-- Si al ejecutar esto la tabla ya está en la publicación, Postgres puede
-- devolver error; en ese caso no es necesario repetir.
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.preguntas;
