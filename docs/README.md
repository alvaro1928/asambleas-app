# Documentación – Asambleas App

Índice de toda la documentación del proyecto, ordenada por tema.

**Orden recomendado:** [1. Resumen](#1-resumen) → [2. Guías de uso](#2-guías-de-uso) → [3. Configuración](#3-configuración) → [4. Despliegue](#4-despliegue) → [5. Supabase (BD y scripts)](#5-supabase-bd-y-scripts) → [6. Referencia técnica](#6-referencia-técnica) → [7. Pruebas](#7-pruebas) → [8. UX y diseño](#8-ux-y-diseño).

---

## 1. Resumen

| Documento | Descripción |
|-----------|-------------|
| **[RESUMEN-APLICACION.md](RESUMEN-APLICACION.md)** | Resumen funcional (por rol: admin, votantes, super-admin) y técnico (stack, rutas, APIs, BD). Incluye **billetera de tokens por gestor** (1 token = 1 unidad; cobro solo al activar asamblea) y **asamblea de pruebas (sandbox)** para explorar sin consumir tokens. Punto de entrada para entender la app. |

---

## 2. Guías de uso

| Documento | Descripción |
|-----------|-------------|
| [guias/GUIA-SISTEMA-VOTACION-PUBLICA.md](guias/GUIA-SISTEMA-VOTACION-PUBLICA.md) | Sistema de votación pública: flujo, códigos, validación. |
| [guias/GUIA-MODULO-VOTACIONES.md](guias/GUIA-MODULO-VOTACIONES.md) | Módulo de votaciones en el dashboard. |
| [guias/GUIA-CODIGOS-ACCESO-VOTACION.md](guias/GUIA-CODIGOS-ACCESO-VOTACION.md) | Códigos de acceso para votación. |
| [guias/GUIA-IMPORTACION-UNIDADES.md](guias/GUIA-IMPORTACION-UNIDADES.md) | Importación masiva de unidades (Excel/CSV). |
| [guias/GUIA-MODULO-PODERES.md](guias/GUIA-MODULO-PODERES.md) | Módulo de poderes (apoderados por unidad). |
| [guias/GUIA-ESTADISTICAS-QUORUM-PODERES.md](guias/GUIA-ESTADISTICAS-QUORUM-PODERES.md) | Estadísticas, quórum y poderes. |
| [guias/FUNCIONALIDADES-Y-CAPACIDAD.md](guias/FUNCIONALIDADES-Y-CAPACIDAD.md) | Listado de funcionalidades y validación de capacidad (500+ usuarios). |
| [guias/GUIA-TOKENS-Y-FUNCIONALIDADES.md](guias/GUIA-TOKENS-Y-FUNCIONALIDADES.md) | Tokens por gestor, cobro al activar asamblea, asamblea de pruebas (sandbox) y compra. |

---

## 3. Configuración

| Documento | Descripción |
|-----------|-------------|
| **[configuracion/VARIABLES-ENTORNO-VERCEL.md](configuracion/VARIABLES-ENTORNO-VERCEL.md)** | **Lista oficial** de variables de entorno para Vercel y desarrollo: Supabase, Auth, Super Admin, Wompi. Landing, precio y WhatsApp se configuran en Super Admin → Ajustes. |
| **[integracion-Wompi.md](integracion-Wompi.md)** | **Wompi (pasarela de pagos):** Opción 1 (la pasarela se encarga), URL de Eventos, variables `WOMPI_EVENTS_SECRET` y `WOMPI_PRIVATE_KEY`, referencia y flujo. |
| [configuracion/CONFIGURAR-WOMPI.md](configuracion/CONFIGURAR-WOMPI.md) | Redirección a la guía principal de Wompi (integracion-Wompi.md). |

---

## 4. Despliegue

| Documento | Descripción |
|-----------|-------------|
| [despliegue/DEPLOYMENT-GUIDE.md](despliegue/DEPLOYMENT-GUIDE.md) | Guía de despliegue en Vercel: variables, Supabase (URLs, Magic Link), verificación. |
| [despliegue/LISTO-PARA-DEPLOY.md](despliegue/LISTO-PARA-DEPLOY.md) | Checklist antes de producción (build, variables, auth, .gitignore). |
| [despliegue/CAMBIOS-PRODUCCION.md](despliegue/CAMBIOS-PRODUCCION.md) | Resumen de cambios aplicados para producción. |

---

## 5. Supabase (BD y scripts)

| Documento | Descripción |
|-----------|-------------|
| **[supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md](supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md)** | Orden y descripción de los scripts SQL a ejecutar en Supabase. |
| [supabase/README-RLS.md](supabase/README-RLS.md) | Row Level Security (RLS). |
| [supabase/INSTRUCCIONES-CORREGIR-RLS.md](supabase/INSTRUCCIONES-CORREGIR-RLS.md) | Cómo corregir políticas RLS. |
| [supabase/README-LIMPIAR-DATOS.md](supabase/README-LIMPIAR-DATOS.md) | Limpiar datos en desarrollo. |
| [supabase/PLANTILLAS-EMAIL-SUPABASE.md](supabase/PLANTILLAS-EMAIL-SUPABASE.md) | Plantillas de email (Supabase Auth). |
| [supabase/PLANTILLAS-EMAIL-RECOVERY.md](supabase/PLANTILLAS-EMAIL-RECOVERY.md) | Plantillas de recuperación de contraseña. |
| [supabase/AUDITORIA-Y-BLOCKCHAIN.md](supabase/AUDITORIA-Y-BLOCKCHAIN.md) | Auditoría y trazabilidad de votos. |

---

## 6. Referencia técnica

| Documento | Descripción |
|-----------|-------------|
| [referencia/AUTH-RESUMEN-COMPLETO.md](referencia/AUTH-RESUMEN-COMPLETO.md) | Auth: login, Magic Link, Google OAuth, cierre de sesión, callbacks. |
| [referencia/SUPER-ADMIN.md](referencia/SUPER-ADMIN.md) | Super Admin: conjuntos, planes, tokens por cuenta, Ajustes (landing, color, WhatsApp), carga masiva piloto, APIs. |
| [referencia/RESUMEN-CODIGOS-ACCESO.md](referencia/RESUMEN-CODIGOS-ACCESO.md) | Resumen de códigos de acceso a votación. |
| [referencia/RESUMEN-IMPLEMENTACION-CODIGO-ACCESO.md](referencia/RESUMEN-IMPLEMENTACION-CODIGO-ACCESO.md) | Implementación del código de acceso. |
| [referencia/SEGURIDAD-VOTACION-OTP.md](referencia/SEGURIDAD-VOTACION-OTP.md) | Seguridad de la votación (OTP, trazabilidad). |
| [referencia/CUMPLIMIENTO-REGULACION.md](referencia/CUMPLIMIENTO-REGULACION.md) | Cumplimiento regulatorio (auditoría, IP, dispositivos). |
| [referencia/INSTRUCCIONES-EJECUTAR-SQL.md](referencia/INSTRUCCIONES-EJECUTAR-SQL.md) | Cómo ejecutar scripts SQL en Supabase. |

---

## 7. Pruebas

| Documento | Descripción |
|-----------|-------------|
| [pruebas/K6-README.md](pruebas/K6-README.md) | Pruebas de carga con K6. |
| [pruebas/STRESS-TEST-VOTOS.md](pruebas/STRESS-TEST-VOTOS.md) | Stress test de votaciones. |
| [pruebas/REPORTE-SLOW-QUERIES.md](pruebas/REPORTE-SLOW-QUERIES.md) | Reporte de consultas lentas y optimización. |

---

## 8. UX y diseño

| Documento | Descripción |
|-----------|-------------|
| [ux/MEJORAS-UX-JOURNEY.md](ux/MEJORAS-UX-JOURNEY.md) | Mejoras de experiencia por rol (admin, votantes, super usuario). |
| [ux/PRUEBAS-OPTIMIZACION-Y-MEJORAS.md](ux/PRUEBAS-OPTIMIZACION-Y-MEJORAS.md) | Pruebas, optimización e ideas de mejora. |
| [ux/COLORES-PSICOLOGIA-Y-MARKETING.md](ux/COLORES-PSICOLOGIA-Y-MARKETING.md) | Paleta de colores (psicología, regla 60-30-10). |
