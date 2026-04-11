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
--    pregunta_id: 4ce21e5e-9c1f-45ca-87fa-29b4c1b11ebb
--    opciones:
--      407466c1-d46d-4c18-9e82-1eacc1e91219  orden 1  A favor
--      6b6a230c-794f-4e0f-8691-c52d3e0b8741  orden 2  En contra
--      541a93ce-09a6-470a-89a4-cce4dc2eb651  orden 3  Me abstengo
--    Para stress /api/votar suele usarse la opción orden 1 (A favor), salvo que pruebes otra.
--
-- 5) Código de acceso (/votar/{codigo}) — el script npm run simular:lopd-tokens lo obtiene solo si omites CODIGO
-- SELECT codigo_acceso FROM public.asambleas WHERE id = '967b8219-a731-4a27-b16c-289044a19cc5';
