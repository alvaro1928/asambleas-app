-- =============================================================================
-- Unificar saldo: asignar tokens del perfil "fantasma" (UUID sin email) a tu cuenta
-- =============================================================================
-- Cuando Wompi acredita a una fila de perfil sin email, los créditos quedan
-- asociados a un UUID y tu billetera sigue mostrando el saldo viejo.
-- Este script reparenta esas filas a tu usuario (por email) y unifica el saldo.
--
-- Cómo usar:
-- 1. En Supabase → SQL Editor, pega este script.
-- 2. Reemplaza v_email por tu correo y v_ghost_id por el UUID que sale en el
--    ranking (ej. 408b17ee-95d8-4bdb-9ee9-0f9afe574875).
-- 3. Ejecuta. Luego recarga el dashboard; la billetera debería mostrar el
--    saldo unificado (máximo de todos tus perfiles).
-- =============================================================================

DO $$
DECLARE
  v_email     TEXT := 'alvarocontreras35@gmail.com';   -- tu correo (cuenta que debe quedarse con los créditos)
  v_ghost_id  UUID := '408b17ee-95d8-4bdb-9ee9-0f9afe574875';  -- UUID que aparece en ranking con los 1000+ tokens
  v_auth_id   UUID;
  v_max_tokens INT;
  v_updated   INT;
BEGIN
  -- 1) Obtener el auth id del usuario con ese email
  SELECT id INTO v_auth_id FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró usuario en Auth con email "%". Revisa v_email.', v_email;
  END IF;

  -- 2) Reparentar: filas con id = ghost o user_id = ghost pasan a user_id = tu auth id
  --    (así tu sesión verá esos perfiles y el saldo se unifica)
  UPDATE profiles
  SET user_id = v_auth_id
  WHERE id = v_ghost_id OR user_id = v_ghost_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- 3) Saldo unificado = máximo de todos los perfiles de tu usuario
  SELECT COALESCE(MAX(tokens_disponibles), 0)::INT INTO v_max_tokens
  FROM profiles
  WHERE user_id = v_auth_id OR id = v_auth_id;

  UPDATE profiles
  SET tokens_disponibles = v_max_tokens
  WHERE user_id = v_auth_id OR id = v_auth_id;

  RAISE NOTICE 'Listo. Filas reparentadas: %. Saldo unificado para %: % tokens.', v_updated, v_email, v_max_tokens;
END $$;

-- Si tu tabla profiles NO tiene columna user_id, usa solo esta parte (sustituye el UUID y el email):
-- UPDATE profiles
-- SET tokens_disponibles = (SELECT MAX(tokens_disponibles) FROM profiles p2 WHERE p2.id = (SELECT id FROM auth.users WHERE email = 'alvarocontreras35@gmail.com' LIMIT 1) OR p2.user_id = (SELECT id FROM auth.users WHERE email = 'alvarocontreras35@gmail.com' LIMIT 1))
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'alvarocontreras35@gmail.com' LIMIT 1)
--    OR user_id = (SELECT id FROM auth.users WHERE email = 'alvarocontreras35@gmail.com' LIMIT 1);
