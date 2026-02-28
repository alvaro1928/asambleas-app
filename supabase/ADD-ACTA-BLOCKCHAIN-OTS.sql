-- =====================================================
-- Certificación blockchain del acta (OpenTimestamps)
-- Activable/desactivable desde Super Admin → Ajustes.
-- =====================================================

-- 1. Configuración global: activar o no la certificación al generar el acta
ALTER TABLE configuracion_global
  ADD COLUMN IF NOT EXISTS acta_blockchain_ots_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN configuracion_global.acta_blockchain_ots_enabled IS 'Si true, al generar el acta se sella con OpenTimestamps (Bitcoin) y se guarda la prueba .ots. Editable en Super Admin → Ajustes.';

-- 2. En asambleas: guardar la prueba .ots (base64) una vez certificado el acta
ALTER TABLE asambleas
  ADD COLUMN IF NOT EXISTS acta_ots_proof_base64 TEXT;

COMMENT ON COLUMN asambleas.acta_ots_proof_base64 IS 'Prueba OpenTimestamps (.ots) en base64 para verificación en opentimestamps.org. Se rellena al generar el acta si acta_blockchain_ots_enabled está activo.';
