-- =====================================================
-- vigencia_meses en planes: duración del plan al asignar
-- (Gratis = null, Piloto = 3, Pro = 12). Parametrizable en Super Admin.
-- =====================================================

ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS vigencia_meses INTEGER DEFAULT NULL;

COMMENT ON COLUMN planes.vigencia_meses IS 'Duración en meses al asignar este plan a una cuenta. NULL = sin vigencia (Gratis) o ilimitado.';

UPDATE planes SET vigencia_meses = NULL WHERE key = 'free';
UPDATE planes SET vigencia_meses = 3  WHERE key = 'pilot';
UPDATE planes SET vigencia_meses = 12 WHERE key = 'pro';
