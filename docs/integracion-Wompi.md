# Integración Wompi (pasarela de pagos)

Configuración necesaria para que la compra de tokens funcione con Wompi. Dominio: **https://epbco.cloud**

**Comportamiento actual (Opción 1 – la pasarela se encarga):**  
Al pulsar "Comprar tokens", la app llama a su API; el backend crea un *payment link* en Wompi y devuelve la URL de checkout de Wompi (`https://checkout.wompi.co/l/...`). El usuario paga en la pasarela (Wompi); no hace falta ninguna página `/checkout` ni `/pagar` en tu dominio ni configurar `NEXT_PUBLIC_PASARELA_PAGOS_URL`.

---

## Mapeo: Wompi ↔ Vercel (la llave es esta, la URL es esta)

| En Wompi (panel) | En Vercel (variable de entorno) | Valor / URL |
|------------------|----------------------------------|-------------|
| **URL de Eventos** | *(solo en panel Wompi)* | `https://epbco.cloud/api/pagos/webhook` |
| **Eventos** (Secretos) | `WOMPI_EVENTS_SECRET` | Valor de "Eventos" en Wompi (ej. `prod_events_...`) |
| **Llave privada** | `WOMPI_PRIVATE_KEY` | **Requerida** para que la app cree el link y redirija a Wompi (ej. `prv_prod_...`) |
| **Llave pública** | `WOMPI_PUBLIC_KEY` *(opcional)* | Para uso futuro en front. |
| **Integridad** (Secretos) | *(no se usa)* | — |
| *(Solo si no usas Opción 1)* | `NEXT_PUBLIC_PASARELA_PAGOS_URL` | URL de tu propia página de checkout (Opción B). |

**Resumen directo (Opción 1):**

- **URL de Eventos en Wompi:** `https://epbco.cloud/api/pagos/webhook` → Guardar.
- **En Vercel:** `WOMPI_EVENTS_SECRET` = valor de **Eventos** de Wompi; `WOMPI_PRIVATE_KEY` = **Llave privada** de Wompi. Con eso la pasarela se encarga del checkout; no hace falta `NEXT_PUBLIC_PASARELA_PAGOS_URL`.

Puedes usar `WEBHOOK_PAGOS_SECRET` en lugar de `WOMPI_EVENTS_SECRET`; la app acepta ambos.

---

## URLs listas para copiar

### En Wompi (URL de Eventos)

```
https://epbco.cloud/api/pagos/webhook
```

Pégala en **Seguimiento de transacciones → URL de Eventos** y pulsa **Guardar**. Configúrala en Sandbox y en Producción si Wompi lo pide por ambiente.

### En Vercel (variables de entorno) – Opción 1 (recomendada)

En **Settings → Environment Variables** del proyecto, para que la pasarela se encargue del checkout:

| Nombre en Vercel | Valor (copiar de Wompi) |
|------------------|-------------------------|
| `WOMPI_EVENTS_SECRET` | **Secretos → Eventos** (ej. `prod_events_wiWGS0M01Z81ogK0VvPOTrJhNpwpPqNa`) |
| `WOMPI_PRIVATE_KEY` | **Llave privada** (ej. `prv_prod_...`) |

Con estas dos variables la app crea el link de pago en Wompi y redirige al usuario a `https://checkout.wompi.co/l/...`. **No** hace falta `NEXT_PUBLIC_PASARELA_PAGOS_URL`.

Opcional: `WOMPI_PUBLIC_KEY` (Llave pública) para uso futuro. Después de cambiar variables, haz **redeploy** en Vercel.

---

## ¿Las páginas /checkout o /pagar las da Wompi o hay que crearlas?

**Wompi no te da una página** que reciba `user_id`, `conjunto_id`, etc. Wompi te da:
- Un **API** para crear “links de pago” (con monto, descripción, etc.).
- Una **URL de checkout** por cada link que crees (tipo `https://checkout.wompi.co/l/XXX`), a la que tú envías al usuario.

Por tanto, **o bien creas algo en tu lado, o bien la app lo hace por ti**:

