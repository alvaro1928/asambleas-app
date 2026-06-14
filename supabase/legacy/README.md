# Scripts SQL históricos (legacy)

Los archivos `.sql` en la carpeta padre `supabase/` (ej. `SETUP-COMPLETO.sql`, `HARDENING-RLS-*.sql`, parches sueltos) son **historial de desarrollo**.

## No uses esto para restaurar la base de datos

- No reflejan un único estado verificado de producción
- Algunos se solapan, contradicen o fueron reemplazados
- Ejecutarlos en orden puede romper un proyecto nuevo

## Para restaurar estructura

Usa únicamente:

```
supabase/schema/restore/public-schema.sql
```

Ver `supabase/schema/README.md`.

## Para consultar cómo se implementó algo

Estos scripts siguen siendo útiles como **referencia de decisiones pasadas**, no como pipeline de despliegue.
