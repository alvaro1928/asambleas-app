# Guía: Tokens y funcionalidades

## Modelo: Billetera por gestor

- Los tokens viven en **`profiles.tokens_disponibles`** (por usuario/gestor), no por conjunto.
- Un mismo gestor puede tener varias filas en `profiles` (una por conjunto); el saldo que se usa es el **máximo** entre todas sus filas (billetera única).
- **1 token = 1 unidad de vivienda.** El costo al activar una asamblea = número de **unidades** del conjunto (ej. 500 unidades → 500 tokens).

---

## Flujo resumido

1. **Entras** a la asamblea, creas preguntas, importas unidades, registras votos a nombre de residentes → **no se consumen tokens** por esas acciones en sí.
2. **Activas la asamblea** (borrador → activa) → debe cumplirse **saldo ≥ unidades del conjunto** (1 token = 1 unidad). Tras activar, la asamblea queda habilitada para enlace, acta, etc.; el detalle de débito en billetera sigue la lógica vigente en backend (habitualmente cobro asociado a esa activación).
3. **Votación pública y LOPD** — Con el acceso público abierto, el cobro por **aceptación del tratamiento de datos (LOPD)** en la **sesión** actual sigue reglas de umbral: **primeras 5 unidades distintas** que acepten en esa sesión sin cobro por ese concepto; **desde la 6.ª unidad nueva** en la misma sesión, **1 crédito por unidad** (sin cobro retroactivo a las cinco primeras). La **misma unidad** no paga dos veces en la **misma sesión** aunque use varios dispositivos. **Cerrar** el acceso (Desactivar votación) incrementa el número de sesión; al **volver a abrir**, los votantes pasan de nuevo por LOPD y el cobro vuelve a aplicar según esas reglas al conectarse.
4. **WhatsApp masivo** (p. ej. desde Unidades) — puede debitar tokens según **tokens por mensaje** configurados en Super Admin → WhatsApp.
5. **Generas o descargas el acta** (PDF) — **no hay cargo adicional de tokens por elegir la versión con tabla de auditoría**; puede existir requisito de saldo/plan para acceder a la vista del acta según la interfaz. **Certificación OpenTimestamps** (si está activada) no implica compra de tokens extra por ese concepto.

---

## Qué NO consume tokens (créditos) en la práctica habitual

- Entrar al panel, crear preguntas, importar unidades, registrar votos a nombre de un residente, **activar la asamblea como acción de menú** (el requisito de saldo es aparte).
- **Elegir descargar el acta con auditoría** frente a la versión pública — no se descuenta un token *extra* por esa elección.

---

## Qué SÍ puede consumir tokens (créditos)

- **Saldo mínimo al activar la asamblea** — según unidades del conjunto (ver validación en app).
- **Aceptación LOPD** en sesión de votación pública — tras el umbral de la sesión (ver arriba).
- **Envíos masivos por WhatsApp** — según configuración (tokens por mensaje).
- Otras operaciones que la **interfaz** indique explícitamente como de pago antes de ejecutar.

---

## Cómo obtener tokens

1. **Bono de bienvenida:** al registrarte (crear conjunto o primer acceso) puedes recibir un bono configurado en Super Admin (ej. 50 tokens).
2. **Super Administración:** un super admin puede **establecer** el saldo exacto o **sumar** tokens a cualquier gestor (Super Admin → Créditos → Gestores).
3. **Compra (pasarela Wompi):** desde el Dashboard o desde la asamblea, botón "Recargar" / "Comprar tokens". Se abre la pasarela; al pagar, el webhook acredita los tokens en tu billetera.

---

## Asamblea de pruebas (sandbox)

- Desde el **Dashboard** o el **listado de Asambleas** puedes usar el botón **"Probar en sandbox"** (también la URL `/dashboard/asambleas?demo=1`).
- Se crea una asamblea de demostración con datos de ejemplo (10 unidades, 2 preguntas, ya activada). **No se consumen tokens.** Sirve para explorar el Centro de Control, el enlace de votación y el acta sin compromiso. El acta demo lleva la marca "BORRADOR DE PRUEBA — SIN VALIDEZ LEGAL".

---

## Validación en la app

| Acción | Notas |
|--------|--------|
| Entrar a asamblea, crear preguntas, importar unidades, registrar votos por residentes | No consumen tokens por esas acciones en sí. |
| **Activar la asamblea** | Se exige saldo suficiente (costo alineado a unidades). Asambleas demo (`is_demo`) no consumen. |
| **Votación pública + LOPD** | Consumo por sesión según umbral (5+1); ver RPC/API de consentimiento. |
| **WhatsApp masivo** | Según `tokens_por_mensaje_whatsapp`. |
| **Generar / descargar acta** | Sin cargo extra por versión con auditoría; requisitos de acceso según pantalla. |

---

## Referencias

- [RESUMEN-TOKENS.md](../RESUMEN-TOKENS.md) — Resumen técnico y flujo del webhook.
- [GUIA-MODALES-Y-LEGAL.md](GUIA-MODALES-Y-LEGAL.md) — Modal de guía unificada en dashboard.
- [integracion-Wompi.md](../integracion-Wompi.md) — Configuración de la pasarela de pagos.
- `supabase/SESION-Y-TOKENS-CONSENTIMIENTO.sql` — Sesión LOPD y consumos.
