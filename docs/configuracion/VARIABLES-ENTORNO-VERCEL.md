# Variables de entorno para Vercel

Lista de **todas** las variables de entorno que debe tener el proyecto en Vercel (o en `.env.local` en desarrollo). Algunas las creaste al principio para la BD; aquí están agrupadas con las demás.

---

## 1. Base de datos (Supabase)

| Variable | Obligatoria | Dónde sacarla | Uso |
|----------|-------------|---------------|-----|
| **`NEXT_PUBLIC_SUPABASE_URL`** | Sí | Supabase → Project Settings → API → Project URL | URL del proyecto (cliente y API). |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Sí | Supabase → Project Settings → API → anon public | Clave pública anónima (auth, RLS). |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Sí | Supabase → Project Settings → API → service_role (secret) | Solo backend: webhook de pagos, super-admin, operaciones que bypasean RLS. **No exponer en el cliente.** |

---

## 2. Auth / Login

| Variable | Obligatoria | Dónde sacarla | Uso |
|----------|-------------|---------------|-----|
| **`NEXT_PUBLIC_SITE_URL`** | Recomendada en producción | URL de tu app (ej. `https://asambleas-app.vercel.app`) | Callback OAuth después del login. Si no está, se infiere desde la request. |

---

## 3. Super Administración (`/super-admin`)

| Variable | Obligatoria | Dónde sacarla | Uso |
|----------|-------------|---------------|-----|
| **`NEXT_PUBLIC_ADMIN_EMAIL`** | Sí (para super-admin) | Tu email | Email que puede entrar a `/super-admin` y ver el enlace "Administración" en el dashboard. |
| **`SUPER_ADMIN_EMAIL`** | Sí (para API super-admin) | Mismo email que arriba | API `/api/super-admin/conjuntos`: listar conjuntos y gestionar planes. Debe ser el mismo que `NEXT_PUBLIC_ADMIN_EMAIL`. |

---

## 4. Wompi (pagos Plan Pro)

| Variable | Obligatoria | Dónde sacarla | Uso |
|----------|-------------|---------------|-----|
| **`NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA`** | Sí (si usas pagos) | Wompi → Llave pública | Frontend: Widget / checkout. |
| **`WOMPI_INTEGRIDAD`** | Sí (si usas webhook) | Wompi → Secretos para integración técnica → **Integridad** | Backend: verificación SHA256 del webhook `transaction.updated` en `/api/pagos/webhook`. |
| **`NEXT_PUBLIC_PASARELA_PAGOS_URL`** | Opcional | URL de checkout hospedado por Wompi | Botón "Actualizar a Pro" del dashboard: redirige a esta URL con `?conjunto_id=<uuid>`. |
| **`WOMPI_LLAVE_PRIVADA`** | Opcional | Wompi → Llave privada | Solo si tu backend llama a la API de Wompi (consultar transacción, reversar, etc.). |
| **`WOMPI_EVENTOS`** | Opcional | Wompi → Secretos → Eventos | No la usamos hoy en el webhook (verificamos con Integridad). |

### Llaves Wompi (prueba) – copiar y pegar en Vercel

Bloque listo para **Vercel → Settings → Environment Variables**. Son llaves de **prueba (Sandbox)**; cuando Wompi te active producción, sustituye por las de producción.

```
NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA=pub_test_aGHqimadrTMPu1CCE10ISDBUSK9NURwb
WOMPI_INTEGRIDAD=test_integrity_55x6A2jue80RD0p1phURdgLtJLRybQE8
WOMPI_LLAVE_PRIVADA=prv_test_qjjPb9Y3QQZHeRfEWlAcwS0Y5j0gxneq
WOMPI_EVENTOS=test_events_oR6WKYwkq4u1MrVW5EUsrvsf5h88KDJB
```

**En el panel de Wompi** (Configuraciones avanzadas → Seguimiento de transacciones), pon en **URL de Eventos** esta URL (no `/dashboard`):

```
https://asambleas-app-epbco.vercel.app/api/pagos/webhook
```

Luego pulsa **Guardar** para que Wompi envíe los eventos de pago a tu app.

---

## 5. Landing y contacto (Plan Pro / WhatsApp)

| Variable | Obligatoria | Dónde sacarla | Uso |
|----------|-------------|---------------|-----|
| **`NEXT_PUBLIC_PLAN_PRO_URL`** | Opcional | URL de ventas/contacto o WhatsApp | Enlaces "Plan Pro" y "Actualizar a Pro". Tras pagar, el usuario vuelve al **mismo dashboard** y recarga para ver privilegios Pro. |
| **`NEXT_PUBLIC_PRECIO_PRO_ANUAL`** | Opcional | Precio en COP por año (ej. `200000`) | Lo que cobras por Plan Pro por conjunto/año. Por defecto 200.000 COP. Se muestra en dashboard y landing. Para Wompi: valor × 100 = centavos. |
| **`NEXT_PUBLIC_WHATSAPP_NUMBER`** | Opcional | Número WhatsApp con código país (ej. `573001234567`) | Botones de contacto por WhatsApp en la landing. |

---

## Resumen: qué poner en Vercel

Copia y pega en **Vercel → Project → Settings → Environment Variables** (o usa el mismo bloque en `.env.local`). Sustituye los valores de ejemplo por los tuyos.

```env
# ========== Base de datos (Supabase) ==========
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ========== Auth ==========
NEXT_PUBLIC_SITE_URL=https://tu-app.vercel.app

# ========== Super Administración ==========
NEXT_PUBLIC_ADMIN_EMAIL=tu_correo@ejemplo.com
SUPER_ADMIN_EMAIL=tu_correo@ejemplo.com

# ========== Wompi (pagos) ==========
NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA=pub_test_xxxxxxxxxxxx
WOMPI_INTEGRIDAD=test_integrity_xxxxxxxxxxxx
# NEXT_PUBLIC_PASARELA_PAGOS_URL=https://checkout.wompi.co/...
# WOMPI_LLAVE_PRIVADA=...   # solo si el backend llama a la API de Wompi
# WOMPI_EVENTOS=...         # opcional, no usada en el webhook actual

# ========== Landing / contacto / precio Pro ==========
# NEXT_PUBLIC_PLAN_PRO_URL=https://wa.me/573001234567
# NEXT_PUBLIC_PRECIO_PRO_ANUAL=200000
# NEXT_PUBLIC_WHATSAPP_NUMBER=573001234567
```

---

## Notas

- Las que empiezan por **`NEXT_PUBLIC_`** se exponen al navegador; no pongas secretos ahí.
- **`SUPABASE_SERVICE_ROLE_KEY`** y **`WOMPI_INTEGRIDAD`** son secretas; no las expongas en el cliente.
- Para más detalle: **Wompi** → [CONFIGURAR-WOMPI.md](CONFIGURAR-WOMPI.md); **Super Admin** → [../referencia/SUPER-ADMIN.md](../referencia/SUPER-ADMIN.md).
