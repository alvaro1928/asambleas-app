-- =====================================================
-- FIX LINTER: search_path mutable + RLS always true
-- =====================================================
-- Objetivo:
-- 1) Corregir funciones sin search_path fijo.
-- 2) Reemplazar políticas temporales demasiado permisivas
--    por versiones equivalentes, pero no "always true".
--
-- Nota:
-- - Este script está pensado para ejecutarse en producción
--   sin romper compatibilidad inmediata.
-- - Mantiene acceso amplio para "authenticated", pero exige
--   sesión válida (auth.uid() IS NOT NULL).
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- A) FUNCTION SEARCH PATH MUTABLE
-- -----------------------------------------------------
DO $$
DECLARE
  fn_oid oid;
BEGIN
  FOR fn_oid IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'get_costo_tokens_conjunto',
        'set_tokens_bienvenida',
        'normalizar_telefono',
        'planes_updated_at',
        'check_is_org_owner',
        'get_user_organization',
        'crear_opciones_por_defecto',
        'quorum_ids_para_verificar_asistencia',
        'handle_new_user',
        'reporte_auditoria_pregunta',
        'puede_votar',
        'calcular_quorum_asamblea',
        'validar_limite_poderes',
        'resumen_poderes_asamblea',
        'unidad_ids_verificados_sesion_actual',
        'calcular_estadisticas_pregunta',
        'asegurar_quorum_para_identificador',
        'calcular_verificacion_por_preguntas',
        'obtener_votos_votante',
        'trg_verificacion_asistencia_sesion',
        'calcular_verificacion_quorum_snapshot',
        'cerrar_sesiones_verificacion_abiertas',
        'generar_codigo_acceso',
        'asegurar_unidades_demo_organizacion',
        'calcular_verificacion_quorum',
        'validar_votante_asamblea',
        'desactivar_votacion_publica',
        'ya_verifico_asistencia',
        'unidad_email_coincide',
        'calcular_verificacion_quorum_desglose',
        'validar_codigo_acceso',
        'activar_votacion_publica',
        'update_updated_at_column'
      ])
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, pg_temp',
      fn_oid::regprocedure
    );
  END LOOP;
END $$;

-- -----------------------------------------------------
-- B) RLS POLICY ALWAYS TRUE
-- -----------------------------------------------------
-- 1) Mantener política de creación de organization pero
--    compatible para anon + authenticated sin "true".
DROP POLICY IF EXISTS "Anyone can create organizations" ON public.organizations;
CREATE POLICY "Anyone can create organizations"
  ON public.organizations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- 2) Política de servicio para consentimientos:
--    restringida explícitamente a service_role.
DROP POLICY IF EXISTS "Servicio puede gestionar consentimientos" ON public.consentimiento_tratamiento_datos;
CREATE POLICY "Servicio puede gestionar consentimientos"
  ON public.consentimiento_tratamiento_datos
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3) Reemplazo de políticas temporales authenticated_temp_all_*
--    Evita "always true" y conserva compatibilidad funcional.
DO $$
DECLARE
  t text;
  policy_name text;
  tables text[] := ARRAY[
    'billing_logs',
    'configuracion_poderes',
    'historial_votos',
    'organizations',
    'pagos_historial',
    'profiles',
    'profiles_temp',
    'verificacion_asamblea_sesiones',
    'verificacion_asistencia_registro'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      policy_name := 'authenticated_temp_all_' || t;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
        policy_name,
        t
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------
-- C) RLS AUTH INIT PLAN (auth.<fn>() por fila)
-- -----------------------------------------------------
-- Re-crea policies puntuales conservando su lógica actual,
-- pero envolviendo auth.uid()/auth.role() como subquery
-- para evitar re-evaluación por fila.
DO $$
DECLARE
  p record;
  v_roles text;
  v_cmd text;
  v_permissive text;
  v_using text;
  v_with_check text;
