# Reset de consentimiento LOPD

## Tabla

`consentimiento_tratamiento_datos`: una fila por `(asamblea_id, identificador)` cuando el votante acepta el tratamiento de datos en la votación pública.

## Reset masivo (toda la asamblea)

- **Panel:** página de la asamblea (`/dashboard/asambleas/[id]`), sección **Consentimiento de datos (LOPD)** → botón **Resetear consentimiento (toda la asamblea)**.
- **API:** `POST /api/dashboard/reset-consentimiento` con body `{ "asamblea_id": "<uuid>" }` (sesión de administrador del conjunto).
- Elimina **todas** las filas de consentimiento de esa asamblea. No requiere migración adicional salvo la columna de configuración (ver abajo).

## Desactivar el botón

En **Configuración → Poderes y plantilla de correo**, desmarca **«Permitir reset masivo de consentimiento de datos (LOPD)…»**.  
Eso guarda `permitir_reset_consentimiento_general = false` en `configuracion_poderes` y la API responde 403 si alguien intenta resetear.

## SQL en Supabase

Ejecutar una vez: `AGREGAR-PERMITIR-RESET-CONSENTIMIENTO.sql` (columna `permitir_reset_consentimiento_general`).
