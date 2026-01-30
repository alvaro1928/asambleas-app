# Resumen completo de autenticación (Asambleas App)

Guarda este documento como referencia de todo lo configurado para que el login, Magic Link, restablecer contraseña y Google OAuth funcionen correctamente.

---

## 1. Flujos de autenticación

| Método | Ruta / callback | Descripción |
|--------|-----------------|-------------|
| **Email + contraseña** | Login directo | `signInWithPassword` → redirige a `/dashboard`. |
| **Magic Link** | `/auth/callback?token_hash=...&type=email` | Enlace en el correo con `token_hash`; la app hace `verifyOtp` y redirige a `/dashboard`. |
| **Restablecer contraseña** | `/auth/callback?token_hash=...&type=recovery` | Enlace en el correo con `token_hash`; la app hace `verifyOtp` y redirige a `/auth/restablecer`. |
| **Google OAuth** | `/auth/callback/oauth?code=...` | El servidor intercambia el `code` por sesión (usa cookies con code_verifier) y redirige a `/dashboard`. |

**Importante:** Se usan **token_hash en la URL** (query) para Magic Link y Reset Password, no el hash en el fragmento (`#access_token=...`), para evitar que falle en navegadores que pierden el hash (caché, redirecciones).

---

## 2. URLs que debes tener en Supabase

**Supabase Dashboard** → **Authentication** → **URL Configuration**

- **Site URL:**  
  `https://tu-dominio.vercel.app`  
  (ej. `https://asambleas-app-epbco.vercel.app`)

- **Redirect URLs** (añadir todas):
  - `https://tu-dominio.vercel.app/auth/callback`  
    → Magic Link y Restablecer contraseña
  - `https://tu-dominio.vercel.app/auth/callback/oauth`  
    → Google OAuth

Para desarrollo local, añade también:
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback/oauth`

---

## 3. Plantillas de email en Supabase

**Supabase Dashboard** → **Authentication** → **Email Templates**

Las plantillas deben usar **token_hash en la URL** (no `{{ .ConfirmationURL }}`) para que funcione en todos los navegadores.

### Magic Link

- **Subject:** `Entrar a Asambleas - enlace de acceso`
- **Message body (enlace):**  
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`

### Reset Password

- **Subject:** `Restablecer contraseña - Asambleas`
- **Message body (enlace):**  
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`

Plantillas completas listas para copiar/pegar: **[docs/supabase/PLANTILLAS-EMAIL-SUPABASE.md](../supabase/PLANTILLAS-EMAIL-SUPABASE.md)**

---

## 4. Google OAuth (opcional)

1. **Supabase** → **Authentication** → **Providers** → **Google** → activar.
2. **Google Cloud Console** → Credentials → OAuth 2.0 Client ID (Web application).
3. En **Authorized redirect URIs** añadir la URL que indica Supabase (ej. `https://xxx.supabase.co/auth/v1/callback`).
4. Copiar **Client ID** y **Client Secret** en Supabase.
5. En Supabase → **Redirect URLs** debe estar:  
   `https://tu-dominio.vercel.app/auth/callback/oauth`

**Cierre de sesión:** La app cierra sesión vía **API** (`POST /api/auth/signout`), no con `signOut()` en el cliente, para no borrar el code_verifier de PKCE y que "Entrar con Google" siga funcionando después de cerrar sesión.

---

## 5. Archivos de la app relacionados con auth

| Archivo | Función |
|---------|---------|
| `app/login/page.tsx` | Página de login: contraseña, Magic Link, Google, "¿Olvidaste tu contraseña?". |
| `app/auth/callback/page.tsx` | Callback cliente: token_hash (email/recovery) y tokens en hash/query; llama `verifyOtp` o `set-session`. |
| `app/auth/callback/layout.tsx` | Layout del callback: `force-dynamic` para no cachear. |
| `app/auth/callback/oauth/route.ts` | Callback **servidor** para Google: intercambia `code` por sesión y redirige a `/dashboard`. |
| `app/auth/restablecer/page.tsx` | Página para poner nueva contraseña tras el enlace de recuperación. |
| `app/api/auth/set-session/route.ts` | API: establece sesión con `access_token`/`refresh_token` o intercambia `code` (no usado para Google; Google usa `/auth/callback/oauth`). |
| `app/api/auth/signout/route.ts` | API: cierra sesión en el servidor (borra cookies de sesión); el cliente no llama `signOut()` para no borrar code_verifier. |
| `middleware.ts` | Protege `/dashboard` (redirige a `/login` si no hay sesión); redirige a `/dashboard` si estás en `/login` con sesión. Excluye rutas `auth`. |
| `lib/supabase.ts` | Cliente navegador (`createBrowserClient` de `@supabase/ssr`). |

---

## 6. Variables de entorno

**Vercel / `.env.local`:**

- `NEXT_PUBLIC_SUPABASE_URL` = URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key de Supabase
- `NEXT_PUBLIC_SITE_URL` (opcional) = URL pública de la app (ej. `https://tu-dominio.vercel.app`)

---

## 7. Resumen rápido para guardar

1. **Supabase → URL Configuration:** Site URL y Redirect URLs con `/auth/callback` y `/auth/callback/oauth`.
2. **Supabase → Email Templates:** Magic Link y Reset Password con enlaces que usen `token_hash` y `type=email` / `type=recovery`.
3. **Google (opcional):** Provider activado, Client ID/Secret, Redirect URL de la app = `/auth/callback/oauth`.
4. **Cerrar sesión:** Solo vía `POST /api/auth/signout`; no usar `signOut()` en el cliente para no romper Google tras cerrar sesión.
5. **Documentación detallada:** [docs/supabase/PLANTILLAS-EMAIL-SUPABASE.md](../supabase/PLANTILLAS-EMAIL-SUPABASE.md) y este archivo.
