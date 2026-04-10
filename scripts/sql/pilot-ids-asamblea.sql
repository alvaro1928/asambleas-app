-- Copiar y ejecutar en Supabase → SQL Editor (solo lectura).
-- Asamblea piloto (reemplaza si cambia el id).
-- 967b8219-a731-4a27-b16c-289044a19cc5

-- 1) Preguntas de la asamblea (elige la fila con estado = 'abierta' para votar en producción)
SELECT
  p.id AS pregunta_id,
  p.orden,
  p.texto_pregunta,
  p.estado,
  p.tipo_votacion,
  COALESCE(p.is_archived, false) AS is_archived
FROM public.preguntas p
WHERE p.asamblea_id = '967b8219-a731-4a27-b16c-289044a19cc5'
ORDER BY p.orden;

-- 2) Opciones por pregunta (necesitas opcion_id para POST /api/votar)
SELECT
  o.id AS opcion_id,
  o.pregunta_id,
  o.orden,
  o.texto_opcion
FROM public.opciones_pregunta o
INNER JOIN public.preguntas pr ON pr.id = o.pregunta_id
WHERE pr.asamblea_id = '967b8219-a731-4a27-b16c-289044a19cc5'
ORDER BY pr.orden, o.orden;

-- 3) (Opcional) Verificación rápida: asamblea y organización
SELECT id, nombre, estado, is_demo, sandbox_usar_unidades_reales, organization_id
FROM public.asambleas
WHERE id = '967b8219-a731-4a27-b16c-289044a19cc5';
