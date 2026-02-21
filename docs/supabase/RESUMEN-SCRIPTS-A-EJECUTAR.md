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
| 9 | **PLANES-TABLA-Y-SEED.sql** | Tabla **planes** (key, nombre, precio_cop_anual) para administrar planes desde super-admin. Seed: free, pro, pilot. |
| 10 | **AGREGAR-LIMITES-PLANES.sql** | En **planes**: columnas `max_preguntas_por_asamblea` e `incluye_acta_detallada`. Límite de preguntas por asamblea y acta con auditoría. |
| 11 | **PRECIO-POR-ASAMBLEA-Y-TOKENS.sql** | En **planes**: `precio_por_asamblea_cop`. En **organizations**: `tokens_disponibles`. Tokens por cuenta; se descontan al usar funcionalidades. |
| 12 | **TOKENS-CONJUNTOS.sql** | Asegura columna `tokens_disponibles` en organizations. Plan Pro por asamblea: la cuenta consume 1 token al activar asamblea Pro. |
| 13 | **AGREGAR-TOKENS-INICIALES-PLANES.sql** | En **planes**: `tokens_iniciales` (Gratis: 2, Piloto: 10, Pro: null = ilimitado). Se asignan al conjunto al tener ese plan. |
| 14 | **AGREGAR-VIGENCIA-PLANES.sql** | En **planes**: `vigencia_meses` (Gratis: null, Piloto: 3, Pro: 12). Duración al asignar el plan a una cuenta. |
| 15 | **CONFIGURACION-GLOBAL-LANDING.sql** | Tabla o filas de configuración global para landing (color, WhatsApp, etc.). |
| 16 | **AGREGAR-COLOR-PRINCIPAL-CONFIG.sql** | Columna o clave `color_principal_hex` para la landing. Se edita en Super Admin → Ajustes. |
| 16b | **ADD-LANDING-TEXTOS-CONFIG.sql** | Columnas `texto_hero_precio`, `texto_ahorro`, `cta_whatsapp_text` en `configuracion_global`. Textos publicitarios editables y botón "Contactanos" (los créditos se venden en la app). |
| 17 | **ADD-IS-DEMO-ASAMBLEAS-UNIDADES.sql** | Columna `is_demo` en `asambleas` y `unidades` para la asamblea de pruebas (sandbox). No consumen tokens; restricciones de edición en la UI; acta con marca "DEMO - SIN VALIDEZ LEGAL". |
| 18 | **ADD-IS-ARCHIVED-ASAMBLEAS-PREGUNTAS.sql** | Columnas `is_archived` en `asambleas` y `preguntas`. Asambleas archivadas se muestran en pestaña "Archivadas"; preguntas archivadas no se incluyen en el acta ni en reportes. |
| 19 | **CONFIGURACION-SMTP-SUPER-ADMIN.sql** | Tabla `configuracion_smtp` para que el Super Admin configure el envío de correo (enlace de votación) desde Ajustes, sin usar variables de entorno. |
| 20 | **AGREGAR-CONFIG-PODERES-Y-CORREO.sql** | Columna `plantilla_adicional_correo` en `configuracion_poderes`. Permite al gestor añadir texto (ej. enlace Teams/Meet) a los correos de votación. |
| 21 | **CONFIGURACION-WHATSAPP-Y-TOKENS-POR-MENSAJE.sql** | Tabla `configuracion_whatsapp` (Token Meta, Phone Number ID, plantilla, `tokens_por_mensaje_whatsapp`). Añade `WhatsApp` a `billing_logs.tipo_operacion`. Para envío masivo por WhatsApp (cobro en tokens). |

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
11. PRECIO-POR-ASAMBLEA-Y-TOKENS.sql
12. TOKENS-CONJUNTOS.sql
13. AGREGAR-TOKENS-INICIALES-PLANES.sql
14. AGREGAR-VIGENCIA-PLANES.sql
15. CONFIGURACION-GLOBAL-LANDING.sql
16. AGREGAR-COLOR-PRINCIPAL-CONFIG.sql
16b. ADD-LANDING-TEXTOS-CONFIG.sql
17. ADD-IS-DEMO-ASAMBLEAS-UNIDADES.sql
18. ADD-IS-ARCHIVED-ASAMBLEAS-PREGUNTAS.sql
19. CONFIGURACION-SMTP-SUPER-ADMIN.sql
20. AGREGAR-CONFIG-PODERES-Y-CORREO.sql
21. CONFIGURACION-WHATSAPP-Y-TOKENS-POR-MENSAJE.sql
```

---

## Notas

- **Base:** Se asume que ya tienes creadas las tablas base (`organizations`, `asambleas`, `preguntas`, `quorum_asamblea`, etc.), por ejemplo con `schema.sql` o tus migraciones iniciales.
- **1 y 2:** Si el “Registro de ingresos” y la salida de votación no te importan aún, puedes posponer 1 y 2.
- **3 y 4:** Imprescindibles para el modelo de negocio (planes, límite de preguntas, acta Pro) y para el webhook de pagos.
- **5:** Opcional si no usas umbral de aprobación por pregunta.
- **6:** Recomendado si tienes muchas votaciones o consultas lentas.
- **11–14:** Modelo de negocio: tokens por cuenta, precio por asamblea, tokens iniciales y vigencia por plan. Imprescindibles para Super Admin (planes y conjuntos).
- **15–16:** Configuración global (landing, color). Necesarios para Super Admin → Ajustes.
- **17:** Asamblea de pruebas (sandbox): necesario si se usa el botón "Probar en sandbox" y la API `crear-asamblea-demo`.
- **18:** Archivado: necesario para pestañas Activas/Archivadas en asambleas y para archivar preguntas (no incluidas en el acta).
- **19:** SMTP: necesario si quieres que el Super Admin configure el correo (enlace de votación) desde Ajustes en lugar de variables de entorno.
- **20:** Requiere `AGREGAR-CONFIG-PODERES.sql` (tabla configuracion_poderes). Permite configurar plantilla adicional para correos en Dashboard → Configuración → Poderes y correo.
- **21:** Necesario si se usa el envío masivo por WhatsApp (API Meta). Crea `configuracion_whatsapp` y permite registrar tipo `WhatsApp` en `billing_logs`. Se configura en Super Admin → WhatsApp.
- **TRIGGER-PROFILE-ON-SIGNUP.sql** (opcional pero recomendado): crea perfil en `profiles` al registrarse un nuevo usuario (email/password, Magic Link u OAuth) para que la billetera y la demo funcionen desde el primer acceso.