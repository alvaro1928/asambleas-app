-- =============================================================================
-- Resetear todos los tokens de todos los gestores a 80 (valor inicial de prueba).
-- Ejecutar en Supabase → SQL Editor cuando quieras dejar todas las cuentas en 80.
-- =============================================================================

-- Todas las filas de profiles quedan con 80 tokens.
UPDATE profiles
SET tokens_disponibles = 80;

-- Verificar (opcional):
-- SELECT id, user_id, email, tokens_disponibles FROM profiles ORDER BY tokens_disponibles DESC;
