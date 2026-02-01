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
| **`NEXT_PUBLIC_PASARELA_PAGOS_URL`** (opcional) | Si usas **página de pago hospedada** | El botón "Comprar más tokens" llevará a esa URL con `?user_id=<uuid>` (y opcionalmente `conjunto_id`). La pasarela debe crear la transacción Wompi con referencia **`REF_<user_id>_<timestamp>`**. |

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

### Referencia del pago (Billetera por Gestor)

El webhook **`/api/pagos/webhook`** está preparado para Wompi con el modelo **Billetera de Tokens por Gestor**:

- **Evento:** `transaction.updated`.
- **Firma:** se verifica la integridad con **SHA256** usando el secreto de Wompi (variable `WEBHOOK_PAGOS_SECRET` o `WOMPI_INTEGRIDAD`). El servidor concatena los valores indicados en `signature.properties`, el `timestamp` y el secreto, calcula SHA256 y lo compara con `checksum`.
- **Referencia:** debe tener el formato **`REF_<user_id>_<timestamp>`**. Ejemplo: `REF_550e8400-e29b-41d4-a716-446655440000_1234567890`. El webhook extrae el **user_id** del gestor (auth.uid) de ahí. La pasarela de pagos debe recibir `user_id` en la URL (p. ej. desde el dashboard con `?user_id=xxx`) y usarlo al crear la transacción en Wompi.
- **Lógica APPROVED:** se lee el precio por token en la tabla `planes` (campo `precio_por_asamblea_cop` donde `key = 'pro'`). Si el monto coincide, se suma **1** a **`profiles.tokens_disponibles`** de todas las filas del gestor (`user_id`). Se registra en **`pagos_log`** con `organization_id` del primer perfil del usuario (para reportes).
- **Si el pago no es APPROVED:** se registra en **`pagos_log`** cuando hay `user_id` y un perfil con `organization_id`, para revisión.

Al crear la transacción en Wompi (Widget o pasarela hospedada), usa la **referencia** `REF_<user_id>_<timestamp>` para que el webhook acredite los tokens en la billetera del gestor.

---

## 4. Resumen rápido

**Necesito de ti:**

1. **Llave pública** (Wompi) → para `NEXT_PUBLIC_WOMPI_LLAVE_PUBLICA`
2. **Integridad** (Secretos para integración técnica en Wompi) → para `WOMPI_INTEGRIDAD`
3. **(Opcional)** URL de checkout hospedado → para `NEXT_PUBLIC_PASARELA_PAGOS_URL`
4. **URL base de tu app en producción** (ej. `https://asambleas-app.vercel.app`) → para configurar la URL del webhook en Wompi: `https://TU_APP/api/pagos/webhook`

Con 1, 2 y 4 podemos cerrar la configuración. Si Wompi no envía `metadata.conjunto_id`, en el siguiente paso adaptamos el webhook para leer la referencia de Wompi y extraer el ID del conjunto.
