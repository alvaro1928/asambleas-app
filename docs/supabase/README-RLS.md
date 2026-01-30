# Guía de Row Level Security (RLS)

## 🚨 Problema Actual: Recursión Infinita

El error `infinite recursion detected in policy for relation "profiles"` ocurre porque las políticas RLS hacen referencia circular entre `profiles` y `organizations`.

## ✅ Solución Inmediata (RECOMENDADA)

### Para Desarrollo: Deshabilitar RLS

**Ejecuta este script ahora:** `SOLUCION-DEFINITIVA-RLS.sql`

Este script:
1. ✅ Elimina TODAS las políticas problemáticas
2. ✅ Deshabilita RLS en todas las tablas
3. ✅ Te permite desarrollar sin problemas de seguridad recursiva
4. ✅ Es la práctica estándar durante desarrollo

```sql
-- Esto está en SOLUCION-DEFINITIVA-RLS.sql
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE unidades DISABLE ROW LEVEL SECURITY;
```

### Resultados:
- ✅ Podrás crear conjuntos sin errores
- ✅ Podrás crear perfiles sin problemas
- ✅ Tu app funcionará completamente
- ⚠️ Sin seguridad multi-tenant (OK para desarrollo)

---

## 🔒 Para Producción: Habilitar RLS

**Cuando estés listo para producción**, ejecuta: `HABILITAR-RLS-PRODUCCION.sql`

Este script:
1. Habilita RLS en todas las tablas
2. Crea políticas simples y seguras
3. Implementa seguridad multi-tenant correctamente
4. **NO causa recursión** (políticas simplificadas)

---

## 📋 Instrucciones Paso a Paso

### AHORA (Desarrollo)

1. Abre Supabase SQL Editor
2. Ejecuta: `SOLUCION-DEFINITIVA-RLS.sql`
3. Verifica que aparece: "RLS Habilitado = false"
4. Prueba crear un conjunto en tu app
5. ✅ Debería funcionar perfectamente

### DESPUÉS (Producción)

1. Cuando tu app esté lista para producción
2. Ejecuta: `HABILITAR-RLS-PRODUCCION.sql`
3. Verifica que aparece: "RLS Habilitado = true"
4. Prueba todas las funcionalidades
5. Los usuarios solo verán sus propios datos

---

## 🔍 ¿Por qué ocurría la recursión?

### Código Problemático (ANTES):
```sql
-- ❌ RECURSIÓN INFINITA
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles  -- ← Consulta a profiles
      WHERE id = auth.uid()                 --   desde política de profiles
    )
  );
```

### Explicación:
1. Usuario intenta acceder a `profiles`
2. RLS ejecuta la política
3. La política consulta `profiles` 
4. RLS ejecuta la política (de nuevo)
5. La política consulta `profiles` (de nuevo)
6. ♾️ Bucle infinito

### Solución:
Durante desarrollo: **Deshabilitar RLS**
En producción: **Políticas simples sin subconsultas circulares**

---

## 📁 Archivos del Proyecto

| Archivo | Cuándo Usar | Propósito |
|---------|-------------|-----------|
| `SOLUCION-DEFINITIVA-RLS.sql` | **AHORA** | Deshabilita RLS para desarrollo |
| `HABILITAR-RLS-PRODUCCION.sql` | Después | Habilita RLS para producción |
| `README-RLS.md` | Siempre | Esta guía |
| `schema.sql` | ⚠️ No usar | Tiene recursión (referencia) |
| `simple-rls-policies.sql` | ⚠️ No usar | Aún causa problemas |

---

## ✅ Checklist de Desarrollo

- [ ] Ejecutar `SOLUCION-DEFINITIVA-RLS.sql`
- [ ] Verificar que RLS está deshabilitado
- [ ] Probar crear conjunto
- [ ] Probar crear perfil
- [ ] Desarrollar todas las funcionalidades
- [ ] Cuando esté todo funcionando...
  - [ ] Ejecutar `HABILITAR-RLS-PRODUCCION.sql`
  - [ ] Probar que todo sigue funcionando
  - [ ] Verificar seguridad multi-tenant
  - [ ] Desplegar a producción

---

## 🆘 Soporte

Si sigues teniendo problemas después de ejecutar `SOLUCION-DEFINITIVA-RLS.sql`:

1. Verifica que ejecutaste el script completo
2. Verifica el estado de RLS:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename IN ('organizations', 'profiles', 'unidades');
   ```
3. Debería mostrar `rowsecurity = false` para todas

Si `rowsecurity = true`, ejecuta manualmente:
```sql
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE unidades DISABLE ROW LEVEL SECURITY;
```
