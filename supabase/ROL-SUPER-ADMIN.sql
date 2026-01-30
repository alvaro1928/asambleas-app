-- =====================================================
-- ROL SUPER_ADMIN: acceso total sin depender de conjunto
-- =====================================================
-- 1. Tabla de configuración con el correo del super admin
-- 2. Función is_super_admin() para usar en RLS
-- 3. Políticas que permiten al super admin SELECT/INSERT/UPDATE/DELETE en todas las tablas
--
-- Después de ejecutar: actualiza el correo con
--   UPDATE app_config SET value = 'tu@correo.com' WHERE key = 'super_admin_email';
-- (reemplaza TU_CORREO_AQUÍ por tu correo real)
-- =====================================================

-- 1. Tabla de configuración (si no existe)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Insertar placeholder; si ya existe no se sobrescribe
INSERT INTO app_config (key, value)
VALUES ('super_admin_email', 'TU_CORREO_AQUÍ')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE app_config IS 'Configuración de aplicación; super_admin_email define el correo del super administrador. No exponer esta tabla al cliente.';

-- 2. Función que comprueba si el usuario actual es super admin (por email en JWT)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) =
    (SELECT LOWER(TRIM(value)) FROM public.app_config WHERE key = 'super_admin_email' LIMIT 1);
$$;

COMMENT ON FUNCTION public.is_super_admin() IS 'True si el email del usuario actual (JWT) coincide con app_config.super_admin_email';

-- 3. Políticas de bypass para super admin (acceso total sin importar organization_id)
-- Organizations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'super_admin_full_organizations') THEN
    CREATE POLICY "super_admin_full_organizations"
      ON organizations FOR ALL
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- Profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'super_admin_full_profiles') THEN
    CREATE POLICY "super_admin_full_profiles"
      ON profiles FOR ALL
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- Unidades
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unidades' AND policyname = 'super_admin_full_unidades') THEN
    CREATE POLICY "super_admin_full_unidades"
      ON unidades FOR ALL
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $$;

-- Asambleas (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asambleas')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asambleas' AND policyname = 'super_admin_full_asambleas') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_asambleas" ON asambleas FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- Preguntas (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'preguntas')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'preguntas' AND policyname = 'super_admin_full_preguntas') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_preguntas" ON preguntas FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- Opciones de pregunta (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'opciones_pregunta')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opciones_pregunta' AND policyname = 'super_admin_full_opciones_pregunta') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_opciones_pregunta" ON opciones_pregunta FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- Votos (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'votos')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'votos' AND policyname = 'super_admin_full_votos') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_votos" ON votos FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- Historial votos (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historial_votos')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'historial_votos' AND policyname = 'super_admin_full_historial_votos') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_historial_votos" ON historial_votos FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- Poderes (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'poderes')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'poderes' AND policyname = 'super_admin_full_poderes') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_poderes" ON poderes FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- Quorum asamblea (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quorum_asamblea')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quorum_asamblea' AND policyname = 'super_admin_full_quorum_asamblea') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_quorum_asamblea" ON quorum_asamblea FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- Config poderes (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'config_poderes')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'config_poderes' AND policyname = 'super_admin_full_config_poderes') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_config_poderes" ON config_poderes FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- Pagos historial (si la tabla existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pagos_historial')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pagos_historial' AND policyname = 'super_admin_full_pagos_historial') THEN
    EXECUTE 'CREATE POLICY "super_admin_full_pagos_historial" ON pagos_historial FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';
  END IF;
END $$;

-- =====================================================
-- IMPORTANTE: después de ejecutar este script, actualiza el correo:
--   UPDATE app_config SET value = 'tu@correo.com' WHERE key = 'super_admin_email';
-- Y configura la misma dirección en .env como SUPER_ADMIN_EMAIL=tu@correo.com
-- =====================================================
