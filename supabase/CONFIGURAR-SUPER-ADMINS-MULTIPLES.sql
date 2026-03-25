-- =====================================================
-- Super Admins multiples gestionados desde la app
-- =====================================================

CREATE TABLE IF NOT EXISTS public.super_admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by_email TEXT,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS idx_super_admin_accounts_email ON public.super_admin_accounts (email);
CREATE INDEX IF NOT EXISTS idx_super_admin_accounts_active ON public.super_admin_accounts (active);

ALTER TABLE public.super_admin_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_accounts_select_authenticated" ON public.super_admin_accounts;
CREATE POLICY "super_admin_accounts_select_authenticated"
  ON public.super_admin_accounts
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "super_admin_accounts_no_direct_write" ON public.super_admin_accounts;
CREATE POLICY "super_admin_accounts_no_direct_write"
  ON public.super_admin_accounts
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.super_admin_accounts IS 'Listado de super admins adicionales gestionables desde la app.';
COMMENT ON COLUMN public.super_admin_accounts.email IS 'Correo del super admin adicional.';
COMMENT ON COLUMN public.super_admin_accounts.active IS 'Si está inactivo no tendrá acceso al panel de super admin.';