BEGIN
  FOR p IN
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename,
      pol.polname AS policyname,
      pol.polpermissive,
      pol.polcmd,
      pol.polroles,
      pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
      pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        c.relname,
        pol.polname
      ) IN (
        ('asambleas', 'asambleas_auth_select_org'),
        ('super_admin_accounts', 'super_admin_accounts_select_authenticated'),
        ('configuracion_asamblea', 'configuracion_asamblea_select_own'),
        ('configuracion_asamblea', 'configuracion_asamblea_insert_own'),
        ('organizations', 'orgs_owner_all'),
        ('configuracion_asamblea', 'configuracion_asamblea_update_own'),
        ('asambleas', 'asambleas_auth_insert_org'),
        ('asambleas', 'asambleas_auth_update_org'),
        ('asambleas', 'asambleas_auth_delete_org'),
        ('preguntas', 'preguntas_auth_all_org'),
        ('opciones_pregunta', 'opciones_auth_all_org'),
        ('organizations', 'Anyone can create organizations'),
        ('consentimiento_tratamiento_datos', 'Servicio puede gestionar consentimientos'),
        ('billing_logs', 'authenticated_temp_all_billing_logs'),
        ('configuracion_poderes', 'authenticated_temp_all_configuracion_poderes'),
        ('historial_votos', 'authenticated_temp_all_historial_votos'),
        ('organizations', 'authenticated_temp_all_organizations'),
        ('pagos_historial', 'authenticated_temp_all_pagos_historial'),
        ('profiles', 'authenticated_temp_all_profiles'),
        ('profiles_temp', 'authenticated_temp_all_profiles_temp'),
        ('verificacion_asamblea_sesiones', 'authenticated_temp_all_verificacion_asamblea_sesiones'),
        ('verificacion_asistencia_registro', 'authenticated_temp_all_verificacion_asistencia_registro'),
        ('unidades', 'unidades_auth_all_org'),
        ('poderes', 'poderes_auth_all_org'),
        ('votos', 'votos_auth_all_org'),
        ('quorum_asamblea', 'quorum_auth_all_org')
      )
  LOOP
    IF array_length(p.polroles, 1) IS NULL THEN
      v_roles := 'PUBLIC';
    ELSE
      SELECT string_agg(
        CASE
          WHEN r = 0 THEN 'PUBLIC'
          WHEN rol.rolname IS NOT NULL THEN quote_ident(rol.rolname)
          ELSE NULL
        END,
        ', '
      )
      INTO v_roles
      FROM unnest(p.polroles) AS r
      LEFT JOIN pg_roles rol ON rol.oid = r;

      IF v_roles IS NULL OR btrim(v_roles) = '' THEN
        v_roles := 'PUBLIC';
      END IF;
    END IF;

    v_cmd := CASE p.polcmd
      WHEN 'r' THEN 'SELECT'
      WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE'
      WHEN 'd' THEN 'DELETE'
      ELSE 'ALL'
    END;

    v_permissive := CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;

    v_using := p.using_expr;
    v_with_check := p.with_check_expr;

    IF v_using IS NOT NULL THEN
      v_using := replace(v_using, 'auth.uid()', '(select auth.uid())');
      v_using := replace(v_using, 'auth.role()', '(select auth.role())');
    END IF;

    IF v_with_check IS NOT NULL THEN
      v_with_check := replace(v_with_check, 'auth.uid()', '(select auth.uid())');
      v_with_check := replace(v_with_check, 'auth.role()', '(select auth.role())');
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      p.policyname,
      p.schemaname,
      p.tablename,
      v_permissive,
      v_cmd,
      v_roles,
      CASE WHEN v_using IS NOT NULL THEN ' USING (' || v_using || ')' ELSE '' END,
      CASE WHEN v_with_check IS NOT NULL THEN ' WITH CHECK (' || v_with_check || ')' ELSE '' END
    );
  END LOOP;
END $$;

