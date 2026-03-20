# Reset de consentimiento LOPD

La tabla `consentimiento_tratamiento_datos` guarda una fila por par `(asamblea_id, identificador)` cuando el votante acepta el tratamiento de datos en la pantalla de votación.

No requiere migración adicional: el reset se hace desde el panel **Acceso** de la asamblea (sección colapsable «Consentimiento de datos») o vía API:

- `POST /api/dashboard/reset-consentimiento` (sesión de administrador del conjunto)
- Cuerpo: `asamblea_id`, `tipo` (`identificador` | `unidad`), `alcance` (`esta_asamblea` | `todo_el_conjunto`), y según el caso `identificador` o `unidad_id`.

El `service_role` elimina filas; no hace falta cambiar RLS si ya usáis el backend con clave de servicio.
