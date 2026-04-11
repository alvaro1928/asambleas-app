-- Insertar una pregunta nueva con opciones estándar (A favor, En contra, Me abstengo).
-- Supabase → SQL Editor: edita v_asamblea y v_texto en el bloque DO y ejecuta.

DO $$
DECLARE
  v_asamblea uuid := '967b8219-a731-4a27-b16c-289044a19cc5';  -- UUID de la asamblea
  v_texto text := 'Nueva pregunta';  -- Texto de la pregunta
  v_orden int;
  v_pregunta_id uuid;
BEGIN
  SELECT COALESCE(MAX(orden), 0) + 1 INTO v_orden
  FROM public.preguntas
  WHERE asamblea_id = v_asamblea;

  INSERT INTO public.preguntas (
    asamblea_id,
    orden,
    texto_pregunta,
    tipo_votacion,
    estado,
    is_archived
  )
  VALUES (
    v_asamblea,
    v_orden,
    v_texto,
    'coeficiente',
    'pendiente',
    false
  )
  RETURNING id INTO v_pregunta_id;

  INSERT INTO public.opciones_pregunta (pregunta_id, texto_opcion, orden, color)
  VALUES
    (v_pregunta_id, 'A favor', 1, '#10b981'),
    (v_pregunta_id, 'En contra', 2, '#ef4444'),
    (v_pregunta_id, 'Me abstengo', 3, '#6b7280');

  RAISE NOTICE 'pregunta_id = %', v_pregunta_id;
END $$;

-- Ver preguntas y opciones:
-- SELECT p.id, p.orden, p.texto_pregunta, o.id AS opcion_id, o.orden AS op_orden, o.texto_opcion
-- FROM public.preguntas p
-- LEFT JOIN public.opciones_pregunta o ON o.pregunta_id = p.id
-- WHERE p.asamblea_id = '967b8219-a731-4a27-b16c-289044a19cc5'
-- ORDER BY p.orden, o.orden;
