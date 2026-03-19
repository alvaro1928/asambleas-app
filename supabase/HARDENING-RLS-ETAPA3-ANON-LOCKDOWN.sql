-- =====================================================
-- HARDENING RLS - ETAPA 3 (ANON LOCKDOWN)
-- =====================================================
-- Objetivo:
-- - Endurecer superficie pública removiendo lecturas anon sensibles.
-- - Mantener únicamente lo mínimo para flujos públicos actuales.
--
-- IMPORTANTE:
-- - Ejecutar después de ETAPA 1 y ETAPA 2.
-- - Incluye rollback separado:
--   supabase/HARDENING-RLS-ETAPA3-ROLLBACK.sql
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1) Eliminar políticas anon amplias heredadas de etapas previas
-- -----------------------------------------------------
DROP POLICY IF EXISTS unidades_anon_select_publicas_por_org ON public.unidades;
DROP POLICY IF EXISTS votos_anon_select_publicos ON public.votos;

-- Si existieran por historial de scripts, las limpiamos también.
DROP POLICY IF EXISTS unidades_anon_all ON public.unidades;
DROP POLICY IF EXISTS votos_anon_all ON public.votos;
DROP POLICY IF EXISTS poderes_anon_all ON public.poderes;
DROP POLICY IF EXISTS quorum_anon_all ON public.quorum_asamblea;
DROP POLICY IF EXISTS verif_reg_anon_all ON public.verificacion_asistencia_registro;
DROP POLICY IF EXISTS verif_sesiones_anon_all ON public.verificacion_asamblea_sesiones;

-- -----------------------------------------------------
-- 2) Reforzar grants anon en tablas de alta sensibilidad
-- -----------------------------------------------------
REVOKE ALL ON TABLE public.unidades FROM anon;
REVOKE ALL ON TABLE public.votos FROM anon;
REVOKE ALL ON TABLE public.poderes FROM anon;
REVOKE ALL ON TABLE public.quorum_asamblea FROM anon;
REVOKE ALL ON TABLE public.verificacion_asistencia_registro FROM anon;
REVOKE ALL ON TABLE public.verificacion_asamblea_sesiones FROM anon;
REVOKE ALL ON TABLE public.historial_votos FROM anon;
REVOKE ALL ON TABLE public.pagos_historial FROM anon;
REVOKE ALL ON TABLE public.billing_logs FROM anon;

-- -----------------------------------------------------
-- 3) Mantener mínimo público para render de votación
-- -----------------------------------------------------
-- Nota: estas políticas ya deberían existir por ETAPA 2.
-- Se recrean de forma idempotente para asegurar consistencia.
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

-- -----------------------------------------------------
-- 4) Views SECURITY DEFINER: bloquear exposición anon directa
-- -----------------------------------------------------
REVOKE ALL ON TABLE public.vista_participacion_votantes FROM anon;
REVOKE ALL ON TABLE public.vista_poderes_completa FROM anon;

COMMIT;

-- =====================================================
-- CHECKLIST POST-DEPLOY
-- =====================================================
-- 1) Probar ingreso /votar con código público.
-- 2) Probar ver resultados/estadísticas en pantalla pública.
-- 3) Probar flujo /asistir (delegado).
-- 4) Si algo falla, ejecutar rollback ETAPA 3.
-- =====================================================

