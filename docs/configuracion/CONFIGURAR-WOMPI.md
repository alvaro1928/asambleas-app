# Configurar Wompi

Para que los pagos de Plan Pro funcionen con Wompi, necesitamos lo siguiente.

---

## 1. Las 4 llaves de Wompi y dónde usarlas

En el panel de Wompi (Configuración → Integración / Llaves) aparecen **4 valores**. Así los usamos en la app:

| En Wompi | Variable en tu `.env` | Uso en la app |
|----------|------------------------|---------------|
| **Llave pública** | `NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA` | Frontend: Widget, checkout, crear transacciones desde el cliente. Es pública (puede ir en el navegador). |
| **Llave privada** | `WOMPI_LLAVE_PRIVADA` (opcional) | Solo si tu backend llama a la API de Wompi (consultar transacción, reversar, etc.). **No la expongas en el frontend.** |
| **Eventos** (Secretos para integración técnica) | `WOMPI_EVENTOS` (opcional) | No la usamos hoy en el webhook; nuestro webhook verifica con **Integridad**. |
| **Integridad** (Secretos para integración técnica) | `WOMPI_INTEGRIDAD` | Backend: verificación **SHA256** del webhook `transaction.updated`. Es la que usa `/api/pagos/webhook` para comprobar que el evento viene de Wompi. |

**Resumen:** necesitas copiar en tu `.env` la **Llave pública** (`NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA`) y el secreto de **Integridad** (`WOMPI_INTEGRIDAD`). La **Llave privada** solo si haces llamadas desde tu servidor a Wompi. **Eventos** no hace falta configurarla en la app para el flujo actual.

---

## 2. Variables de entorno a configurar

Añade esto en **`.env.local`** (y en Vercel o tu hosting):

| Variable | Dónde la sacas | Para qué sirve |
|----------|----------------|----------------|
| **`NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA`** | Wompi → **Llave pública** | Widget o checkout en el frontend (pago desde la app). |
| **`WOMPI_INTEGRIDAD`** | Wompi → Secretos para integración técnica → **Integridad** | Para que `/api/pagos/webhook` verifique la firma SHA256 y nadie más pueda activar planes. |
| **`NEXT_PUBLIC_PASARELA_PAGOS_URL`** (opcional) | Si usas **página de pago hospedada** por Wompi | El botón "Actualizar a Pro" del dashboard llevará a esa URL con `?conjunto_id=<uuid>`. |

Ejemplo (pruebas con llaves `test_`):

```env
# Wompi - Llave pública (copia del panel)
NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA=pub_test_xxxxxxxxxxxx

# Integridad (Secretos para integración técnica) → verificación del webhook
WOMPI_INTEGRIDAD=test_integrity_xxxxxxxxxxxx

# Opcional: URL de checkout hospedado (si no usas Widget)
# NEXT_PUBLIC_PASARELA_PAGOS_URL=https://checkout.wompi.co/...
```

En **producción** sustituye por las llaves de producción (sin prefijo `test_`).

---

## 3. Lo que debes configurar en el panel de Wompi

### Webhook (notificaciones de pago)

1. Entra a **Wompi** → **Configuración / Webhooks** (o **Integración**).
2. **URL del webhook:**  
   `https://TU_DOMINIO/api/pagos/webhook`  
   Ejemplo: `https://asambleas-app.vercel.app/api/pagos/webhook`
3. **Eventos:** activa el que notifique cuando una transacción cambie de estado (p. ej. "Transaction approved" o "transaction.updated").
4. **Event Secret / Firma de integridad:**  
   - Crea o copia un secreto (string largo y aleatorio).  
   - Pégalo en Wompi en "Event Secret" (o el nombre que use Wompi).  
   - **El mismo valor** debe estar en tu `.env` como **`WOMPI_INTEGRIDAD`**.

### Referencia del pago (para saber a qué conjunto activar Pro)

El webhook **`/api/pagos/webhook`** está preparado para Wompi:

- **Evento:** `transaction.updated`.
- **Firma:** se verifica la integridad con **SHA256** usando el secreto **Integridad** de Wompi (variable `WOMPI_INTEGRIDAD`). Wompi envía en el payload un objeto `signature` con `properties`, `timestamp` y `checksum`; el servidor concatena los valores indicados en `properties`, el `timestamp` y tu secreto, calcula SHA256 y lo compara con `checksum` (o con el header `X-Event-Checksum`).
- **Referencia:** debe tener el formato **`REF_<conjunto_id>_<timestamp>`**. Ejemplo: `REF_550e8400-e29b-41d4-a716-446655440000_1234567890`. El webhook extrae el UUID del conjunto de ahí.
- **Lógica APPROVED:** se lee el precio del Plan Pro en la tabla `planes` (campo `precio_por_asamblea_cop` donde `key = 'pro'`). Si el monto del pago coincide con ese precio (en COP o en centavos según Wompi), se suma **1** a `tokens_disponibles` de la cuenta (conjunto) y se registra la transacción en **`pagos_log`** con estado `APPROVED`, para que cuente en "Dinero total recaudado" del Super Admin.
- **Si el pago no es APPROVED:** se registra la transacción en **`pagos_log`** (con el estado recibido, p. ej. DECLINED, ERROR) cuando se puede extraer el `conjunto_id` de la referencia, para que puedas revisarlo.

Al crear la transacción en Wompi (Widget o backend), configura la **referencia** con ese formato para que el webhook sepa a qué conjunto activar el plan.

---

## 4. Resumen rápido

**Necesito de ti:**

1. **Llave pública** (Wompi) → para `NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA`
2. **Integridad** (Secretos para integración técnica en Wompi) → para `WOMPI_INTEGRIDAD`
3. **(Opcional)** URL de checkout hospedado → para `NEXT_PUBLIC_PASARELA_PAGOS_URL`
4. **URL base de tu app en producción** (ej. `https://asambleas-app.vercel.app`) → para configurar la URL del webhook en Wompi: `https://TU_APP/api/pagos/webhook`

Con 1, 2 y 4 podemos cerrar la configuración. Si Wompi no envía `metadata.conjunto_id`, en el siguiente paso adaptamos el webhook para leer la referencia de Wompi y extraer el ID del conjunto.
