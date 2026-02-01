# Super Administración (`/super-admin`)

Página restringida para gestionar conjuntos (cuentas), planes, tokens por cuenta y ajustes globales (landing, color, WhatsApp).

---

## Seguridad

- Solo puede acceder el usuario cuyo **email** coincida con **`NEXT_PUBLIC_ADMIN_EMAIL`** (página) o **`SUPER_ADMIN_EMAIL`** (API). Configura al menos `NEXT_PUBLIC_ADMIN_EMAIL` en `.env.local` para entrar a `/super-admin`; si la API usa `SUPER_ADMIN_EMAIL`, pon el mismo correo en ambas.
- Si no hay sesión o el email no es el configurado, se redirige a `/login`.
- En código se usa **`isSuperAdmin(email)`** de `@/lib/super-admin`.
- Para acceso total a todas las tablas desde Supabase (RLS) sin depender de `organization_id`, ejecuta `supabase/ROL-SUPER-ADMIN.sql` y actualiza el correo en la tabla `app_config`.

---

## Configuración (variables de entorno)

En `.env.local` (o en Vercel):

```env
NEXT_PUBLIC_ADMIN_EMAIL=tu_correo@ejemplo.com
SUPER_ADMIN_EMAIL=tu_correo@ejemplo.com
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- **SUPER_ADMIN_EMAIL:** Mismo email con el que inicias sesión; necesario para las APIs de super-admin.
- **SUPABASE_SERVICE_ROLE_KEY:** Supabase → Project Settings → API → service_role. No exponer en el cliente.

---

## Funcionalidad

### Tabla de conjuntos (cuentas)

- Lista todos los conjuntos con: nombre, plan actual (free/pro/pilot), **tokens de la cuenta** (editable por fila).
- **Tokens por cuenta:** son de la cuenta (conjunto); se van descontando al usar funcionalidades (crear/activar asambleas). El super admin puede ajustar el saldo por fila y pulsar **Aplicar**.
- Por cada fila: elegir plan (free/pro/pilot) y **Aplicar**; atajo **Pro 1 año** para asignar Pro con vigencia 1 año.
- **Activar Cortesía:** pone el plan en `pro` manualmente (sin pasarela).
- **Exportar** lista en CSV.
- Filtros por nombre y por plan.

### Tabla de planes

- Edición por plan (Gratis, Piloto, Pro):
  - **Nombre**
  - **Precio por asamblea (COP)** — usado para compra de tokens y para mostrar en dashboard/landing.
  - **Tokens iniciales** — cuántos tokens tiene la cuenta al tener ese plan (Gratis: 2, Piloto: 10, Pro: ilimitado = null).
  - **Vigencia (meses)** — duración al asignar el plan (Gratis: —, Piloto: 3, Pro: 12).
  - **Max preguntas por asamblea**
  - **Incluye acta detallada**
- Botón **Guardar** por plan.

### Ajustes (`/super-admin/ajustes`)

- **Color principal (hex)** — para la landing y elementos de marca.
- **WhatsApp de contacto** — botones de contacto en la landing. Vacío = no mostrar.
- La URL de Plan Pro y el precio por token se leen de la tabla de planes y de la configuración global (BD); no se configuran por variables de entorno.

### Carga masiva piloto

- Subida de CSV con columna `organization_id` o `nombre`.
- Cada fila se asigna como plan **Piloto** con vigencia y tokens según el plan Piloto configurado en la tabla de planes.

---

## Rutas API

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/super-admin/conjuntos` | Lista todos los conjuntos (plan, tokens_disponibles, etc.). Solo super admin. |
| PATCH | `/api/super-admin/conjuntos` | Body: `{ id, plan_type?, tokens_disponibles? }`. Actualiza plan y/o tokens de la cuenta. |
| GET | `/api/super-admin/planes` | Lista planes (nombre, precio_por_asamblea_cop, tokens_iniciales, vigencia_meses, límites). |
| PATCH | `/api/super-admin/planes` | Body: `{ key, nombre?, precio_por_asamblea_cop?, tokens_iniciales?, vigencia_meses?, max_preguntas_por_asamblea?, incluye_acta_detallada? }`. Actualiza un plan. |
| GET | `/api/super-admin/configuracion-landing` | Color principal y WhatsApp (para Ajustes). |
| PATCH | `/api/super-admin/configuracion-landing` | Body: `{ color_principal_hex?, whatsapp_number? }`. Guarda ajustes. |
| POST | `/api/super-admin/carga-masiva-piloto` | Body: CSV o JSON con organization_id/nombre. Asigna plan Piloto a las cuentas indicadas. |
| GET | `/api/planes` | Público: datos de planes para precios en dashboard/landing. |

---

## Base de datos

- **organizations:** `plan_type`, `plan_active_until`, `tokens_disponibles` (tokens de la cuenta). Scripts: `AGREGAR-SUSCRIPCIONES-ORGANIZATIONS.sql`, `PRECIO-POR-ASAMBLEA-Y-TOKENS.sql` (tokens_disponibles), `TOKENS-CONJUNTOS.sql`.
- **planes:** `precio_por_asamblea_cop`, `tokens_iniciales`, `vigencia_meses`, `max_preguntas_por_asamblea`, `incluye_acta_detallada`. Scripts: `PLANES-TABLA-Y-SEED.sql`, `AGREGAR-LIMITES-PLANES.sql`, `AGREGAR-TOKENS-INICIALES-PLANES.sql`, `AGREGAR-VIGENCIA-PLANES.sql`.
- **app_config** (o tabla de configuración global): color principal, WhatsApp. Scripts: `CONFIGURACION-GLOBAL-LANDING.sql`, `AGREGAR-COLOR-PRINCIPAL-CONFIG.sql`.

### Acceso total del super admin (RLS)

Ejecuta `supabase/ROL-SUPER-ADMIN.sql` y luego:

```sql
UPDATE app_config SET value = 'tu@correo.com' WHERE key = 'super_admin_email';
```

Usa el mismo correo que `SUPER_ADMIN_EMAIL` en `.env`.