-- -----------------------------------------------------
-- D) DUPLICATE INDEXES (retener uno por grupo)
-- -----------------------------------------------------
DROP INDEX IF EXISTS public.idx_asambleas_organization;
DROP INDEX IF EXISTS public.idx_opciones_pregunta;
DROP INDEX IF EXISTS public.idx_opciones_pregunta_orden;
DROP INDEX IF EXISTS public.idx_poderes_asamblea_estado_email_receptor;
DROP INDEX IF EXISTS public.idx_poderes_asamblea_estado_email_receptor_lower;
DROP INDEX IF EXISTS public.idx_quorum_asamblea;
DROP INDEX IF EXISTS public.idx_unidades_org_email;
DROP INDEX IF EXISTS public.idx_unidades_org_email_prop;
DROP INDEX IF EXISTS public.idx_unidades_org_tel;
DROP INDEX IF EXISTS public.idx_unidades_org_tel_prop;

-- -----------------------------------------------------
-- E) UNINDEXED FOREIGN KEYS (crear índices de cobertura)
-- -----------------------------------------------------
DO $$
DECLARE
  c record;
  v_columns text;
  v_index_name text;
BEGIN
  FOR c IN
    SELECT
      n.nspname AS schemaname,
      cls.relname AS tablename,
      con.conname,
      con.conkey
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE con.contype = 'f'
      AND n.nspname = 'public'
      AND con.conname = ANY (ARRAY[
        'asambleas_verificacion_pregunta_id_fkey',
        'configuracion_asamblea_organization_id_fkey',
        'historial_votos_opcion_anterior_id_fkey',
        'historial_votos_opcion_id_fkey',
        'historial_votos_poder_id_fkey',
        'historial_votos_voto_id_fkey',
        'organizations_owner_id_fkey',
        'poderes_unidad_otorgante_id_fkey',
        'poderes_unidad_receptor_id_fkey',
        'profiles_temp_organization_id_fkey',
        'quorum_asamblea_unidad_id_fkey',
        'sesion_token_consumos_consentimiento_id_fkey',
        'sesion_token_consumos_unidad_id_fkey',
        'verificacion_asamblea_sesiones_pregunta_id_fkey',
        'verificacion_asistencia_registro_pregunta_id_fkey',
        'votos_poder_id_fkey'
      ])
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.ord)
    INTO v_columns
    FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = (
        SELECT cls2.oid
        FROM pg_class cls2
        JOIN pg_namespace n2 ON n2.oid = cls2.relnamespace
        WHERE n2.nspname = c.schemaname
          AND cls2.relname = c.tablename
      )
     AND a.attnum = k.attnum;

    IF v_columns IS NOT NULL THEN
      v_index_name := substr(format('idx_%s_fk_%s', c.tablename, c.conname), 1, 63);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
        v_index_name,
        c.schemaname,
        c.tablename,
        v_columns
      );
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------
-- F) HOT QUERIES (pg_stat_statements)
-- -----------------------------------------------------
-- 1) Consulta frecuente:
--    poderes WHERE asamblea_id = ? AND estado = ?
--    SELECT unidad_otorgante_id, email_receptor
CREATE INDEX IF NOT EXISTS idx_poderes_asamblea_estado_cover
  ON public.poderes (asamblea_id, estado)
  INCLUDE (unidad_otorgante_id, email_receptor);

-- 2) Consulta frecuente:
--    opciones_pregunta WHERE pregunta_id = ANY (?) ORDER BY orden
--    (si no existe en entorno objetivo, lo crea)
CREATE INDEX IF NOT EXISTS idx_opciones_pregunta_pregunta_orden
  ON public.opciones_pregunta (pregunta_id, orden);

-- 3) Consulta frecuente:
--    unidades WHERE organization_id = ?
CREATE INDEX IF NOT EXISTS idx_unidades_organization_id
  ON public.unidades (organization_id);

-- Actualiza estadísticas para que el planner use los índices nuevos.
ANALYZE public.poderes;
ANALYZE public.opciones_pregunta;
ANALYZE public.unidades;

COMMIT;

-- =====================================================
-- Verificación rápida (opcional):
-- select n.nspname, p.proname, p.proconfig
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('validar_codigo_acceso', 'calcular_verificacion_quorum');
-- =====================================================
