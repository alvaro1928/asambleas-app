# Documentación – Asambleas App

Índice de la documentación del proyecto. Todo está organizado en subcarpetas por tema.

**Orden recomendado de lectura:** [Resumen de la aplicación](#resumen-de-la-aplicación) → Guías de uso → Configuración → Despliegue → Referencia / Supabase → Pruebas → UX y mejoras.

---

## Resumen de la aplicación

- **[Resumen funcional y técnico](RESUMEN-APLICACION.md)** – Todo lo que tiene la app: funcionalidades por rol (admin, votantes, super-admin), stack, rutas, APIs, librerías, componentes, BD y UX.

---

## Guías de uso

- [Sistema de votación pública](guias/GUIA-SISTEMA-VOTACION-PUBLICA.md)
- [Módulo de votaciones](guias/GUIA-MODULO-VOTACIONES.md)
- [Códigos de acceso para votación](guias/GUIA-CODIGOS-ACCESO-VOTACION.md)
- [Importación de unidades](guias/GUIA-IMPORTACION-UNIDADES.md)
- [Módulo de poderes](guias/GUIA-MODULO-PODERES.md)
- [Estadísticas, quórum y poderes](guias/GUIA-ESTADISTICAS-QUORUM-PODERES.md)
- [Funcionalidades y capacidad](guias/FUNCIONALIDADES-Y-CAPACIDAD.md)

---

## Configuración

- [Variables de entorno (Vercel)](configuracion/VARIABLES-ENTORNO-VERCEL.md) – Variables para Vercel y desarrollo (Supabase, auth, Wompi, super-admin).
- [Configurar Wompi](configuracion/CONFIGURAR-WOMPI.md) – Pasarela de pagos y webhook para Plan Pro.

---

## Despliegue

- [Guía de despliegue (Vercel)](despliegue/DEPLOYMENT-GUIDE.md) – Pasos para desplegar en Vercel y configurar Supabase.
- [Checklist listo para deploy](despliegue/LISTO-PARA-DEPLOY.md) – Verificación antes de producción.
- [Cambios para producción](despliegue/CAMBIOS-PRODUCCION.md) – Resumen de cambios aplicados para producción.

---

## Supabase (BD, RLS, scripts)

- [Resumen de scripts a ejecutar](supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md) – Orden y descripción de scripts SQL.
- [RLS – Row Level Security](supabase/README-RLS.md)
- [Instrucciones para corregir RLS](supabase/INSTRUCCIONES-CORREGIR-RLS.md)
- [Limpiar datos (dev)](supabase/README-LIMPIAR-DATOS.md)
- [Plantillas de email (Supabase Auth)](supabase/PLANTILLAS-EMAIL-SUPABASE.md)
- [Plantillas de email (recovery)](supabase/PLANTILLAS-EMAIL-RECOVERY.md)
- [Auditoría y blockchain](supabase/AUDITORIA-Y-BLOCKCHAIN.md)

---

## Referencia técnica

- [Auth – resumen completo](referencia/AUTH-RESUMEN-COMPLETO.md)
- [Resumen: códigos de acceso](referencia/RESUMEN-CODIGOS-ACCESO.md)
- [Implementación código de acceso](referencia/RESUMEN-IMPLEMENTACION-CODIGO-ACCESO.md)
- [Seguridad votación OTP](referencia/SEGURIDAD-VOTACION-OTP.md)
- [Super Admin](referencia/SUPER-ADMIN.md)
- [Cumplimiento regulación](referencia/CUMPLIMIENTO-REGULACION.md)
- [Instrucciones ejecutar SQL](referencia/INSTRUCCIONES-EJECUTAR-SQL.md)

---

## Pruebas y rendimiento

- [K6 – pruebas de carga](pruebas/K6-README.md)
- [Stress test votos](pruebas/STRESS-TEST-VOTOS.md)
- [Reporte slow queries](pruebas/REPORTE-SLOW-QUERIES.md)

---

## UX, diseño y mejoras

- [Mejoras de experiencia (journey) por rol](ux/MEJORAS-UX-JOURNEY.md) – Propuestas para admin, votantes y super usuario.
- [Pruebas, optimización e ideas de mejora](ux/PRUEBAS-OPTIMIZACION-Y-MEJORAS.md) – Estado de pruebas, optimizaciones aplicadas e ideas concretas.
- [Colores: psicología y marketing](ux/COLORES-PSICOLOGIA-Y-MARKETING.md) – Paleta basada en psicología del color y regla 60-30-10.
