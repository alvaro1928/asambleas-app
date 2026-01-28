-- ====================================================================
-- SCRIPT PARA HABILITAR RLS EN PRODUCCIÓN
-- ====================================================================
-- Ejecuta este script SOLO cuando vayas a producción
-- Primero asegúrate de que tu app funciona correctamente en desarrollo
-- ====================================================================

-- PASO 1: Habilitar RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- PASO 2: Crear políticas SIMPLES y SEGURAS
-- ====================================================================

-- ============ ORGANIZATIONS ============

-- Cualquiera autenticado puede crear una organización
CREATE POLICY "enable_insert_for_authenticated_users"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Los usuarios ven organizaciones donde tienen un perfil
-- NOTA: Esta política es simple y no causa recursión porque
-- no consulta profiles dentro de una política de profiles
CREATE POLICY "enable_select_for_users"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.organization_id = organizations.id
      AND profiles.id = auth.uid()
    )
  );

-- Los owners y admins pueden actualizar
CREATE POLICY "enable_update_for_owners_and_admins"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.organization_id = organizations.id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Los owners pueden eliminar
CREATE POLICY "enable_delete_for_owners"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.organization_id = organizations.id
      AND profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- ============ PROFILES ============

-- Crear perfil: solo el tuyo
CREATE POLICY "enable_insert_for_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Ver perfil: solo el tuyo (simple, sin recursión)
CREATE POLICY "enable_select_for_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Actualizar perfil: solo el tuyo
CREATE POLICY "enable_update_for_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Eliminar perfil: solo el tuyo
CREATE POLICY "enable_delete_for_own_profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- ============ UNIDADES ============

-- Ver unidades de tu organización
CREATE POLICY "enable_select_for_org_members"
  ON unidades FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.organization_id = unidades.organization_id
      AND profiles.id = auth.uid()
    )
  );

-- Owners y admins pueden crear unidades
CREATE POLICY "enable_insert_for_owners_and_admins"
  ON unidades FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.organization_id = unidades.organization_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Owners y admins pueden actualizar unidades
CREATE POLICY "enable_update_for_owners_and_admins"
  ON unidades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.organization_id = unidades.organization_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Owners pueden eliminar unidades
CREATE POLICY "enable_delete_for_owners"
  ON unidades FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.organization_id = unidades.organization_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- ====================================================================
-- VERIFICACIÓN
-- ====================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Habilitado",
    (SELECT COUNT(*) FROM pg_policies WHERE pg_policies.tablename = pg_tables.tablename) as "Num Políticas"
FROM pg_tables 
WHERE tablename IN ('organizations', 'profiles', 'unidades')
ORDER BY tablename;
