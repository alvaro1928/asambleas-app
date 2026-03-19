-- =====================================================
-- CONFIGURACIÓN DE PREFERENCIAS DE ASAMBLEA POR USUARIO Y CONJUNTO
-- =====================================================
-- Permite mostrar/ocultar funcionalidades en la página de asamblea
-- y define el valor por defecto del cronómetro (minutos).
-- Sin fila = todo visible y cronómetro default 5 min.

CREATE TABLE IF NOT EXISTS configuracion_asamblea (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mostrar_quorum BOOLEAN DEFAULT true NOT NULL,
  mostrar_quorum_tarjetas BOOLEAN DEFAULT true NOT NULL,
  mostrar_quorum_historico BOOLEAN DEFAULT true NOT NULL,
  mostrar_delegado BOOLEAN DEFAULT true NOT NULL,
  mostrar_cronometro BOOLEAN DEFAULT true NOT NULL,
  mostrar_poderes BOOLEAN DEFAULT true NOT NULL,
  participacion_timer_default_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_configuracion_asamblea_user_org
  ON configuracion_asamblea(user_id, organization_id);

COMMENT ON TABLE configuracion_asamblea IS 'Preferencias de visualización de asamblea por usuario y conjunto; default del cronómetro (minutos)';
COMMENT ON COLUMN configuracion_asamblea.mostrar_quorum IS 'Mostrar panel Quórum y bloque Verificación de quórum en Acceso';
COMMENT ON COLUMN configuracion_asamblea.mostrar_quorum_tarjetas IS 'Dentro del panel Quórum: mostrar tarjetas (participación, coeficiente, pendientes, asistencia verificada)';
COMMENT ON COLUMN configuracion_asamblea.mostrar_quorum_historico IS 'Dentro del panel Quórum: mostrar historial de validaciones de quórum';
COMMENT ON COLUMN configuracion_asamblea.mostrar_delegado IS 'Mostrar card Acceso de asistente delegado';
COMMENT ON COLUMN configuracion_asamblea.mostrar_cronometro IS 'Mostrar card Cronómetro transversal';
COMMENT ON COLUMN configuracion_asamblea.mostrar_poderes IS 'Mostrar bloque Gestión de Poderes';
COMMENT ON COLUMN configuracion_asamblea.participacion_timer_default_minutes IS 'Minutos por defecto del cronómetro (1-180); se configura en Configuración, en asamblea solo activar/pausar/reiniciar';

ALTER TABLE configuracion_asamblea ENABLE ROW LEVEL SECURITY;

CREATE POLICY configuracion_asamblea_select_own
  ON configuracion_asamblea FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY configuracion_asamblea_insert_own
  ON configuracion_asamblea FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY configuracion_asamblea_update_own
  ON configuracion_asamblea FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
