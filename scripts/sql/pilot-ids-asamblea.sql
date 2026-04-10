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

-- 4) Referencia (snapshot piloto — validar en BD si cambian preguntas/opciones)
--    pregunta_id: f4c607cc-a33d-4235-9464-ab432d227046  |  texto: test
--    opciones:
--      1572d107-ff19-4a2f-afed-0dcd944fed41  orden 1  A favor
--      bdf47914-c999-4bf1-b6c8-54fe1fa700ae  orden 2  En contra
--      73e41e16-51f7-48be-82b6-8fe96599973b  orden 3  Me abstengo
--    Para stress /api/votar suele usarse la opción orden 1 (A favor), salvo que pruebes otra.
