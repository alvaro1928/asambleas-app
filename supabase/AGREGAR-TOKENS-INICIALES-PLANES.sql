-- =====================================================
-- tokens_iniciales en planes: cuántos tokens tiene el
-- conjunto al tener ese plan (Gratis 2, Pilot 10, Pro ilimitado = null).
-- =====================================================

ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS tokens_iniciales INTEGER DEFAULT NULL;

COMMENT ON COLUMN planes.tokens_iniciales IS 'Tokens que se asignan al conjunto al tener este plan. NULL = ilimitado (Pro).';

UPDATE planes SET tokens_iniciales = 2  WHERE key = 'free';
UPDATE planes SET tokens_iniciales = 10 WHERE key = 'pilot';
UPDATE planes SET tokens_iniciales = NULL WHERE key = 'pro';

-- Opcional: dar 2 tokens a conjuntos free que tienen 0
UPDATE organizations o
SET tokens_disponibles = 2
FROM planes p
WHERE p.key = 'free' AND o.plan_type = 'free' AND (o.tokens_disponibles IS NULL OR o.tokens_disponibles < 2);
