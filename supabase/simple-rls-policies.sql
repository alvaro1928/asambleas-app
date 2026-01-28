-- Script SIMPLIFICADO para políticas RLS sin recursión
-- Este es el enfoque más simple y seguro
-- Ejecuta este script en Supabase SQL Editor

-- =====================================================
-- PASO 1: LIMPIAR TODAS LAS POLÍTICAS EXISTENTES
-- =====================================================

-- Eliminar todas las políticas de organizations
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Owners and admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Owners can delete their organization" ON organizations;
DROP POLICY IF EXISTS "Users can update their organization" ON organizations;
DROP POLICY IF EXISTS "Users can delete their organization" ON organizations;

-- Eliminar todas las políticas de profiles
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins and owners can update profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Owners can delete profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update organization profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete organization profiles" ON profiles;

-- =====================================================
-- PASO 2: CREAR POLÍTICAS SIMPLES SIN RECURSIÓN
-- =====================================================

-- ============ POLICIES PARA ORGANIZATIONS ============

-- Cualquiera puede crear una organización (para el registro inicial)
CREATE POLICY "Anyone can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (true);

-- Ver organizaciones: solo si eres miembro (comparación directa, sin subconsulta)
CREATE POLICY "Users can view organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Actualizar organizaciones: solo owners y admins
CREATE POLICY "Owners and admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT DISTINCT organization_id 
      FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Eliminar organizaciones: solo owners
CREATE POLICY "Owners can delete organizations"
  ON organizations FOR DELETE
  USING (
    id IN (
      SELECT DISTINCT organization_id 
      FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'owner'
    )
  );

-- ============ POLICIES PARA PROFILES ============

-- Crear perfil: solo tu propio perfil
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Ver perfil: tu propio perfil siempre
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Actualizar perfil: tu propio perfil siempre
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Ver otros perfiles: si están en tu misma organización
-- IMPORTANTE: Usamos una función auxiliar para evitar recursión
CREATE OR REPLACE FUNCTION get_user_organization()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE POLICY "Users can view org profiles"
  ON profiles FOR SELECT
  USING (
    organization_id IS NOT NULL 
    AND organization_id = get_user_organization()
  );

-- Eliminar perfil: solo tu propio perfil
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (id = auth.uid());
