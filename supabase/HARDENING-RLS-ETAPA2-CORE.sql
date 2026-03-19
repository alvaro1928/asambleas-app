-- =====================================================
-- HARDENING RLS - ETAPA 2 (TABLAS CORE)
-- =====================================================
-- Objetivo:
-- - Reemplazar políticas temporales "authenticated_temp_all_*"
--   por políticas finas basadas en pertenencia a organization_id.
-- - Alcance: tablas núcleo de asambleas, preguntas, opciones, unidades,
--   poderes, votos y quórum.
--
-- IMPORTANTE:
-- - Mantiene algunas políticas de lectura para anon en tablas de flujo
--   público para no romper votación actual.
-- - La seguridad total para flujos públicos requiere ETAPA 3
--   (migrar lecturas sensibles de anon a API/RPC con validación explícita).
-- =====================================================

BEGIN;

-- Helper lógico (inline en políticas):
-- Usuario pertenece a organización:
-- EXISTS (
--   SELECT 1 FROM public.profiles p
--   WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
--     AND p.organization_id = <org_id>
-- )

-- -----------------------------------------------------
-- 1) ASAMBLEAS
-- -----------------------------------------------------
DROP POLICY IF EXISTS authenticated_temp_all_asambleas ON public.asambleas;

DROP POLICY IF EXISTS asambleas_auth_select_org ON public.asambleas;
CREATE POLICY asambleas_auth_select_org
  ON public.asambleas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
        AND p.organization_id = asambleas.organization_id
    )
  );

DROP POLICY IF EXISTS asambleas_auth_insert_org ON public.asambleas;
CREATE POLICY asambleas_auth_insert_org
  ON public.asambleas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
        AND p.organization_id = asambleas.organization_id
    )
  );

DROP POLICY IF EXISTS asambleas_auth_update_org ON public.asambleas;
CREATE POLICY asambleas_auth_update_org
  ON public.asambleas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
        AND p.organization_id = asambleas.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
        AND p.organization_id = asambleas.organization_id
    )
  );

DROP POLICY IF EXISTS asambleas_auth_delete_org ON public.asambleas;
CREATE POLICY asambleas_auth_delete_org
  ON public.asambleas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
        AND p.organization_id = asambleas.organization_id
    )
  );

-- Compatibilidad flujo público (lectura anon)
DROP POLICY IF EXISTS asambleas_anon_select_publicas ON public.asambleas;
CREATE POLICY asambleas_anon_select_publicas
  ON public.asambleas
  FOR SELECT
  TO anon
  USING (acceso_publico = true);

-- -----------------------------------------------------
-- 2) PREGUNTAS
-- -----------------------------------------------------
DROP POLICY IF EXISTS authenticated_temp_all_preguntas ON public.preguntas;

DROP POLICY IF EXISTS preguntas_auth_all_org ON public.preguntas;
CREATE POLICY preguntas_auth_all_org
  ON public.preguntas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE a.id = preguntas.asamblea_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE a.id = preguntas.asamblea_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  );

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

-- -----------------------------------------------------
-- 3) OPCIONES_PREGUNTA
-- -----------------------------------------------------
DROP POLICY IF EXISTS authenticated_temp_all_opciones_pregunta ON public.opciones_pregunta;

DROP POLICY IF EXISTS opciones_auth_all_org ON public.opciones_pregunta;
CREATE POLICY opciones_auth_all_org
  ON public.opciones_pregunta
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.preguntas pr
      JOIN public.asambleas a ON a.id = pr.asamblea_id
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE pr.id = opciones_pregunta.pregunta_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.preguntas pr
      JOIN public.asambleas a ON a.id = pr.asamblea_id
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE pr.id = opciones_pregunta.pregunta_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
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

-- -----------------------------------------------------
-- 4) UNIDADES
-- -----------------------------------------------------
DROP POLICY IF EXISTS authenticated_temp_all_unidades ON public.unidades;

DROP POLICY IF EXISTS unidades_auth_all_org ON public.unidades;
CREATE POLICY unidades_auth_all_org
  ON public.unidades
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
        AND p.organization_id = unidades.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
        AND p.organization_id = unidades.organization_id
    )
  );

-- Compatibilidad para flujo delegado (lecturas públicas actuales)
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

-- -----------------------------------------------------
-- 5) PODERES
-- -----------------------------------------------------
DROP POLICY IF EXISTS authenticated_temp_all_poderes ON public.poderes;

DROP POLICY IF EXISTS poderes_auth_all_org ON public.poderes;
CREATE POLICY poderes_auth_all_org
  ON public.poderes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE a.id = poderes.asamblea_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE a.id = poderes.asamblea_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  );

-- -----------------------------------------------------
-- 6) VOTOS
-- -----------------------------------------------------
DROP POLICY IF EXISTS authenticated_temp_all_votos ON public.votos;

DROP POLICY IF EXISTS votos_auth_all_org ON public.votos;
CREATE POLICY votos_auth_all_org
  ON public.votos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.preguntas pr
      JOIN public.asambleas a ON a.id = pr.asamblea_id
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE pr.id = votos.pregunta_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.preguntas pr
      JOIN public.asambleas a ON a.id = pr.asamblea_id
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE pr.id = votos.pregunta_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  );

-- Compatibilidad mínima para pantallas públicas actuales
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
-- 7) QUORUM_ASAMBLEA
-- -----------------------------------------------------
DROP POLICY IF EXISTS authenticated_temp_all_quorum_asamblea ON public.quorum_asamblea;

DROP POLICY IF EXISTS quorum_auth_all_org ON public.quorum_asamblea;
CREATE POLICY quorum_auth_all_org
  ON public.quorum_asamblea
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE a.id = quorum_asamblea.asamblea_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE a.id = quorum_asamblea.asamblea_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  );

COMMIT;

-- =====================================================
-- NOTAS OPERATIVAS
-- =====================================================
-- 1) Ejecuta ETAPA 1 primero (HARDENING-RLS-ETAPA1.sql), luego ETAPA 2.
-- 2) Valida flujos:
--    - Dashboard admin (crear/editar asamblea, preguntas, unidades, poderes)
--    - Votación pública /votar
--    - Asistente delegado /asistir
-- 3) ETAPA 3 recomendada:
--    - Quitar políticas anon amplias de unidades/votos.
--    - Migrar lecturas públicas sensibles a API/RPC con validación de código/token.
-- =====================================================

