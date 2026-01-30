# Plantilla de correo: Reset Password (Recovery)

Si el correo de "Restablecer contraseña" **no trae enlace** o el enlace **no sirve**, configura esta plantilla en Supabase.

## Dónde configurarla

**Supabase Dashboard** → **Authentication** → **Email Templates** → **Reset Password**

## Subject (asunto)

```
Restablecer contraseña - Asambleas
```

## Message body (cuerpo del mensaje)

Copia y pega esto en el cuerpo. El enlace usa `token_hash` en la URL para que funcione bien en todos los navegadores (igual que el Magic Link).

```html
<h2>Restablecer contraseña</h2>
<p>Hola,</p>
<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Asambleas. Haz clic en el enlace para elegir una nueva contraseña:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Restablecer contraseña</a></p>
<p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
```

**Importante:** No cambies `{{ .SiteURL }}`, `{{ .TokenHash }}` ni `type=recovery`. Supabase los reemplaza al enviar el correo. Tu **Site URL** debe estar bien configurada en **Authentication → URL Configuration** (ej. `https://tu-app.vercel.app`).

## Después de guardar

Los próximos correos de "Restablecer contraseña" incluirán el enlace. Al hacer clic, el usuario irá a `/auth/callback`, la app validará el token y lo redirigirá a `/auth/restablecer` para poner la nueva contraseña.
