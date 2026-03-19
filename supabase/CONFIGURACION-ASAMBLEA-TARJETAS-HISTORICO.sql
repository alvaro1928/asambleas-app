-- Añadir opciones para mostrar/ocultar tarjetas de quórum e historial (Configuración → Asamblea)
-- Ejecutar después de CONFIGURACION-ASAMBLEA.sql

ALTER TABLE configuracion_asamblea
  ADD COLUMN IF NOT EXISTS mostrar_quorum_tarjetas BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS mostrar_quorum_historico BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN configuracion_asamblea.mostrar_quorum_tarjetas IS 'Dentro del panel Quórum: mostrar las tarjetas (participación, coeficiente, pendientes, asistencia verificada)';
COMMENT ON COLUMN configuracion_asamblea.mostrar_quorum_historico IS 'Dentro del panel Quórum: mostrar el historial de validaciones de quórum (asamblea en general)';
