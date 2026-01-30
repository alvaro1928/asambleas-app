# Corrección del Error de Recursión Infinita en RLS

## Problema

Error: `infinite recursion detected in policy for relation "profiles"`

Este error ocurre porque las políticas RLS (Row Level Security) de la tabla `profiles` hacen referencia circular a sí mismas, causando recursión infinita.

## Solución Rápida

### Opción 1: Script Simplificado (RECOMENDADO)

Este script elimina todas las políticas problemáticas y crea nuevas políticas simples sin recursión.

1. Ve a tu proyecto en Supabase
2. Abre el **SQL Editor**
3. Crea un nuevo query
4. Copia y pega el contenido completo del archivo: `simple-rls-policies.sql`
5. Haz clic en **Run**

✅ Este script:
- Elimina todas las políticas existentes
- Crea políticas simples sin recursión
- Usa una función auxiliar `get_user_organization()` para evitar subconsultas circulares
- Permite crear conjuntos y perfiles sin problemas

### Opción 2: Deshabilitar RLS temporalmente (Solo para desarrollo)

Si solo quieres probar rápidamente:

```sql
-- SOLO PARA DESARROLLO - NO USAR EN PRODUCCIÓN
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
```

⚠️ **IMPORTANTE**: Esto deshabilita la seguridad. Solo para desarrollo local.

Para volver a habilitarlo:

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
```

## Explicación Técnica

### ¿Por qué ocurre el error?

Las políticas originales tenían código como este:

```sql
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles  -- ❌ Recursión aquí
      WHERE id = auth.uid()
    )
  );
```

Cuando intentas acceder a `profiles`, la política consulta la misma tabla `profiles`, que a su vez ejecuta la misma política, creando un bucle infinito.

### ¿Cómo lo solucionamos?

Creamos una **función auxiliar** que Supabase puede ejecutar sin aplicar RLS:

```sql
CREATE OR REPLACE FUNCTION get_user_organization()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

La clave es `SECURITY DEFINER`, que ejecuta la función con permisos elevados, evitando la recursión.

Luego usamos esta función en las políticas:

```sql
CREATE POLICY "Users can view org profiles"
  ON profiles FOR SELECT
  USING (
    organization_id IS NOT NULL 
    AND organization_id = get_user_organization()  -- ✅ Sin recursión
  );
```

## Verificar que funciona

Después de ejecutar el script, prueba crear un conjunto:

1. Ve a `/dashboard/nuevo-conjunto`
2. Completa el formulario
3. Haz clic en "Registrar Conjunto"
4. Deberías ver el mensaje de éxito y redirigir a `/dashboard`

## Archivos del Proyecto

- `simple-rls-policies.sql` - Script completo con políticas corregidas (RECOMENDADO)
- `fix-rls-policies.sql` - Script alternativo con enfoque diferente
- `schema.sql` - Schema completo original (tiene el problema)

## Próximos Pasos

Una vez corregido el error:

1. ✅ Podrás crear conjuntos sin problemas
2. ✅ Los usuarios solo verán sus propios datos
3. ✅ Los owners/admins tendrán permisos correctos
4. ✅ La seguridad multi-tenant funcionará correctamente
