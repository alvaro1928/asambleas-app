# 📝 Resumen de Cambios para Producción

## ✅ **Archivos Modificados:**

### **1. `app/login/page.tsx`**
- ✅ Agregado selector para elegir entre **Contraseña** o **Magic Link**
- ✅ Implementado `signInWithOtp` con URLs dinámicas
- ✅ Detección automática del origen (`window.location.origin`)
- ✅ Fallback a variable de entorno `NEXT_PUBLIC_SITE_URL`
- ✅ Pantalla de confirmación después de enviar el Magic Link
- ✅ Mejor UX con estados de carga y mensajes claros

**Código clave:**
```typescript
const redirectTo = typeof window !== 'undefined' 
  ? `${window.location.origin}/auth/callback`
  : process.env.NEXT_PUBLIC_SITE_URL 
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    : 'http://localhost:3000/auth/callback'
```

---

### **2. `app/auth/callback/route.ts`**
- ✅ Mejorado el manejo de errores
- ✅ URLs relativas con `new URL(next, request.url)`
- ✅ Soporte para parámetro `?next=` para redirección personalizada
- ✅ Mejor logging de errores
- ✅ Mensajes de error más descriptivos

**Mejora clave:**
```typescript
// ✅ Funciona en cualquier dominio
return NextResponse.redirect(new URL('/dashboard', request.url))

// ❌ ANTES: Solo funcionaba con origin específico
return NextResponse.redirect(`${origin}/dashboard`)
```

---

### **3. `middleware.ts`**
- ✅ Protección de rutas del `/dashboard`
- ✅ Redirección automática si no hay sesión
- ✅ Redirección al dashboard si ya estás logueado en `/login`
- ✅ Cookies seteadas correctamente en request y response
- ✅ Mejor matcher para excluir archivos estáticos

**Protección agregada:**
```typescript
if (request.nextUrl.pathname.startsWith('/dashboard')) {
  if (!session) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }
}
```

---

## 🆕 **Archivos Nuevos:**

### **1. `DEPLOYMENT-GUIDE.md`**
Guía completa con:
- Variables de entorno necesarias
- Configuración paso a paso en Supabase
- Solución de problemas comunes
- Checklist de verificación
- Links útiles

### **2. `CAMBIOS-PRODUCCION.md`**
Este archivo - resumen técnico de los cambios.

---

## 🔧 **Variables de Entorno Requeridas:**

### **Desarrollo (`.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### **Producción (Vercel):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
NEXT_PUBLIC_SITE_URL=https://tu-app.vercel.app
```

---

## ⚙️ **Configuración en Supabase:**

Ve a: **Authentication → URL Configuration**

1. **Site URL:**
   ```
   https://tu-app.vercel.app
   ```

2. **Redirect URLs (agregar ambas):**
   ```
   http://localhost:3000/auth/callback
   https://tu-app.vercel.app/auth/callback
   ```

---

## 🧪 **Cómo Probar:**

### **1. En Desarrollo:**
```bash
npm run dev
```
1. Ve a http://localhost:3000/login
2. Selecciona "Magic Link"
3. Ingresa tu email
4. Revisa tu correo
5. Haz clic en el enlace
6. ✅ Deberías entrar al dashboard

### **2. En Producción:**
```bash
git push origin main
# O: vercel --prod
```
1. Ve a https://tu-app.vercel.app/login
2. Selecciona "Magic Link"
3. Ingresa tu email
4. Revisa tu correo
5. Haz clic en el enlace
6. ✅ Deberías entrar al dashboard

---

## 🎯 **Beneficios de los Cambios:**

1. ✅ **URLs Dinámicas:** Funciona en localhost, staging y producción sin cambiar código
2. ✅ **Mejor UX:** Selector visual entre métodos de login
3. ✅ **Seguridad:** Middleware protege rutas automáticamente
4. ✅ **Errores Claros:** Mejor feedback cuando algo falla
5. ✅ **Escalable:** Fácil agregar más métodos de autenticación (Google, GitHub, etc.)
6. ✅ **Mantenible:** Código limpio y bien documentado

---

## 🐛 **Problemas Comunes:**

### **"Email link is invalid or has expired"**
➡️ Agrega la URL de callback en Supabase → Redirect URLs

### **"auth-callback-failed"**
➡️ Verifica las variables de entorno en Vercel

### **"No redirige al dashboard"**
➡️ Limpia cookies del navegador e intenta de nuevo

### **Magic Link funciona en el celular pero no en el navegador (sin incógnito)**
En algunos navegadores el **hash** (`#access_token=...`) se pierde por caché o redirecciones. La app ya soporta dos formas de callback:

1. **Hash** (por defecto): Supabase redirige con tokens en la URL fragment. Si tu navegador lo pierde, usa la opción 2.
2. **token_hash en query** (recomendado si falla en desktop): Cambia la plantilla del Magic Link en Supabase para que el enlace lleve los tokens en la **query** en vez del hash.

**Configurar plantilla en Supabase (opcional, si el callback falla en navegador normal):**

1. Ve a **Supabase Dashboard** → **Authentication** → **Email Templates** → **Magic Link**.
2. En el cuerpo del correo, sustituye el enlace por uno que apunte a tu callback con `token_hash`:
   - Reemplaza algo como `{{ .ConfirmationURL }}` por un enlace como:
   ```html
   <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Entrar a Asambleas</a>
   ```
   (Usa tu Site URL real, p. ej. `https://tu-app.vercel.app`).
3. Guarda. Los próximos Magic Links llevarán `token_hash` en la URL y el callback funcionará aunque el navegador pierda el hash.

---

## 📚 **Próximos Pasos (Opcional):**

- [ ] Agregar autenticación con Google OAuth
- [ ] Agregar autenticación con GitHub
- [ ] Implementar 2FA (Two-Factor Authentication)
- [ ] Agregar rate limiting para prevenir spam
- [ ] Personalizar templates de email en Supabase

---

¡Todo listo para producción! 🚀
