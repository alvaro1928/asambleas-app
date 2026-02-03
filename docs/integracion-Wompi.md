# Integración Wompi (pasarela de pagos)

Configuración necesaria para que la compra de tokens funcione con Wompi. Dominio: **https://epbco.cloud**

---

## Mapeo: Wompi ↔ Vercel (la llave es esta, la URL es esta)

| En Wompi (panel) | En Vercel (variable de entorno) | Valor / URL |
|------------------|----------------------------------|-------------|
| **URL de Eventos** | *(no es variable; se configura solo en el panel de Wompi)* | `https://epbco.cloud/api/pagos/webhook` |
| **Eventos** (Secretos) | `WOMPI_EVENTS_SECRET` | El valor que muestra Wompi en "Eventos" (ej. `prod_events_wiWGS0M01Z81ogK0VvPOTrJhNpwpPqNa`) |
| **Llave pública** | `WOMPI_PUBLIC_KEY` *(opcional)* | El valor de "Llave pública" (ej. `pub_prod_W78D7S6YJsZP2rkC1CTQvUzmH0TSb6Qx`) |
| **Llave privada** | `WOMPI_PRIVATE_KEY` *(opcional)* | El valor de "Llave privada" (ej. `prv_prod_...`) |
| **Integridad** (Secretos) | *(no se usa en esta app)* | — |
| *(Checkout: a dónde envías al usuario a pagar)* | `NEXT_PUBLIC_PASARELA_PAGOS_URL` | URL completa de tu página de checkout |

**Resumen directo:**

- **La URL de Eventos** es: `https://epbco.cloud/api/pagos/webhook` → pégala en Wompi en "URL de Eventos" y Guardar.
- **La llave Eventos** es el secreto que ves en Wompi en "Eventos" → en Vercel crea la variable `WOMPI_EVENTS_SECRET` y pega ese valor.

También puedes usar el nombre antiguo `WEBHOOK_PAGOS_SECRET` en lugar de `WOMPI_EVENTS_SECRET`; la app acepta los dos.

---

## URLs listas para copiar

### En Wompi (URL de Eventos)

```
https://epbco.cloud/api/pagos/webhook
```

Pégala en **Seguimiento de transacciones → URL de Eventos** y pulsa **Guardar**. Configúrala en Sandbox y en Producción si Wompi lo pide por ambiente.

### En Vercel (variables de entorno)

En **Settings → Environment Variables** del proyecto:

| Nombre en Vercel | Valor (copiar de Wompi) |
|------------------|-------------------------|
| `WOMPI_EVENTS_SECRET` | Lo que muestra Wompi en **Secretos → Eventos** (ej. `prod_events_wiWGS0M01Z81ogK0VvPOTrJhNpwpPqNa`) |
| `NEXT_PUBLIC_PASARELA_PAGOS_URL` | URL de tu página de checkout (donde el usuario paga) |

Opcionales (si más adelante creas transacciones por API):

| Nombre en Vercel | Valor (copiar de Wompi) |
|------------------|-------------------------|
| `WOMPI_PUBLIC_KEY` | **Llave pública** |
| `WOMPI_PRIVATE_KEY` | **Llave privada** |

Después de cambiar variables, haz **redeploy** en Vercel.

---

## 1. Panel de Wompi (Configuraciones avanzadas para programadores)

### URL de Eventos

- En **Seguimiento de transacciones → URL de Eventos** usa solo esta URL:

```
https://epbco.cloud/api/pagos/webhook
```

- No uses `/dashboard` ni la raíz del dominio.
- Guardar en Sandbox y en Producción según corresponda.

### Llaves y secretos (qué es cada uno)

| En Wompi | En Vercel | Uso en la app |
|----------|-----------|----------------|
| **Llave pública** | `WOMPI_PUBLIC_KEY` (opcional) | Para uso futuro en front si se inician pagos desde el cliente. |
| **Llave privada** | `WOMPI_PRIVATE_KEY` (opcional) | Para crear transacciones por API desde el backend. |
| **Eventos** | `WOMPI_EVENTS_SECRET` | **Obligatorio.** Verificación de firma del webhook. |
| **Integridad** | — | No se usa en esta integración. |

---

## 2. Variables de entorno en Vercel

| Variable | Valor | Dónde se usa |
|----------|--------|----------------|
| `WOMPI_EVENTS_SECRET` | Valor de **Eventos** de Wompi (`prod_events_...` en producción). | Webhook `/api/pagos/webhook` para validar que el evento viene de Wompi. |
| `NEXT_PUBLIC_PASARELA_PAGOS_URL` | URL del checkout (página de pago). Debe aceptar por query: `user_id`, `conjunto_id`, `cantidad_tokens`, `monto_total_cop`. | Frontend y `/api/pagos/checkout-url`. |

Alternativa: puedes seguir usando `WEBHOOK_PAGOS_SECRET` con el valor de **Eventos**; la app lo acepta igual que `WOMPI_EVENTS_SECRET`.

---

## 3. Referencia de la transacción

Para acreditar los tokens al gestor correcto, la transacción en Wompi debe llevar la **referencia** en este formato:

```
REF_<user_id>_<timestamp>
```

- `user_id`: UUID del gestor en Supabase Auth.
- `timestamp`: número (ej. `Date.now()`).

Quien cree la transacción (tu checkout o tu backend) debe enviar esa referencia a Wompi al crear el pago.

---

## 4. Resumen rápido

1. **Wompi – URL de Eventos:** `https://epbco.cloud/api/pagos/webhook` → Guardar.
2. **Vercel –** `WOMPI_EVENTS_SECRET` = valor de **Eventos** de Wompi; `NEXT_PUBLIC_PASARELA_PAGOS_URL` = URL de checkout.
3. **Redeploy** en Vercel después de cambiar variables.
4. **Checkout:** referencia `REF_<user_id>_<timestamp>` al crear la transacción en Wompi.

Cuando un pago se apruebe, Wompi enviará el evento a `https://epbco.cloud/api/pagos/webhook`, la app verificará la firma con `WOMPI_EVENTS_SECRET` y acreditará los tokens al gestor según la referencia.
