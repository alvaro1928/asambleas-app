-- =====================================================
-- Trigger: crear perfil al registrarse (auth.users)
-- =====================================================
-- Tras la confirmación de email, el usuario tendrá una fila en profiles
-- para que el sistema (billetera, demo, etc.) funcione desde el primer acceso.
-- Ejecutar después de migraciones que añadan user_id y tokens_disponibles.
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NULLIF(TRIM(v_name), ''))
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(TRIM(EXCLUDED.full_name), ''), profiles.full_name);
  -- Si la tabla tiene user_id, actualizarlo
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    UPDATE public.profiles SET user_id = NEW.id WHERE id = NEW.id AND (user_id IS NULL OR user_id != NEW.id);
  END IF;
  -- Si la tabla tiene tokens_disponibles, asegurar 50 para nuevos
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tokens_disponibles'
  ) THEN
    UPDATE public.profiles
    SET tokens_disponibles = 50
    WHERE id = NEW.id AND (tokens_disponibles IS NULL OR tokens_disponibles < 0);
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 'Crea o actualiza perfil en public.profiles cuando se registra un nuevo usuario.';
