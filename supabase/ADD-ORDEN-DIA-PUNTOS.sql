-- =====================================================
-- ORDEN DEL DÍA: puntos formales + asociación a preguntas
-- Ejecutar en Supabase SQL Editor (idempotente donde aplica).
-- =====================================================

-- 1) Tabla de puntos del orden del día por asamblea
CREATE TABLE IF NOT EXISTS public.puntos_orden_dia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asamblea_id UUID NOT NULL REFERENCES public.asambleas(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL DEFAULT 1,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_puntos_orden_dia_asamblea_orden
  ON public.puntos_orden_dia(asamblea_id, orden);

COMMENT ON TABLE public.puntos_orden_dia IS 'Puntos del orden del día (agenda); las preguntas pueden asociarse opcionalmente a un punto.';

-- 2) Preguntas: FK opcional a punto
ALTER TABLE public.preguntas
  ADD COLUMN IF NOT EXISTS punto_orden_dia_id UUID REFERENCES public.puntos_orden_dia(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_preguntas_punto_orden_dia_id
  ON public.preguntas(punto_orden_dia_id)
  WHERE punto_orden_dia_id IS NOT NULL;

COMMENT ON COLUMN public.preguntas.punto_orden_dia_id IS 'Punto del orden del día bajo el cual se debate/vota (opcional).';

-- 3) Asamblea: punto actual de sesión (mesa/admin)
ALTER TABLE public.asambleas
  ADD COLUMN IF NOT EXISTS punto_orden_dia_actual_id UUID REFERENCES public.puntos_orden_dia(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.asambleas.punto_orden_dia_actual_id IS 'Punto del orden del día en curso durante la sesión (UI pública y panel).';

-- 4) RLS
ALTER TABLE public.puntos_orden_dia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS puntos_orden_dia_auth_all_org ON public.puntos_orden_dia;
CREATE POLICY puntos_orden_dia_auth_all_org
  ON public.puntos_orden_dia
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE a.id = puntos_orden_dia.asamblea_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      JOIN public.profiles p ON p.organization_id = a.organization_id
      WHERE a.id = puntos_orden_dia.asamblea_id
        AND (p.id = auth.uid() OR p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS puntos_orden_dia_anon_select_publicas ON public.puntos_orden_dia;
CREATE POLICY puntos_orden_dia_anon_select_publicas
  ON public.puntos_orden_dia
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.asambleas a
      WHERE a.id = puntos_orden_dia.asamblea_id
        AND a.acceso_publico = true
    )
  );

GRANT SELECT ON public.puntos_orden_dia TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.puntos_orden_dia TO authenticated;

-- 5) Validar que punto_orden_dia_id pertenezca a la misma asamblea (defensa en profundidad)
CREATE OR REPLACE FUNCTION public.preguntas_punto_misma_asamblea()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.punto_orden_dia_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.puntos_orden_dia pod
    WHERE pod.id = NEW.punto_orden_dia_id AND pod.asamblea_id = NEW.asamblea_id
  ) THEN
    RAISE EXCEPTION 'punto_orden_dia_id debe pertenecer a la misma asamblea';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preguntas_punto_misma_asamblea ON public.preguntas;
CREATE TRIGGER trg_preguntas_punto_misma_asamblea
  BEFORE INSERT OR UPDATE OF punto_orden_dia_id, asamblea_id ON public.preguntas
  FOR EACH ROW
  EXECUTE PROCEDURE public.preguntas_punto_misma_asamblea();

CREATE OR REPLACE FUNCTION public.asambleas_punto_actual_misma_asamblea()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.punto_orden_dia_actual_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.puntos_orden_dia pod
    WHERE pod.id = NEW.punto_orden_dia_actual_id AND pod.asamblea_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'punto_orden_dia_actual_id debe pertenecer a esta asamblea';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asambleas_punto_actual_misma_asamblea ON public.asambleas;
CREATE TRIGGER trg_asambleas_punto_actual_misma_asamblea
  BEFORE INSERT OR UPDATE OF punto_orden_dia_actual_id ON public.asambleas
  FOR EACH ROW
  EXECUTE PROCEDURE public.asambleas_punto_actual_misma_asamblea();