1. **Opción A – La pasarela se encarga (implementada, recomendada)**  
   Al pulsar "Comprar tokens", el backend llama al API de Wompi, crea el link de pago (monto, referencia corta asociada al usuario) y devuelve la URL de Wompi. El usuario paga en la pasarela; **no necesitas** página `/checkout` ni `NEXT_PUBLIC_PASARELA_PAGOS_URL`. En Vercel solo hace falta `WOMPI_PRIVATE_KEY` y `WOMPI_EVENTS_SECRET`.

2. **Opción B – Tú creas una página en tu app**  
   Creas una ruta en tu sitio (ej. `https://epbco.cloud/checkout` o `/pagar`) que:
   - Reciba por query: `user_id`, `conjunto_id`, `cantidad_tokens`, `monto_total_cop`.
   - Con tu **llave privada**, llame al API de Wompi para crear el link de pago (monto, referencia, etc.).
   - Redirija al usuario a la URL que te devuelve Wompi (`https://checkout.wompi.co/l/...`).  
   En ese caso en `NEXT_PUBLIC_PASARELA_PAGOS_URL` pondrías la URL de esa página, por ejemplo:
   ```
   https://epbco.cloud/checkout
   ```

**Resumen:** Las páginas no las da Wompi; o las creas tú (opción B) o se hace todo desde la API del backend (opción A) y entonces no necesitas `NEXT_PUBLIC_PASARELA_PAGOS_URL`.

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

## 2. Variables de entorno en Vercel (Opción 1)

| Variable | Valor | Uso |
|----------|--------|-----|
| `WOMPI_EVENTS_SECRET` | Valor de **Eventos** de Wompi (`prod_events_...`). | Webhook `/api/pagos/webhook` para validar la firma del evento. |
| `WOMPI_PRIVATE_KEY` | **Llave privada** de Wompi (`prv_prod_...`). | `/api/pagos/checkout-url` crea el payment link y devuelve la URL de Wompi; la pasarela se encarga del checkout. |

Con Opción 1 no se usa `NEXT_PUBLIC_PASARELA_PAGOS_URL`. Alternativa: `WEBHOOK_PAGOS_SECRET` en lugar de `WOMPI_EVENTS_SECRET`.

---

## 3. Referencia de la transacción

La app admite dos formas de identificar al usuario al acreditar tokens:

- **Opción 1 (payment links):** El backend guarda una referencia corta (ej. `ck1a2b3c4d5`) en `pagos_checkout_ref` y la envía como `sku` al crear el link. En el webhook: si la `reference` del evento es nuestra, se busca por ella; si no (p. ej. PSE envía `test_xxx`), se usa `payment_link_id` para obtener el `sku` del link en Wompi y buscar el `user_id` en `pagos_checkout_ref`. Así los tokens se acreditan aunque Wompi muestre otra referencia en el comprobante.
- **Legacy:** Referencia `REF_<user_id>_<timestamp>`; el webhook extrae el `user_id` del string.

**Redirección tras el pago:** Al crear el link se envía `redirect_url` a tu app (p. ej. `https://tu-dominio/dashboard?pago=ok`). Configura `NEXT_PUBLIC_SITE_URL` en Vercel para que la URL base sea la correcta; así el usuario vuelve al dashboard después de pagar.

---

## 4. Resumen rápido (Opción 1 – pasarela se encarga)

1. **Wompi – URL de Eventos:** `https://epbco.cloud/api/pagos/webhook` → Guardar.
2. **Vercel:** `WOMPI_EVENTS_SECRET` = valor de **Eventos**; `WOMPI_PRIVATE_KEY` = **Llave privada**. Opcional: `NEXT_PUBLIC_SITE_URL` para que la redirección tras el pago apunte a tu dominio (ej. `https://epbco.cloud`).
3. **Redeploy** en Vercel.
4. El usuario pulsa "Comprar tokens" → la app crea el link en Wompi (con `redirect_url`) y abre `checkout.wompi.co` → paga → Wompi redirige al dashboard y envía el evento al webhook → la app acredita los tokens (por referencia o por `payment_link_id` + sku).
