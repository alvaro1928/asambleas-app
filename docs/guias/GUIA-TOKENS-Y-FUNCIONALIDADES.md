# Guía: Tokens y funcionalidades

## Modelo: Billetera por gestor

- Los tokens viven en **`profiles.tokens_disponibles`** (por usuario/gestor), no por conjunto.
- Un mismo gestor puede tener varias filas en `profiles` (una por conjunto); el saldo que se usa es el **máximo** entre todas sus filas (billetera única).
- **1 token = 1 unidad de vivienda.** El costo al activar una asamblea = número de **unidades** del conjunto (ej. 500 unidades → 500 tokens).

---

## Flujo resumido

1. **Entras** a la asamblea, creas preguntas, importas unidades, registras votos a nombre de residentes → **no se consumen tokens**.
2. **Activas la asamblea** (borrador → activa) → **se cobran los tokens una sola vez** (costo = unidades del conjunto). La asamblea queda con `pago_realizado = true`.
3. **Generas el acta** → **no se cobra**. Puedes generar e imprimir el acta **cuantas veces quieras**; el cobro ya se hizo al activar.

---

## Qué NO consume tokens

- Entrar a la asamblea y ver la página.
- Crear asambleas, preguntas y opciones.
- Importar unidades.
- Registrar votos a nombre de un residente (el administrador puede registrar votos por unidad sin que se resten tokens).
- **Generar el acta** (una vez activada la asamblea).

Solo necesitas saldo suficiente **en el momento de activar la asamblea**.

---

## Qué SÍ consume tokens (cobro único)

- **Activar la asamblea** (pasar de borrador a activa).  
  Se descuentan los tokens **una sola vez** por esa asamblea. Ese pago habilita:
  - Compartir el enlace/QR para que voten los residentes.
  - Generar y descargar el acta **cuantas veces quieras** sin nuevo cobro.

---

## Cómo obtener tokens

1. **Bono de bienvenida:** al registrarte (crear conjunto o primer acceso) puedes recibir un bono configurado en Super Admin (ej. 50 tokens).
2. **Super Administración:** un super admin puede **establecer** el saldo exacto o **sumar** tokens a cualquier gestor (Super Admin → Créditos → Gestores).
3. **Compra (pasarela Wompi):** desde el Dashboard o desde la asamblea, botón "Recargar" / "Comprar tokens". Se abre la pasarela; al pagar, el webhook acredita los tokens en tu billetera.

---

## Validación en la app

| Acción | ¿Se exige saldo? |
|--------|-------------------|
| Entrar a asamblea, crear preguntas, importar unidades, registrar votos por residentes | No |
| **Activar la asamblea** | Sí. Se exige `tokens_disponibles >= costo (unidades)`. Si no tienes saldo, se muestra el modal para comprar tokens. |
| Generar el acta | No. Solo está habilitado si la asamblea ya fue activada (cobro único al activar). |

---

## Referencias

- [RESUMEN-TOKENS.md](../RESUMEN-TOKENS.md) — Resumen técnico y flujo del webhook.
- [integracion-Wompi.md](../integracion-Wompi.md) — Configuración de la pasarela de pagos.
