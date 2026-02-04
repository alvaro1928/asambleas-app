# Resumen: lógica de tokens (billetera por gestor)

## 1. Modelo actual: **Billetera por gestor**

- **Antes (obsoleto):** Los tokens estaban en la tabla `organizations` (por conjunto) y había planes por conjunto (plan_type, plan_active_until, etc.).
- **Ahora:** Los tokens están en la tabla **`profiles`** (por persona/gestor). Cada fila de `profiles` tiene `tokens_disponibles`. Un mismo usuario puede tener varias filas (una por conjunto donde es owner/admin); el saldo que se usa es el de su billetera (por convenio se mantiene el mismo valor en todas sus filas o se toma el máximo).

## 2. Dónde se guardan los tokens

| Dónde | Qué |
|-------|-----|
| **`profiles.tokens_disponibles`** | Saldo de la billetera del gestor (usuario). Se lee y se actualiza por `user_id` o por `id` de la fila. |
| **`organizations`** | En tu esquema (migración billetera por gestor) **ya no** tiene `plan_type`, `tokens_disponibles`, etc. Solo datos del conjunto (nombre, slug, nit, etc.). |

## 3. Cómo se usan los tokens

- **Regla:** 1 token = 1 unidad de vivienda.
- **Costo de una operación** en un conjunto = número de **unidades** de ese conjunto (ej. 50 unidades → 50 tokens por operación).
- **Operación que consume tokens:** solo **activar la asamblea** (cobro único; al activar se descuentan los tokens y se marca `pago_realizado`; eso habilita generar el acta cuantas veces quieras sin nuevo cobro).
- **No consumen tokens:** crear asambleas, crear preguntas, importar unidades, **generar el acta** (ya habilitada tras activar), **registrar votos manuales**.

## 4. Quién puede operar

- Para **entrar** a una asamblea y configurarla (crear preguntas, unidades) **no se exigen tokens**.
- Para **activar la asamblea** sí se exige: **`profiles.tokens_disponibles` ≥ costo (unidades del conjunto)**. Si no tiene saldo, puede comprar tokens desde el modal. Tras activar, puede **generar el acta** cuantas veces quiera sin nuevo cobro.
- El saldo se lee desde **`/api/dashboard/organization-status`** (por conjunto activo): se usa el **máximo** de `tokens_disponibles` de todas las filas del usuario (id o user_id).

## 5. Cómo se obtienen tokens

1. **Bono de bienvenida:** al crear perfil (p. ej. al crear un conjunto), el trigger en DB puede asignar 50 tokens (según migración).
2. **Super Administración:** un admin asigna o suma tokens desde Super Admin → Gestores (PATCH actualiza `profiles.tokens_disponibles` por `user_id` e `id`).
3. **Compra (pasarela):** el botón "Comprar tokens" llama a `/api/pagos/checkout-url`. Si está configurada `WOMPI_PRIVATE_KEY`, el backend crea un payment link en Wompi y devuelve la URL de checkout de Wompi; el usuario paga en la pasarela y el webhook acredita tokens en `profiles` del gestor. No hace falta `NEXT_PUBLIC_PASARELA_PAGOS_URL` (ver [integracion-Wompi.md](integracion-Wompi.md)).

## 6. Flujo de compra (pasarela)

- El usuario pulsa "Comprar tokens" → la app llama a `POST /api/pagos/checkout-url` con `user_id` (y opcionalmente `conjunto_id`, `cantidad_tokens`).
- El backend crea el link de pago en Wompi (referencia corta en `pagos_checkout_ref`) y devuelve la URL de Wompi (`https://checkout.wompi.co/l/...`).
- El usuario paga en la pasarela (Wompi); Wompi envía el evento al webhook `/api/pagos/webhook`.
- El webhook actualiza **`profiles.tokens_disponibles`** del gestor según la referencia y registra en `pagos_log`.

## 7. Validación rápida

- [ ] Los tokens están en **`profiles.tokens_disponibles`**, no en `organizations`.
- [ ] El costo por operación = **unidades del conjunto** (1 token = 1 unidad).
- [ ] Super Admin puede **asignar/sumar tokens** a gestores (PATCH por `user_id` e `id`).
- [ ] El botón **"Comprar tokens"** está visible para el usuario logueado (Dashboard y donde se muestre la billetera). Al pulsar, se llama al API; si la pasarela está configurada (`WOMPI_PRIVATE_KEY`), se abre el checkout de Wompi; si no, se muestra mensaje de contacto/admin.

Si algo no coincide con tu producto (por ejemplo, bono distinto de 50 o otra regla de costo), se ajusta la migración o la config y este doc se actualiza.
