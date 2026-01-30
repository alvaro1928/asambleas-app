# Plantillas de email en Supabase (Magic Link + Reset Password)

Usa **token_hash en la URL** para que el acceso y el reset funcionen en todos los navegadores (evita que se pierda el hash).

**Dónde:** Supabase Dashboard → **Authentication** → **Email Templates**

Tu **Site URL** debe estar bien en **Authentication → URL Configuration** (ej. `https://tu-app.vercel.app`). No cambies `{{ .SiteURL }}` ni `{{ .TokenHash }}` en los enlaces; Supabase los reemplaza al enviar.

---

## 1. Magic Link (acceso sin contraseña)

**Plantilla:** **Magic Link**

### Subject
```
Entrar a Asambleas - enlace de acceso
```

### Message body (copia todo el bloque)
```html
<h2>Entrar a Asambleas</h2>
<p>Hola,</p>
<p>Haz clic en el enlace para entrar a tu cuenta:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Entrar a Asambleas</a></p>
<p>Si no solicitaste este enlace, puedes ignorar este correo.</p>
```

---

## 2. Reset Password (restablecer contraseña)

**Plantilla:** **Reset Password**

### Subject
```
Restablecer contraseña - Asambleas
```

### Message body (copia todo el bloque)
```html
<h2>Restablecer contraseña</h2>
<p>Hola,</p>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Asambleas. Haz clic en el enlace para elegir una nueva contraseña:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Restablecer contraseña</a></p>
<p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
```

---

## Resumen

| Plantilla en Supabase | Asunto (ejemplo) | Enlace en el correo |
|----------------------|------------------|----------------------|
| **Magic Link** | Entrar a Asambleas - enlace de acceso | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` |
| **Reset Password** | Restablecer contraseña - Asambleas | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery` |

Ambos enlaces llevan a tu app en `/auth/callback`; la app valida el token y redirige a dashboard (Magic Link) o a `/auth/restablecer` (Reset Password).

---

## 3. Login con Google (OAuth)

La app ya tiene el botón **"Entrar con Google"** en la página de login. Para que funcione hay que activar y configurar Google en Supabase:

1. **Supabase Dashboard** → **Authentication** → **Providers** → **Google**.
2. Activa **Enable Sign in with Google**.
3. Crea credenciales en Google Cloud:
   - Ve a [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**.
   - Tipo: **Web application**.
   - **Authorized redirect URIs**: añade la URL que te indique Supabase (algo como `https://<tu-proyecto>.supabase.co/auth/v1/callback`).
   - Copia **Client ID** y **Client Secret**.
4. En Supabase, pega **Client ID** y **Client Secret** en la configuración de Google y guarda.
5. En **Authentication** → **URL Configuration**, en **Redirect URLs** debe estar tu callback (ej. `https://tu-app.vercel.app/auth/callback`).

Después de guardar, "Entrar con Google" redirigirá a Google y, al volver, el callback de la app establecerá la sesión y redirigirá al dashboard.
