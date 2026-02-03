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

## 4. Wompi (pagos – Billetera de Tokens por Gestor)

Modelo **Billetera de Tokens por Gestor**: los tokens pertenecen al usuario (gestor). Al pulsar "Comprar tokens", el backend crea un *payment link* en Wompi y devuelve la URL de checkout de Wompi; el usuario paga en la pasarela y el webhook acredita los tokens en `profiles.tokens_disponibles` del gestor.

**Documentación detallada:** [integracion-Wompi.md](../integracion-Wompi.md) (URL de Eventos, variables, flujo Opción 1).

| Variable | Obligatoria (si usas pagos) | Dónde sacarla | Uso |
|----------|-----------------------------|---------------|-----|
| **`WOMPI_EVENTS_SECRET`** (o `WEBHOOK_PAGOS_SECRET`) | Sí | Wompi → Secretos → **Eventos** | Backend: verificación de firma del webhook `/api/pagos/webhook`. |
| **`WOMPI_PRIVATE_KEY`** | Sí | Wompi → **Llave privada** | Backend: `/api/pagos/checkout-url` crea el payment link y devuelve la URL de Wompi; la pasarela se encarga del checkout. |
| **`NEXT_PUBLIC_PASARELA_PAGOS_URL`** | No (Opción 1) | URL de tu página de checkout | Solo si no usas Opción 1: URL propia que recibe query y redirige a Wompi (Opción B). |
| **`WOMPI_PUBLIC_KEY`** | No | Wompi → Llave pública | Opcional; uso futuro en frontend. |

**En el panel de Wompi** (Seguimiento de transacciones → URL de Eventos), configura:

```
https://TU_DOMINIO/api/pagos/webhook
```

Ejemplo: `https://epbco.cloud/api/pagos/webhook`. Luego **Guardar**. Con `WOMPI_EVENTS_SECRET` y `WOMPI_PRIVATE_KEY` en Vercel no hace falta `NEXT_PUBLIC_PASARELA_PAGOS_URL`.

---

## 5. Landing, contacto y precio (ahora en Administración)

**Ya no se configuran por variables de entorno.** La URL de Plan Pro, el precio por token/asamblea, el número de WhatsApp y el color principal de la landing se gestionan desde **Super Admin → Ajustes** y desde la tabla de **Planes** (precio por asamblea). No hace falta definir `NEXT_PUBLIC_PLAN_PRO_URL`, `NEXT_PUBLIC_PRECIO_PRO_ANUAL` ni `NEXT_PUBLIC_WHATSAPP_NUMBER` en Vercel; la app lee esos valores de la base de datos.

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

# ========== Wompi (pagos – Opción 1: pasarela se encarga) ==========
WOMPI_EVENTS_SECRET=prod_events_xxxxxxxxxxxx
WOMPI_PRIVATE_KEY=prv_prod_xxxxxxxxxxxx
# NEXT_PUBLIC_PASARELA_PAGOS_URL=...  # solo si usas Opción B (página propia de checkout)
```

---

## Notas

- Las que empiezan por **`NEXT_PUBLIC_`** se exponen al navegador; no pongas secretos ahí.
- **`SUPABASE_SERVICE_ROLE_KEY`** y **`WOMPI_EVENTS_SECRET`** son secretas; no las expongas en el cliente.
- Para más detalle: **Wompi** → [integracion-Wompi.md](../integracion-Wompi.md); **Super Admin** → [../referencia/SUPER-ADMIN.md](../referencia/SUPER-ADMIN.md).
