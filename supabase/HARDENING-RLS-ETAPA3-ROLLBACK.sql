-- =====================================================
-- HARDENING RLS - ETAPA 3 ROLLBACK
-- =====================================================
-- Objetivo:
-- - Volver del estado ETAPA 3 al comportamiento de ETAPA 2
--   en caso de incidencia operativa.
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1) Restaurar políticas anon compatibles ETAPA 2
-- -----------------------------------------------------
DROP POLICY IF EXISTS unidades_anon_select_publicas_por_org ON public.unidades;
CREATE POLICY unidades_anon_select_publicas_por_org
  ON public.unidades
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      WHERE a.organization_id = unidades.organization_id
        AND (a.acceso_publico = true OR a.token_delegado IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS votos_anon_select_publicos ON public.votos;
CREATE POLICY votos_anon_select_publicos
  ON public.votos
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.preguntas pr
      JOIN public.asambleas a ON a.id = pr.asamblea_id
      WHERE pr.id = votos.pregunta_id
        AND a.acceso_publico = true
    )
  );

-- -----------------------------------------------------
-- 2) Restaurar grants mínimos para que dichas políticas operen
-- -----------------------------------------------------
GRANT SELECT ON TABLE public.unidades TO anon;
GRANT SELECT ON TABLE public.votos TO anon;

-- -----------------------------------------------------
-- 3) Mantener políticas anon básicas de ETAPA 2
-- -----------------------------------------------------
DROP POLICY IF EXISTS asambleas_anon_select_publicas ON public.asambleas;
CREATE POLICY asambleas_anon_select_publicas
  ON public.asambleas
  FOR SELECT
  TO anon
  USING (acceso_publico = true);

DROP POLICY IF EXISTS preguntas_anon_select_publicas ON public.preguntas;
CREATE POLICY preguntas_anon_select_publicas
  ON public.preguntas
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      WHERE a.id = preguntas.asamblea_id
        AND a.acceso_publico = true
    )
  );

DROP POLICY IF EXISTS opciones_anon_select_publicas ON public.opciones_pregunta;
CREATE POLICY opciones_anon_select_publicas
  ON public.opciones_pregunta
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.preguntas pr
      JOIN public.asambleas a ON a.id = pr.asamblea_id
      WHERE pr.id = opciones_pregunta.pregunta_id
        AND a.acceso_publico = true
    )
  );

COMMIT;

-- =====================================================
-- CHECKLIST POST-ROLLBACK
-- =====================================================
-- 1) Probar /votar y /asistir.
-- 2) Revisar linter: volverán algunos hallazgos de exposición anon
--    (esperado mientras se corrige arquitectura de lectura pública).
-- =====================================================

