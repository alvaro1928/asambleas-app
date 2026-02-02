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
- **Operaciones que consumen tokens** (en el momento de hacerlas):
  - Activar votación en una asamblea.
  - Descargar acta con auditoría.
  - Registrar voto manual (a nombre de un residente).
- **No consumen tokens:** crear asambleas, crear preguntas, importar unidades.

## 4. Quién puede operar

- El gestor puede hacer la operación si:  
  **`profiles.tokens_disponibles` (de ese usuario) ≥ costo (unidades del conjunto)**.
- El saldo se lee desde **`/api/dashboard/organization-status`** (por conjunto activo): ahí se obtiene `tokens_disponibles` del perfil del usuario para ese conjunto.

## 5. Cómo se obtienen tokens

1. **Bono de bienvenida:** al crear perfil (p. ej. al crear un conjunto), el trigger en DB puede asignar 50 tokens (según migración).
2. **Super Administración:** un admin asigna o suma tokens desde Super Admin → Gestores (PATCH actualiza `profiles.tokens_disponibles` por `user_id` e `id`).
3. **Compra (pasarela):** si está configurada `NEXT_PUBLIC_PASARELA_PAGOS_URL`, el botón "Comprar tokens" lleva a esa URL con `user_id` (y opcionalmente `conjunto_id`). Tras el pago, el webhook acredita tokens en `profiles` del gestor.

## 6. Flujo de compra (pasarela)

- La app envía al usuario a la URL de la pasarela con `user_id` (y a veces `conjunto_id`).
- La pasarela procesa el pago y notifica al backend (webhook).
- El webhook (`/api/pagos/webhook` o similar) actualiza **`profiles.tokens_disponibles`** del `user_id` correspondiente.

## 7. Validación rápida

- [ ] Los tokens están en **`profiles.tokens_disponibles`**, no en `organizations`.
- [ ] El costo por operación = **unidades del conjunto** (1 token = 1 unidad).
- [ ] Super Admin puede **asignar/sumar tokens** a gestores (PATCH por `user_id` e `id`).
- [ ] El botón **"Comprar tokens"** debe estar visible para el usuario (Dashboard y donde se muestre la billetera); si hay pasarela configurada, el botón lleva allí; si no, se puede mostrar igual con mensaje de contacto/admin.

Si algo no coincide con tu producto (por ejemplo, bono distinto de 50 o otra regla de costo), se ajusta la migración o la config y este doc se actualiza.
