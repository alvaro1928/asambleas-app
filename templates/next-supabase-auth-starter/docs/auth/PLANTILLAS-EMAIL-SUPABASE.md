# Plantillas de email en Supabase

Usa **token_hash en la URL** para Magic Link y Reset Password.

**Dónde:** Supabase Dashboard → **Authentication** → **Email Templates**

---

## Magic Link

**Subject:** `Entrar - enlace de acceso`

**Message body:**

```html
<h2>Entrar</h2>
<p>Haz clic en el enlace para entrar a tu cuenta:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Entrar</a></p>
<p>Si no solicitaste este enlace, ignora este correo.</p>
```

---

## Reset Password

**Subject:** `Restablecer contraseña`

**Message body:**

```html
<h2>Restablecer contraseña</h2>
<p>Haz clic en el enlace para elegir una nueva contraseña:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Restablecer contraseña</a></p>
<p>Si no solicitaste este cambio, ignora este correo.</p>
```

---

## Resumen

| Plantilla | Enlace |
|-----------|--------|
| Magic Link | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` |
| Reset Password | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery` |
