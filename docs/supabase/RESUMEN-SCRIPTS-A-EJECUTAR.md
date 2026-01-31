# Resumen: scripts de base de datos a ejecutar en Supabase

Ejecuta estos scripts **en el SQL Editor de Supabase**, en el orden indicado. Los archivos `.sql` están en la carpeta **`supabase/`** del repositorio. Todos son idempotentes (se pueden correr más de una vez).

---

## Orden recomendado

| # | Script | Qué hace |
|---|--------|----------|
| 1 | **MARCAR-SALIDA-QUORUM.sql** | Función para marcar salida del votante (`presente_virtual = false`). Necesario para el registro de sesiones activas. |
| 2 | **AGREGAR-ULTIMA-ACTIVIDAD-QUORUM.sql** | Columna `ultima_actividad` en `quorum_asamblea` y función de ping. El registro de ingresos filtra por actividad reciente (~5 min). |
| 3 | **AGREGAR-SUSCRIPCIONES-ORGANIZATIONS.sql** | En `organizations`: `plan_type`, `plan_active_until`, `is_pilot`. Base para planes Gratis/Pro/Pilot. |
| 4 | **AGREGAR-PAGOS-ORGANIZATIONS.sql** | En `organizations`: `plan_status`, `subscription_id`, `last_payment_date`. Crea tabla **pagos_historial** para transacciones. |
| 5 | **AGREGAR-UMBRAL-APROBACION.sql** | En `preguntas`: columna `umbral_aprobacion` (%) para mayorías calificadas y “Aprobado / No aprobado”. |
| 6 | **OPTIMIZAR-INDICES-SLOW-QUERIES.sql** | Índices para mejorar rendimiento (votos, preguntas, opciones, unidades, asambleas). |
| 7 | **ROL-SUPER-ADMIN.sql** | Rol super admin: tabla `app_config`, función `is_super_admin()` y políticas RLS para acceso total sin depender de `organization_id`. Después: `UPDATE app_config SET value = 'tu@correo.com' WHERE key = 'super_admin_email';` |
| 8 | **WOMPI-CONJUNTOS-Y-PAGOS-LOG.sql** | Integración Wompi: en `organizations` añade `subscription_status`, `wompi_reference` (y asegura `plan_type`, `plan_active_until`). Crea tabla `pagos_log` (id, organization_id, monto, wompi_transaction_id, estado, created_at). RLS en `pagos_log` para que solo el backend (service_role) escriba. |
| 9 | **PLANES-TABLA-Y-SEED.sql** | Tabla **planes** (key, nombre, precio_cop_anual) para administrar planes desde super-admin. Seed: free, pro, pilot. Permite editar nombres y precios sin variables de entorno. |
| 10 | **AGREGAR-LIMITES-PLANES.sql** | En **planes**: columnas `max_preguntas_por_asamblea` e `incluye_acta_detallada`. La app usa estos valores para el límite de preguntas por asamblea y para habilitar/ocultar acta con auditoría. |

---

## Lista rápida (copiar y pegar)

```
1. MARCAR-SALIDA-QUORUM.sql
2. AGREGAR-ULTIMA-ACTIVIDAD-QUORUM.sql
3. AGREGAR-SUSCRIPCIONES-ORGANIZATIONS.sql
4. AGREGAR-PAGOS-ORGANIZATIONS.sql
5. AGREGAR-UMBRAL-APROBACION.sql
6. OPTIMIZAR-INDICES-SLOW-QUERIES.sql
7. ROL-SUPER-ADMIN.sql
8. WOMPI-CONJUNTOS-Y-PAGOS-LOG.sql
9. PLANES-TABLA-Y-SEED.sql
10. AGREGAR-LIMITES-PLANES.sql
```

---

## Notas

- **Base:** Se asume que ya tienes creadas las tablas base (`organizations`, `asambleas`, `preguntas`, `quorum_asamblea`, etc.), por ejemplo con `schema.sql` o tus migraciones iniciales.
- **1 y 2:** Si el “Registro de ingresos” y la salida de votación no te importan aún, puedes posponer 1 y 2.
- **3 y 4:** Imprescindibles para el modelo de negocio (planes, límite de preguntas, acta Pro) y para el webhook de pagos.
- **5:** Opcional si no usas umbral de aprobación por pregunta.
- **6:** Recomendado si tienes muchas votaciones o consultas lentas.
