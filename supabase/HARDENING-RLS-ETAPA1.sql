-- =====================================================
-- HARDENING RLS - ETAPA 1 (NO ROMPER PRODUCCION)
-- =====================================================
-- Objetivo:
-- 1) Corregir hallazgos del linter:
--    - policy_exists_rls_disabled
--    - rls_disabled_in_public
-- 2) Reducir exposición externa (anon) SIN romper flujos actuales.
-- 3) Mantener compatibilidad temporal para clientes authenticated.
--
-- Nota:
-- - Esta etapa NO implementa aislamiento fino por organization_id/user_id.
-- - Esa parte va en ETAPA 2 (políticas por tenant/rol).
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- A) TABLAS OBJETIVO (reportadas por linter)
-- -----------------------------------------------------
-- Si alguna no existe en tu entorno, se ignora.
DO $$
DECLARE
  t text;
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
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------
-- B) CIERRE EXTERNO: bloquear ANON en tablas sensibles
-- -----------------------------------------------------
DO $$
DECLARE
  t text;
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
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------
-- C) COMPATIBILIDAD TEMPORAL PARA AUTHENTICATED
-- -----------------------------------------------------
-- Política temporal amplia para no romper el frontend actual
-- mientras migramos a políticas finas en ETAPA 2.
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
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        policy_name,
        t
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------
-- D) VIEWS SECURITY DEFINER (hallazgo linter)
-- -----------------------------------------------------
-- En PostgreSQL, las vistas normalmente se comportan como SECURITY DEFINER
-- (usan permisos del owner). La mitigación operativa de etapa 1 es:
-- - revocar acceso anon directo a esas vistas.
REVOKE ALL ON TABLE public.vista_participacion_votantes FROM anon;
REVOKE ALL ON TABLE public.vista_poderes_completa FROM anon;

COMMIT;

-- =====================================================
-- ROLLBACK RAPIDO (MANUAL, SI LO NECESITAS)
-- =====================================================
-- 1) Deshabilitar RLS (vuelve al estado anterior de exposición):
--    ALTER TABLE public.<tabla> DISABLE ROW LEVEL SECURITY;
--
-- 2) Eliminar políticas temporales:
--    DROP POLICY IF EXISTS authenticated_temp_all_<tabla> ON public.<tabla>;
--
-- 3) Restaurar grants anon si eran necesarios:
--    GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO anon;
--
-- Recomendado:
-- - Ejecutar ETAPA 2 inmediatamente después para reemplazar políticas
--   temporales por políticas finas por organization_id / owner.
-- =====================================================

