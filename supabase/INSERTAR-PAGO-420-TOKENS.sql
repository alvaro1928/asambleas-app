-- Insertar manualmente el pago de 420 tokens que no quedó en pagos_log.
-- Transacción Wompi: 12026427-1770172113-90443 | 63.000.000 centavos = $630.000 COP
-- Ejecutar en Supabase → SQL Editor.
-- Si tu conjunto es otro, cambia organization_id por el UUID de tu organización (Malaga, etc.).

INSERT INTO pagos_log (
  id,
  organization_id,
  monto,
  wompi_transaction_id,
  estado,
  created_at
) VALUES (
  gen_random_uuid(),
  '634f5861-aa6b-40a6-8d3f-3f1c5380cd85',  -- mismo conjunto del pago anterior (cambia si es otro)
  63000000,                                  -- 630.000 COP en centavos
  '12026427-1770172113-90443',
  'APPROVED',
  '2026-02-04 02:28:36+00'                  -- fecha de la transacción en Wompi
);

-- No ejecutes dos veces o quedarán dos filas. Si ya existe una fila con wompi_transaction_id = '12026427-1770172113-90443', no hace falta.
