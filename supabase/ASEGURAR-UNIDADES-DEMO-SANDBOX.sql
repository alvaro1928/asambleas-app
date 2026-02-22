-- =====================================================
-- Unidades demo SOLO para sandbox (no se mezclan con productivas)
-- =====================================================
-- Las unidades de demostración (test1@...test10@asambleas.online) son
-- exclusivas del entorno de pruebas. No existen en "unidades normales" y
-- no deben usarse en asambleas reales/productivas.
--
-- Este script:
-- 1) Crea la función que asegura las 10 unidades demo por organización
--    (inserta si no existen, solo para esa org y con is_demo = true).
-- 2) Actualiza validar_votante_asamblea para que, en asambleas demo con
--    "Unidades de demostración", si no encuentra unidades demo, las cree
--    y vuelva a validar.
-- =====================================================

-- Asegurar columnas en unidades (por si faltan en algún entorno)
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS email_propietario TEXT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS nombre_propietario TEXT;
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- Función: asegurar_unidades_demo_organizacion
-- Inserta las 10 unidades de demostración para una organización
-- si no existen. Solo se usan en sandbox (is_demo = true).
-- No afecta unidades reales (is_demo = false).
-- =====================================================
CREATE OR REPLACE FUNCTION asegurar_unidades_demo_organizacion(p_organization_id UUID)
RETURNS void AS $$
DECLARE
  v_numero TEXT;
  v_email TEXT;
  v_nombre TEXT;
  i INT;
BEGIN
  FOR i IN 1..10 LOOP
    v_numero := (100 + i)::TEXT;  -- 101..110
    v_email := 'test' || i || '@asambleas.online';
    v_nombre := 'Apto ' || v_numero;

    BEGIN
      INSERT INTO unidades (
        organization_id,
        torre,
        numero,
        coeficiente,
        tipo,
        nombre_propietario,
        propietario,
        email,
        email_propietario,
        is_demo
      ) VALUES (
        p_organization_id,
        'Demo',
        v_numero,
        10,
        'apartamento',
        v_nombre,
        v_nombre,
        v_email,
        v_email,
        true
      );
    EXCEPTION WHEN unique_violation THEN
      -- Ya existe (org, torre, numero) o (org, numero): actualizar email/is_demo
      UPDATE unidades
      SET email = v_email,
          email_propietario = v_email,
          nombre_propietario = v_nombre,
          propietario = v_nombre,
          is_demo = true,
          updated_at = TIMEZONE('utc', NOW())
      WHERE organization_id = p_organization_id
        AND ( (torre = 'Demo' AND numero = v_numero) OR (torre IS NULL AND numero = v_numero) )
        AND is_demo = true;
      IF NOT FOUND THEN
        -- Fila existe pero no es demo: no sobrescribir unidades reales
        NULL;
      END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION asegurar_unidades_demo_organizacion(UUID) IS
  'Crea o actualiza las 10 unidades de demostración (test1@...test10@asambleas.online) para una organización. Solo sandbox; no mezcla con unidades productivas.';
