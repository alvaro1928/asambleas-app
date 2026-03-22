# Piloto: accesos correctos y problemas frecuentes

## Enlaces que debe recibir cada persona

| Rol | Ruta | ¿Requiere login en Asambleas? |
|-----|------|--------------------------------|
| **Propietario que vota** | `https://…/votar/CODIGO` | **No** (solo código + identificación) |
| **Delegado de asistencia / voto** | `https://…/asistir/CODIGO?t=TOKEN` | **No** (token en la URL) |
| **Administrador del conjunto** | `https://…/dashboard/…` | **Sí** (cuenta registrada) |

Si compartes solo el **dominio**, la **raíz** o un enlace al **dashboard**, el votante puede:

- Ver la pantalla de **login** o **registro de conjunto** (eso es para administradores).
- No acceder a la votación pública.

**Recomendación:** copiar el enlace desde **Acceso** en la asamblea o el QR generado; no reenviar capturas del navegador del admin.

## “Acceso bloqueado” o “acceso cerrado” en mitad de la votación

Causas habituales:

1. **Se desactivó la votación pública** (botón “Desactivar votación” en el panel). Corta el acceso para **todos** hasta reactivar.
2. **`acceso_publico`** quedó en falso (misma consecuencia).
3. **Asamblea finalizada** (cierra preguntas y puede revocar token de delegado según flujo).

En producción, evitar desactivar la votación salvo emergencia durante el acto.

## Verificación de asistencia (quórum)

La aplicación usa **una sola verificación general por asamblea** (no por pregunta), para que al abrir/cerrar preguntas no se pierda el contexto ni el conteo de “ya verificaron”.

Si en base de datos quedó `verificacion_pregunta_id` antiguo, se puede limpiar con el script `supabase/VERIFICACION-SOLO-GENERAL.sql`.

## Poderes — filtrar en pantalla

En **Gestión de Poderes** puedes:

- Buscar por texto (torre, apto, nombres, correos).
- **Unidad otorgante:** lista desplegable para ver solo los poderes de un apto.
- **Solo vigentes / Incluir revocados** para auditoría.
