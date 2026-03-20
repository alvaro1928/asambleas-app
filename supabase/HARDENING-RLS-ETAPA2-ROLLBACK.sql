-- =====================================================
-- HARDENING RLS - ETAPA 2 ROLLBACK
-- =====================================================
-- Objetivo:
-- - Revertir ETAPA 2 (políticas finas core) al esquema de ETAPA 1
--   con políticas temporales authenticated_temp_all_*.
--
-- Alcance rollback:
-- - asambleas, preguntas, opciones_pregunta, unidades, poderes, votos, quorum_asamblea
-- =====================================================

BEGIN;

-- -----------------------------------------------------
-- 1) Limpiar políticas finas ETAPA 2
-- -----------------------------------------------------
DROP POLICY IF EXISTS asambleas_auth_select_org ON public.asambleas;
DROP POLICY IF EXISTS asambleas_auth_insert_org ON public.asambleas;
DROP POLICY IF EXISTS asambleas_auth_update_org ON public.asambleas;
DROP POLICY IF EXISTS asambleas_auth_delete_org ON public.asambleas;
DROP POLICY IF EXISTS asambleas_anon_select_publicas ON public.asambleas;

DROP POLICY IF EXISTS preguntas_auth_all_org ON public.preguntas;
DROP POLICY IF EXISTS preguntas_anon_select_publicas ON public.preguntas;

DROP POLICY IF EXISTS opciones_auth_all_org ON public.opciones_pregunta;
DROP POLICY IF EXISTS opciones_anon_select_publicas ON public.opciones_pregunta;

DROP POLICY IF EXISTS unidades_auth_all_org ON public.unidades;
DROP POLICY IF EXISTS unidades_anon_select_publicas_por_org ON public.unidades;

DROP POLICY IF EXISTS poderes_auth_all_org ON public.poderes;

DROP POLICY IF EXISTS votos_auth_all_org ON public.votos;
DROP POLICY IF EXISTS votos_anon_select_publicos ON public.votos;

DROP POLICY IF EXISTS quorum_auth_all_org ON public.quorum_asamblea;

-- -----------------------------------------------------
-- 2) Restaurar políticas temporales ETAPA 1 para authenticated
-- -----------------------------------------------------
DO $$
DECLARE
  t text;
  policy_name text;
  tables text[] := ARRAY[
    'asambleas',
    'preguntas',
    'opciones_pregunta',
    'unidades',
    'poderes',
    'votos',
    'quorum_asamblea'
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

COMMIT;

-- =====================================================
-- POST-ROLLBACK
-- =====================================================
-- Este rollback vuelve al modelo de ETAPA 1 (compatibilidad amplia).
-- Si luego quieres endurecer de nuevo, reaplica ETAPA 2 y ETAPA 3.
-- =====================================================

