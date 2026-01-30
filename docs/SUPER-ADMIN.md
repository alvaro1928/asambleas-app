# Super Administración (`/super-admin`)

Página restringida para gestionar conjuntos y planes de suscripción.

## Seguridad

- Solo puede acceder el usuario cuyo **email** coincida con la variable de entorno **`SUPER_ADMIN_EMAIL`** (comparación sin distinguir mayúsculas/minúsculas).
- Si no hay sesión o el email no es el configurado, se redirige a `/login`.
- En código se usa la utilidad **`isSuperAdmin(email)`** de `@/lib/super-admin` para comprobar si el usuario es super admin.
- Para que el super admin tenga **acceso total a todas las tablas desde Supabase (RLS)** sin depender de `organization_id`, ejecuta el script `supabase/ROL-SUPER-ADMIN.sql` y luego actualiza el correo en la tabla `app_config`.

## Configuración

En `.env.local` (o en las variables de entorno de Vercel) debes definir:

```env
# Email del super administrador (único que puede entrar a /super-admin)
SUPER_ADMIN_EMAIL=tu_correo@ejemplo.com

# Clave de servicio de Supabase (Dashboard → Settings → API → service_role)
# Necesaria para listar y actualizar todos los conjuntos sin RLS
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- **SUPER_ADMIN_EMAIL:** El correo del usuario que puede acceder a `/super-admin`. Usa el mismo email con el que inicias sesión en la app.
- **SUPABASE_SERVICE_ROLE_KEY:** En Supabase → Project Settings → API → "service_role" (secret). No la expongas en el cliente.

## Funcionalidad

- **Tabla:** Lista todos los registros de la tabla `organizations` (conjuntos).
- **Plan:** Selector en cada fila para cambiar `plan_type` (`free`, `pro`, `pilot`). Al cambiar, se ejecuta un `UPDATE` en Supabase y la tabla se actualiza en tiempo real.
- **Piloto:** Columna que indica si el conjunto está en modo piloto (`is_pilot`).
- **Unidades:** Columna con el número de unidades registradas por conjunto.

## Rutas API

- `GET /api/super-admin/conjuntos` — Lista todos los conjuntos (solo super admin).
- `PATCH /api/super-admin/conjuntos` — Body: `{ id, plan_type }`. Actualiza el plan del conjunto (solo super admin).

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
