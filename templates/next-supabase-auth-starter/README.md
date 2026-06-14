# Next.js + Supabase Auth Starter

Template transferible desde **asambleas-app** con auth completa, reglas Cursor y documentación.

## Qué incluye

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase Auth: email/contraseña, Magic Link, reset password, Google OAuth
- Middleware que protege `/dashboard`
- Logout vía API (compatible con Google OAuth / PKCE)
- Reglas Cursor (`.cursor/rules/`)
- Docs de auth en `docs/auth/`
- `.env.local.example`, `.cursor/mcp.json.example`, `.atl/skill-registry.md`

## Inicio rápido

### Opción A — Script bootstrap (recomendado)

Desde la raíz de **asambleas-app**:

```powershell
.\templates\scripts\bootstrap-new-project.ps1 -TargetPath "C:\ruta\mi-nuevo-proyecto"
cd C:\ruta\mi-nuevo-proyecto
copy .env.local.example .env.local
# Edita .env.local con tus credenciales Supabase
npm install
npm run dev
```

### Opción B — Copiar manualmente

1. Copia la carpeta `templates/next-supabase-auth-starter/` a tu nuevo repo
2. `copy .env.local.example .env.local` y completa variables
3. `npm install && npm run dev`

## Configurar Supabase

1. Crea un **proyecto nuevo** en [supabase.com](https://supabase.com)
2. Copia URL y anon key a `.env.local`
3. **Authentication → URL Configuration**: Site URL + redirect URLs (ver `docs/auth/AUTH-RESUMEN-COMPLETO.md`)
4. **Email Templates**: usa `docs/auth/PLANTILLAS-EMAIL-SUPABASE.md`
5. (Opcional) Activa Google en Providers

## Configurar Cursor

```powershell
copy .cursor\mcp.json.example .cursor\mcp.json
# Edita project-ref y SUPABASE_ACCESS_TOKEN
```

## Skills de usuario

Los skills en `~/.claude/skills/` y `~/.cursor/skills-cursor/` ya están en tu máquina y aplican a cualquier proyecto.

## Personalizar

- `NEXT_PUBLIC_APP_NAME` — nombre en pantallas de auth
- Cambia colores en `app/globals.css`
- Añade rutas protegidas en `middleware.ts`
- Extiende `.cursor/rules/` según tu dominio

## Probar auth

1. Registro en `/auth/register`
2. Login con contraseña en `/login`
3. Magic Link (requiere plantilla email en Supabase)
4. Forgot password → `/auth/restablecer`
5. Google OAuth (requiere provider activo)
6. Logout desde `/dashboard` → login Google otra vez

## Despliegue (Vercel)

Variables en Vercel:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL=https://tu-dominio.vercel.app
NEXT_PUBLIC_APP_NAME
```

Actualiza Redirect URLs en Supabase con tu dominio de producción.
