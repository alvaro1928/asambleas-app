-- Ver registros de pagos (pagos_log) en la BD
-- Ejecutar en Supabase → SQL Editor
-- Nota: Si ya ejecutaste ADD-USER-ID-PAGOS-LOG.sql, puedes añadir user_id al SELECT.

-- 1) Todos los registros recientes (últimos 50)
SELECT
  id,
  organization_id,
  monto,
  monto / 100.0 AS monto_cop,
  wompi_transaction_id,
  estado,
  created_at
FROM pagos_log
ORDER BY created_at DESC
LIMIT 50;

-- 2) Por ID de transacción Wompi (ej. el pago de 420 tokens)
-- SELECT * FROM pagos_log
-- WHERE wompi_transaction_id = '12026427-1770172113-90443';

-- 3) Por user_id (solo si ejecutaste ADD-USER-ID-PAGOS-LOG.sql)
-- SELECT * FROM pagos_log
-- WHERE user_id = '408b17ee-95d8-4bdb-9ee9-0f9afe574875'
-- ORDER BY created_at DESC;

-- 4) Con nombre del conjunto (si tiene organization_id)
-- SELECT
--   pl.id,
--   pl.monto / 100.0 AS monto_cop,
--   pl.wompi_transaction_id,
--   pl.estado,
--   pl.created_at,
--   o.name AS conjunto
-- FROM pagos_log pl
-- LEFT JOIN organizations o ON o.id = pl.organization_id
-- ORDER BY pl.created_at DESC
-- LIMIT 50;
