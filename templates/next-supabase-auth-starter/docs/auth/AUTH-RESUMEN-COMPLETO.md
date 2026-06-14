# Resumen completo de autenticación

Referencia para login, Magic Link, restablecer contraseña y Google OAuth.

---

## 1. Flujos de autenticación

| Método | Ruta / callback | Descripción |
|--------|-----------------|-------------|
| **Email + contraseña** | Login directo | `signInWithPassword` → redirige a `/dashboard`. |
| **Magic Link** | `/auth/callback?token_hash=...&type=email` | Enlace con `token_hash`; la app hace `verifyOtp` y redirige a `/dashboard`. |
| **Restablecer contraseña** | `/auth/callback?token_hash=...&type=recovery` | `verifyOtp` → `/auth/restablecer`. |
| **Google OAuth** | `/auth/callback/oauth?code=...` | Servidor intercambia `code` por sesión y redirige a `/dashboard`. |

**Importante:** Usa **token_hash en la URL** (query) para Magic Link y Reset Password.

---

## 2. URLs en Supabase

**Authentication → URL Configuration**

- **Site URL:** `https://tu-dominio.vercel.app`
- **Redirect URLs:**
  - `https://tu-dominio.vercel.app/auth/callback`
  - `https://tu-dominio.vercel.app/auth/callback/oauth`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/callback/oauth`

---

## 3. Plantillas de email

Ver `PLANTILLAS-EMAIL-SUPABASE.md`. Enlaces con `token_hash`, no `{{ .ConfirmationURL }}`.

---

## 4. Google OAuth

1. Supabase → Providers → Google → activar
2. Google Cloud Console → OAuth Client ID
3. Redirect URI en Google = URL de Supabase (`https://xxx.supabase.co/auth/v1/callback`)
4. Client ID/Secret en Supabase
5. Redirect URL de la app = `/auth/callback/oauth`

**Logout:** solo `POST /api/auth/signout` (no `signOut()` en cliente).

---

## 5. Archivos de auth en este starter

| Archivo | Función |
|---------|---------|
| `app/login/page.tsx` | Login: contraseña, Magic Link, Google, forgot password |
| `app/auth/register/page.tsx` | Registro con email/contraseña |
| `app/auth/callback/page.tsx` | Callback cliente (token_hash, tokens) |
| `app/auth/callback/oauth/route.ts` | Callback servidor Google |
| `app/auth/restablecer/page.tsx` | Nueva contraseña |
| `app/api/auth/set-session/route.ts` | Establece sesión con tokens |
| `app/api/auth/signout/route.ts` | Cierra sesión en servidor |
| `middleware.ts` | Protege `/dashboard`, refresh sesión |
| `lib/supabase.ts` | Cliente navegador |
| `lib/auth.ts` | Helpers + signOut vía API |

---

## 6. Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_APP_NAME=
```
