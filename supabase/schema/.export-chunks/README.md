# Chunks para ensamblar `public-schema.sql`

Estos archivos **no** se ejecutan directamente en Supabase. Son piezas intermedias para regenerar el backup canónico.

## Regenerar

```powershell
# Desde API (token requerido para refrescar captures):
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
node scripts/export-schema-full.mjs --fetch

# Solo recompone desde lo ya guardado en git:
node scripts/export-schema-full.mjs
```

Salida: `supabase/schema/restore/public-schema.sql` + `MANIFEST.json`

## Carpetas

| Carpeta | Contenido |
|---------|-----------|
| `snapshot/plain/` | Secciones SQL listas para compose |
| `snapshot/bootstrap/captures/` | JSON `[{"ddl":"..."}]` desde la BD |
| `snapshot/bootstrap/ddl-source/` | Fuente editable por sección |
| `snapshot/raw/` | Respuestas MCP crudas (referencia) |
