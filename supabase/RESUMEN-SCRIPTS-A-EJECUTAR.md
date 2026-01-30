# Resumen: scripts de base de datos a ejecutar en Supabase

Ejecuta estos scripts **en el SQL Editor de Supabase**, en el orden indicado. Todos son idempotentes (se pueden correr más de una vez).

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
```

---

## Notas

- **Base:** Se asume que ya tienes creadas las tablas base (`organizations`, `asambleas`, `preguntas`, `quorum_asamblea`, etc.), por ejemplo con `schema.sql` o tus migraciones iniciales.
- **1 y 2:** Si el “Registro de ingresos” y la salida de votación no te importan aún, puedes posponer 1 y 2.
- **3 y 4:** Imprescindibles para el modelo de negocio (planes, límite de preguntas, acta Pro) y para el webhook de pagos.
- **5:** Opcional si no usas umbral de aprobación por pregunta.
- **6:** Recomendado si tienes muchas votaciones o consultas lentas.
