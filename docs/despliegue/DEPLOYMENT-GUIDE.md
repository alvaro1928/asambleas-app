# 🚀 Guía de Despliegue en Producción (Vercel)

Esta guía te ayudará a configurar correctamente la autenticación Magic Link para producción.

---

## 📋 **1. Variables de Entorno**

### **Archivo `.env.local` (Desarrollo)**

Asegúrate de tener estas variables en tu archivo local. **Para la lista completa de variables** (Supabase, Auth, Super Admin, Wompi), ver **[docs/configuracion/VARIABLES-ENTORNO-VERCEL.md](../configuracion/VARIABLES-ENTORNO-VERCEL.md)**.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui

# URL del sitio (opcional pero recomendado)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### **Variables en Vercel (Producción)**

Cuando despliegues en Vercel, agrega estas variables de entorno:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega las siguientes:

```
NEXT_PUBLIC_SUPABASE_URL = https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = tu-anon-key-aqui
NEXT_PUBLIC_SITE_URL = https://tu-app.vercel.app
```

> **Nota:** Reemplaza `https://tu-app.vercel.app` con la URL real que te asigne Vercel.

---

## 🔐 **2. Configuración en Supabase**

### **Paso 1: Obtener la URL de Vercel**

Después de desplegar en Vercel, obtendrás una URL como:
- `https://asambleas-app.vercel.app`
- O un dominio personalizado si lo configuraste

### **Paso 2: Configurar URLs en Supabase**

1. Ve a tu proyecto en Supabase: https://app.supabase.com
2. Ve a **Authentication → URL Configuration**
3. Configura lo siguiente:

#### **Site URL:**
```
https://tu-app.vercel.app
```

#### **Redirect URLs (agregar todas):**
```
http://localhost:3000/auth/callback
https://tu-app.vercel.app/auth/callback
http://localhost:3000/auth/callback/oauth
https://tu-app.vercel.app/auth/callback/oauth
```
(OAuth para Google usa `/auth/callback/oauth`.)

> **Importante:** Deja ambas URLs. La de localhost para desarrollo y la de Vercel para producción.

#### **Email Templates → Magic Link:**

Asegúrate de que el template use `{{ .ConfirmationURL }}`. Por defecto debería verse así:

```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

### **Paso 3: Configurar CORS (opcional)**

Si tienes problemas de CORS, ve a:
- **Project Settings → API**
- En "Additional Allowed Origins" agrega:
  ```
  https://tu-app.vercel.app
  ```

---

## ✅ **3. Verificar que Todo Funcione**

### **En Desarrollo (localhost):**

1. Ejecuta `npm run dev`
2. Ve a `http://localhost:3000/login`
3. Selecciona "Magic Link"
4. Ingresa tu email
5. Revisa tu correo
6. Haz clic en el enlace
7. ✅ Deberías ser redirigido a `/dashboard`

### **En Producción (Vercel):**

1. Despliega con `vercel` o push a tu repositorio de Git
2. Ve a `https://tu-app.vercel.app/login`
3. Selecciona "Magic Link"
4. Ingresa tu email
5. Revisa tu correo
6. Haz clic en el enlace
7. ✅ Deberías ser redirigido a `/dashboard`

---

## 🐛 **4. Solución de Problemas**

### **Error: "Email link is invalid or has expired"**

**Causa:** La URL de callback no está autorizada en Supabase.

**Solución:**
1. Ve a Supabase → Authentication → URL Configuration
2. Verifica que `https://tu-app.vercel.app/auth/callback` esté en "Redirect URLs"
3. Guarda los cambios
4. Espera 1-2 minutos para que se propague
5. Intenta de nuevo

### **Error: "auth-callback-failed"**

**Causa:** El intercambio del código por la sesión falló.

**Solución:**
1. Revisa los logs en Vercel (Runtime Logs)
2. Verifica que las variables de entorno estén correctas
3. Verifica que el código del email no haya expirado (expira en 1 hora)

### **Error: "No redirige después del login"**

**Causa:** Problema con las cookies o el middleware.

**Solución:**
1. Limpia las cookies del navegador
2. Verifica que el middleware esté habilitado
3. Revisa que no haya errores en la consola del navegador

### **El Magic Link no funciona en móvil**

**Causa:** El email se abre en un navegador diferente al que inició el login.

**Solución:** Esto es normal. El Magic Link funciona en cualquier navegador/dispositivo. No es necesario usar el mismo navegador.

---

## 📊 **5. Verificar el Estado de la Autenticación**

### **Verificar en Supabase:**

1. Ve a **Authentication → Users**
2. Busca el usuario que hizo login
3. Verifica que tenga una sesión activa

### **Verificar en el Código:**

Agrega esto temporalmente en cualquier página del dashboard:

```typescript
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function TestAuth() {
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      console.log('Session:', session)
    })
  }, [])

  return (
    <div>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </div>
  )
}
```

---

## 🎯 **6. Checklist Final**

Antes de lanzar a producción, verifica:

- [ ] Variables de entorno configuradas en Vercel
- [ ] Site URL configurada en Supabase
- [ ] Redirect URLs agregadas en Supabase (localhost + producción)
- [ ] Template de email verificado
- [ ] Magic Link probado en localhost
- [ ] Magic Link probado en producción
- [ ] Middleware protegiendo rutas del dashboard
- [ ] Callback funcionando correctamente
- [ ] No hay errores en la consola de Vercel

---

## 🔗 **7. Links Útiles**

- **Supabase Docs - Auth:** https://supabase.com/docs/guides/auth
- **Next.js Middleware:** https://nextjs.org/docs/app/building-your-application/routing/middleware
- **Vercel Environment Variables:** https://vercel.com/docs/concepts/projects/environment-variables
- **Supabase SSR:** https://supabase.com/docs/guides/auth/server-side

---

## 💡 **8. Notas Importantes**

1. **El Magic Link expira en 1 hora** por defecto. Puedes cambiarlo en Supabase → Project Settings → Auth → SMTP settings → Email OTP Expiry.

2. **Las cookies de sesión expiran en 7 días** por defecto. Se refrescan automáticamente si el usuario está activo.

3. **Siempre prueba en modo incógnito** después de hacer cambios en la autenticación para evitar problemas de cache.

4. **En desarrollo**, si cambias las variables de entorno, debes reiniciar `npm run dev`.

5. **En producción**, si cambias las variables de entorno en Vercel, debes hacer un nuevo deployment para que se apliquen.

---

¡Listo! Tu app está preparada para producción. 🎉
