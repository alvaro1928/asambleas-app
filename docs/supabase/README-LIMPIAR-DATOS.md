# 🗑️ Scripts para Limpiar Datos

Este directorio contiene scripts SQL para limpiar datos de prueba de la aplicación.

---

## 📋 Archivos Disponibles

### 1. `LIMPIAR-TODO.sql`
**⚠️ PELIGRO: Borra TODOS los datos de TODOS los usuarios**

**Usa cuando:**
- Estás en desarrollo/testing
- Quieres resetear completamente la aplicación
- Estás seguro de que quieres borrar TODO

**Borra:**
- ✅ Todos los usuarios (profiles)
- ✅ Todos los conjuntos (organizations)
- ✅ Todas las unidades
- ✅ Todas las asambleas
- ✅ Todas las preguntas y opciones
- ✅ Todos los votos
- ✅ Todos los poderes

---

### 2. `LIMPIAR-MI-USUARIO.sql`
**✅ SEGURO: Solo borra datos de UN usuario específico**

**Usa cuando:**
- Quieres limpiar tus datos de prueba
- Otros usuarios están usando el sistema
- Quieres mantener los datos de otros

**Borra solo:**
- ✅ Tus conjuntos
- ✅ Tus unidades
- ✅ Tus asambleas
- ✅ Tus preguntas
- ✅ Tus votos
- ✅ NO borra tu cuenta de usuario

---

## 🚀 Cómo Usar

### Opción 1: En Supabase Dashboard (Recomendado)

1. Ve a: https://supabase.com/dashboard/project/zbfwuabsgnrpizckeump/sql/new
2. Copia el contenido del script que quieras usar
3. Pega en el editor SQL
4. **Si usas `LIMPIAR-MI-USUARIO.sql`:**
   - Busca las líneas con `👈 CAMBIA ESTO`
   - Cambia `'alvarocontreras35@gmail.com'` por tu email
5. Click en **"Run"**
6. Revisa los resultados de la verificación

---

### Opción 2: Desde Terminal (Avanzado)

```bash
# Asegúrate de tener psql instalado y configurado
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f supabase/LIMPIAR-TODO.sql
```

---

## 📊 Verificación

Ambos scripts incluyen una consulta de verificación al final que muestra:

```
tabla                    | registros
-------------------------|----------
profiles                 | 0
organizations            | 0
unidades                 | 0
asambleas                | 0
preguntas                | 0
...
```

**Si todos muestran 0 (o los números esperados), la limpieza fue exitosa ✅**

---

## ⚠️ IMPORTANTE

### Antes de Ejecutar:

1. ✅ **Haz backup** si tienes datos importantes
2. ✅ **Verifica** que estás en el ambiente correcto (dev/staging/prod)
3. ✅ **Lee** el script completo antes de ejecutar
4. ✅ **Cambia el email** en `LIMPIAR-MI-USUARIO.sql`

### Datos que NO se borran:

- ❌ Estructura de las tablas (solo borra datos)
- ❌ RLS policies
- ❌ Functions y triggers
- ❌ Usuarios de Supabase Auth (solo se borran de la tabla `profiles`)

### Para borrar también usuarios de Auth:

1. Ve a: https://supabase.com/dashboard/project/zbfwuabsgnrpizckeump/auth/users
2. Selecciona los usuarios manualmente
3. Click en "Delete"

---

## 🆘 En Caso de Error

Si algo sale mal:

1. **No entres en pánico** - Los scripts usan transacciones (`BEGIN`/`COMMIT`)
2. **Revisa el error** - Supabase te dirá qué falló
3. **Verifica las foreign keys** - Puede haber nuevas tablas que no incluí
4. **Contacta al equipo** si necesitas ayuda

---

## 🔄 Después de Limpiar

Para volver a usar la aplicación:

1. Ve a: https://asambleas-app-epbco.vercel.app/login
2. Ingresa con Magic Link
3. Se creará un nuevo perfil automáticamente
4. Registra tu primer conjunto de nuevo
5. Importa tus unidades

---

## 📝 Notas

- Los scripts son **idempotentes** - puedes ejecutarlos múltiples veces sin problema
- Usan transacciones para garantizar integridad
- Respetan el orden de foreign keys
- Incluyen verificación automática

---

**¿Dudas? Revisa la documentación de Supabase o contacta al equipo de desarrollo.**
