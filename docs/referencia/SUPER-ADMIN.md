# Super Administración (`/super-admin`)

Página restringida para gestionar conjuntos y planes de suscripción.

## Seguridad

- Solo puede acceder el usuario cuyo **email** coincida con **`NEXT_PUBLIC_ADMIN_EMAIL`** (página) o **`SUPER_ADMIN_EMAIL`** (API). Configura al menos `NEXT_PUBLIC_ADMIN_EMAIL` en `.env.local` para entrar a `/super-admin`; si la API usa `SUPER_ADMIN_EMAIL`, pon el mismo correo en ambas para que listado y "Activar Cortesía" funcionen.
- Si no hay sesión o el email no es el configurado, se redirige a `/login`.
- En código se usa la utilidad **`isSuperAdmin(email)`** de `@/lib/super-admin` para comprobar si el usuario es super admin.
- Para que el super admin tenga **acceso total a todas las tablas desde Supabase (RLS)** sin depender de `organization_id`, ejecuta el script `supabase/ROL-SUPER-ADMIN.sql` y luego actualiza el correo en la tabla `app_config`.

## Configuración

En `.env.local` (o en las variables de entorno de Vercel) debes definir:

```env
# Email del admin (quien puede entrar a /super-admin). Usar NEXT_PUBLIC_ para la página.
NEXT_PUBLIC_ADMIN_EMAIL=tu_correo@ejemplo.com

# Opcional: mismo correo para la API (si no lo pones, la API usa solo SUPER_ADMIN_EMAIL)
SUPER_ADMIN_EMAIL=tu_correo@ejemplo.com

# Clave de servicio de Supabase (Dashboard → Settings → API → service_role)
# Necesaria para listar y actualizar todos los conjuntos sin RLS
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- **SUPER_ADMIN_EMAIL:** El correo del usuario que puede acceder a `/super-admin`. Usa el mismo email con el que inicias sesión en la app.
- **SUPABASE_SERVICE_ROLE_KEY:** En Supabase → Project Settings → API → "service_role" (secret). No la expongas en el cliente.

## Funcionalidad

- **Tabla de conjuntos:** Lista todos los conjuntos (nombre, plan actual). Por cada fila puedes elegir plan (free / pro / pilot) y pulsar **Aplicar** para actualizar; o usar el atajo **Pro 1 año**.
- **Administración de planes:** Tabla de planes (nombre, precio COP anual) editable desde la misma página; cada plan tiene botón **Guardar**.
- **Activar Cortesía:** Botón por fila que pone el plan en `pro` manualmente (sin pasarela). Para usuarios piloto.

## Rutas API

- `GET /api/super-admin/conjuntos` — Lista todos los conjuntos (solo super admin).
- `PATCH /api/super-admin/conjuntos` — Body: `{ id, plan_type }`. Actualiza el plan del conjunto (solo super admin). `plan_type`: 'free' | 'pro' | 'pilot'.
- `GET /api/super-admin/planes` — Lista planes (solo super admin).
- `PATCH /api/super-admin/planes` — Body: `{ key, nombre?, precio_cop_anual? }`. Actualiza un plan (solo super admin).
- `GET /api/planes` — Público: datos de planes para mostrar precios en dashboard/landing.

## Base de datos

La tabla `organizations` debe tener las columnas de suscripción (ejecutar `supabase/AGREGAR-SUSCRIPCIONES-ORGANIZATIONS.sql` si aún no se ha hecho):

- `plan_type` — 'free' | 'pro' | 'pilot'
- `plan_active_until` — timestamp opcional
- `is_pilot` — boolean

### Acceso total del super admin (RLS)

Ejecuta `supabase/ROL-SUPER-ADMIN.sql` para:

1. Crear la tabla `app_config` con la clave `super_admin_email`.
2. Crear la función `is_super_admin()` que compara el email del JWT con ese valor.
3. Añadir políticas RLS en las tablas principales para que el super admin pueda SELECT/INSERT/UPDATE/DELETE sin depender de `organization_id`.

Después de ejecutar el script, actualiza el correo en la base de datos:

```sql
UPDATE app_config SET value = 'tu@correo.com' WHERE key = 'super_admin_email';
```

Usa el mismo correo que configuras en `SUPER_ADMIN_EMAIL` en `.env`.
