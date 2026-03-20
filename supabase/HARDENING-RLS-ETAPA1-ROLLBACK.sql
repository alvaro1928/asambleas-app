-- =====================================================
-- HARDENING RLS - ETAPA 1 ROLLBACK
-- =====================================================
-- Objetivo:
-- - Revertir los cambios de ETAPA 1 en caso de incidencia.
-- - Volver a un estado "pre-etapa1" aproximado:
--   * elimina políticas temporales authenticated_temp_all_*
--   * deshabilita RLS en tablas afectadas
--
-- NOTA:
-- - No restaura automáticamente grants históricos exactos de anon/authenticated
--   porque eso depende del estado previo de cada entorno.
-- =====================================================

BEGIN;

DO $$
DECLARE
  t text;
  policy_name text;
  tables text[] := ARRAY[
    'asambleas',
    'historial_votos',
    'opciones_pregunta',
    'organizations',
    'pagos_historial',
    'poderes',
    'preguntas',
    'profiles',
    'profiles_temp',
    'quorum_asamblea',
    'unidades',
    'votos',
    'configuracion_poderes',
    'billing_logs',
    'verificacion_asamblea_sesiones',
    'verificacion_asistencia_registro'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      policy_name := 'authenticated_temp_all_' || t;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- =====================================================
-- POST-ROLLBACK (manual recomendado)
-- =====================================================
-- Si necesitas restaurar acceso inmediato por API pública, revisa grants:
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO anon;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO authenticated;
-- =====================================================

