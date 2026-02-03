# Configurar Wompi (pasarela de pagos)

La configuración de Wompi para la compra de tokens está documentada en un único lugar:

**[../integracion-Wompi.md](../integracion-Wompi.md)**

Ahí encontrarás:

- **Opción 1 (recomendada):** La pasarela se encarga del checkout. Variables: `WOMPI_EVENTS_SECRET` y `WOMPI_PRIVATE_KEY`. URL de Eventos en Wompi: `https://TU_DOMINIO/api/pagos/webhook`. No hace falta `NEXT_PUBLIC_PASARELA_PAGOS_URL`.
- Mapeo Wompi ↔ Vercel, URLs listas para copiar, referencia de la transacción (ref corta en `pagos_checkout_ref` o legacy `REF_<user_id>_<timestamp>`).
- Resumen rápido y panel de Wompi.

Para variables de entorno en general, ver también [VARIABLES-ENTORNO-VERCEL.md](VARIABLES-ENTORNO-VERCEL.md).
