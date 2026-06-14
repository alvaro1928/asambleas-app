# Backup del esquema de base de datos (solo estructura)

Esta carpeta contiene el **volcado actual** del schema `public` del proyecto **asambleas-saas** (`zbfwuabsgnrpizckeump`).

**No incluye datos** (filas). Sirve para reconstruir tablas, índices, funciones, triggers, vistas y políticas RLS.

## Archivo canónico

```
supabase/schema/restore/public-schema.sql
```

Este es el **único archivo** que debes usar para **restaurar la estructura**.  
Los scripts sueltos en `supabase/*.sql` (raíz) son histórico de parches — **no** los ejecutes en cadena para restaurar.

## Restaurar en un proyecto Supabase vacío (emergencia)

1. Supabase Dashboard → **SQL Editor**
2. (Opcional, proyecto nuevo) ejecutar primero:

```sql
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

3. Pegar y ejecutar **todo** el contenido de `public-schema.sql`
4. Verificar (ver `MANIFEST.json`): 34 tablas, RLS activo, funciones clave (`is_super_admin`, etc.)

## Regenerar el backup (cuando cambies el esquema)

Opción A — pipeline completo (recomendado):

```powershell
# Con token (descarga secciones desde la API):
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."   # Account → Access Tokens
node scripts/export-schema-full.mjs --fetch

# Sin token (recompone desde chunks ya guardados en el repo):
node scripts/export-schema-full.mjs
```

Opción B — solo Management API → un archivo:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
node scripts/export-schema-backup.mjs
```

Opción C — Supabase CLI (requiere Docker + contraseña DB):

```powershell
npx supabase link --project-ref zbfwuabsgnrpizckeump
npx supabase db dump --linked -s public -f supabase/schema/restore/public-schema.sql
```

Después: commit + push a GitHub (tu copia de seguridad en plan Free).

## Qué incluye el backup

| Sección | Contenido |
|---------|-----------|
| Extensiones | `uuid-ossp`, `pgcrypto` |
| ENUMs | `quorum_event_type`, `quorum_presence_status`, `quorum_snapshot_type` |
| Tablas | 34 tablas `public.*` |
| Constraints | PK, FK, UNIQUE, CHECK |
| Índices | Todos los índices actuales |
| Funciones | RPC/triggers helpers (~57 funciones) |
| Triggers | 11 triggers |
| Vistas | `vista_participacion_votantes`, `vista_poderes_completa` |
| RLS | ENABLE + políticas actuales |

## Estructura de carpetas

```
supabase/schema/
├── restore/public-schema.sql   ← restaurar esto
├── MANIFEST.json               ← fecha y conteos
└── .export-chunks/             ← piezas para regenerar (no ejecutar a mano)
```

## Manifest

Ver `MANIFEST.json` para fecha de generación y conteos verificados contra producción.
