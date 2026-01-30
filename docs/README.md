# Documentación – Asambleas App

Índice de la documentación del proyecto. Todo está organizado en subcarpetas por tema.

---

## Configuración

- [Variables de entorno (Vercel)](configuracion/VARIABLES-ENTORNO-VERCEL.md) – Variables para Vercel y desarrollo (Supabase, auth, Wompi, super-admin).
- [Configurar Wompi](configuracion/CONFIGURAR-WOMPI.md) – Pasarela de pagos y webhook para Plan Pro.

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
