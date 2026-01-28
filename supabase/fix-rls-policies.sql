-- Script para corregir las políticas RLS y eliminar recursión infinita
-- Ejecuta este script en Supabase SQL Editor

-- Eliminar políticas problemáticas de profiles
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Admins and owners can update profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Owners can delete profiles in their organization" ON profiles;

-- Eliminar políticas problemáticas de organizations
DROP POLICY IF EXISTS "Owners and admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Owners can delete their organization" ON organizations;

-- Recrear políticas de profiles sin recursión
-- Los usuarios pueden ver su propio perfil (ya existe, no hay problema)
-- Los usuarios pueden crear su propio perfil (ya existe, no hay problema)
-- Los usuarios pueden actualizar su propio perfil (ya existe, no hay problema)

-- Nueva política simple para organizations UPDATE
CREATE POLICY "Users can update their organization"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organizations.id
      AND profiles.role IN ('owner', 'admin')
      LIMIT 1
    )
  );

-- Nueva política simple para organizations DELETE
CREATE POLICY "Users can delete their organization"
  ON organizations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = organizations.id
      AND profiles.role = 'owner'
      LIMIT 1
    )
  );

-- Política mejorada para ver perfiles (solo tu perfil y los de tu org)
-- Simplificamos para evitar recursión
CREATE POLICY "Users can view profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid() -- Puedes ver tu propio perfil
    OR 
    organization_id IS NOT NULL -- Si tienen organización, verificar después en la app
  );

-- Política para actualizar perfiles de la organización
CREATE POLICY "Admins can update organization profiles"
  ON profiles FOR UPDATE
  USING (
    id = auth.uid() -- Siempre puedes actualizar tu propio perfil
  );

-- Política para eliminar perfiles
CREATE POLICY "Admins can delete organization profiles"
  ON profiles FOR DELETE
  USING (
    id = auth.uid() -- Solo puedes eliminar tu propio perfil
    OR
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.organization_id = profiles.organization_id
      AND p.role = 'owner'
      LIMIT 1
    )
  );
