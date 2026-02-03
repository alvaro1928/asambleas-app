-- =====================================================
-- Sincronizar tokens_disponibles por GESTOR (billetera única)
-- Los tokens son por gestor, no por conjunto. Todas las filas
-- de profiles del mismo usuario deben tener el mismo saldo.
-- Ejecutar en Supabase SQL Editor si ves saldos distintos al cambiar de conjunto.
-- =====================================================

-- Opción A: Si tu tabla profiles tiene columna user_id (un usuario, varias filas por conjunto)
UPDATE profiles p
SET tokens_disponibles = sub.max_tokens
FROM (
  SELECT user_id, MAX(tokens_disponibles) AS max_tokens
  FROM profiles
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) sub
WHERE p.user_id = sub.user_id
  AND (p.tokens_disponibles IS DISTINCT FROM sub.max_tokens);

-- Opción B: Si tu tabla solo tiene id (id = auth.uid, una fila por usuario) no hace falta nada.
-- Si tienes ambas (id y user_id) y varios conjuntos por usuario, Opción A ya unifica por user_id.

-- Ver resultado (mismo usuario debe tener mismo saldo en todas sus filas):
-- SELECT user_id, organization_id, tokens_disponibles FROM profiles WHERE user_id IS NOT NULL ORDER BY user_id, organization_id;
