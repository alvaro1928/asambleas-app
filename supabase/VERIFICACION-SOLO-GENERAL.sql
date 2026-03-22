-- Opcional tras pilotos antiguos: dejar verificación solo en contexto general.
-- La app ya fuerza pregunta_id = NULL en APIs nuevas; esto alinea filas históricas en `asambleas`.
UPDATE public.asambleas
SET verificacion_pregunta_id = NULL
WHERE verificacion_pregunta_id IS NOT NULL;
