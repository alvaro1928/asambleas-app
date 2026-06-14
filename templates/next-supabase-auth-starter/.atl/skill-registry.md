# Skill Registry — next-supabase-auth-starter

**Actualizado:** template generado desde asambleas-app.

## Project Conventions

| File | Path |
|------|------|
| nextjs.mdc | `.cursor/rules/nextjs.mdc` |
| supabase.mdc | `.cursor/rules/supabase.mdc` |
| typescript.mdc | `.cursor/rules/typescript.mdc` |
| design-ui.mdc | `.cursor/rules/design-ui.mdc` |
| agent-tareas-grandes-memoria.mdc | `.cursor/rules/agent-tareas-grandes-memoria.mdc` |

## Auth

- Supabase SSR con `@supabase/ssr`
- Logout vía `POST /api/auth/signout` (no `signOut()` en cliente)
- OAuth Google: callback servidor en `/auth/callback/oauth`
- Magic Link / reset: `token_hash` en query → `/auth/callback`
- Docs: `docs/auth/AUTH-RESUMEN-COMPLETO.md`

## Engram

Usa `topic_key` propio del nuevo proyecto, ej. `architecture/mi-nuevo-sitio`.
