# 📋 Instrucciones: Ejecutar SQL en Supabase

## 🎯 Problema Actual:

La URL de votación muestra "Acceso Denegado" porque **las funciones SQL no existen** en tu base de datos.

---

## ✅ Solución: Ejecutar los Scripts SQL

### **Paso 1: Ir a Supabase Dashboard**

1. Abre tu navegador
2. Ve a: https://supabase.com/dashboard
3. Inicia sesión
4. Selecciona tu proyecto

---

### **Paso 2: Abrir el SQL Editor**

1. En el menú lateral izquierdo, busca **"SQL Editor"**
2. Haz clic en **"SQL Editor"**
3. Verás una interfaz para escribir SQL

---

### **Paso 3: Ejecutar Primer Script**

#### **Script 1: AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql**

1. En VS Code/Cursor, abre el archivo:
   ```
   supabase/AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql
   ```

2. Selecciona **TODO el contenido** del archivo (Ctrl+A)

3. Copia (Ctrl+C)

4. Vuelve a Supabase Dashboard → SQL Editor

5. En el editor de SQL, **pega todo el contenido** (Ctrl+V)

6. Haz clic en el botón **"Run"** (esquina inferior derecha)

7. **Espera** a que termine de ejecutar (puede tardar 5-10 segundos)

8. Si todo está bien, verás: ✅ **"Success. No rows returned"**

---

### **Paso 4: Verificar que Funcionó**

1. En el mismo SQL Editor de Supabase

2. **Borra** todo el contenido anterior

3. Copia y pega este script de verificación:

```sql
SELECT 
  'Columnas en asambleas' AS verificacion,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ OK'
    ELSE '❌ FALTAN'
  END AS estado
FROM information_schema.columns
WHERE table_name = 'asambleas'
  AND column_name IN ('codigo_acceso', 'url_publica', 'acceso_publico')

UNION ALL

SELECT 
  'Función: validar_codigo_acceso' AS verificacion,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ OK'
    ELSE '❌ FALTA'
  END AS estado
FROM information_schema.routines
WHERE routine_name = 'validar_codigo_acceso'

UNION ALL

SELECT 
  'Función: validar_votante_asamblea' AS verificacion,
  COUNT(*) AS total,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ OK'
    ELSE '❌ FALTA'
  END AS estado
FROM information_schema.routines
WHERE routine_name = 'validar_votante_asamblea';
```

4. Haz clic en **"Run"**

5. **Resultado Esperado:**

```
| verificacion                      | total | estado  |
|-----------------------------------|-------|---------|
| Columnas en asambleas             |   3   | ✅ OK   |
| Función: validar_codigo_acceso    |   1   | ✅ OK   |
| Función: validar_votante_asamblea |   1   | ✅ OK   |
```

Si ves **✅ OK** en todos, ¡perfecto! Si ves **❌**, algo falló.

---

### **Paso 5: Probar la URL**

1. Ve a tu aplicación: `http://localhost:3000`

2. Ve a Dashboard → Asambleas → (tu asamblea)

3. Copia la URL que dice:
   ```
   http://localhost:3000/votar/5759-4RXE
   ```

4. Abre esa URL en una nueva pestaña

5. **Ahora SÍ debería funcionar** y mostrarte la pantalla de "Ingresa tu email"

---

## 🔴 Errores Comunes:

### **Error 1: "Function does not exist"**
- **Solución**: No ejecutaste el SQL correctamente. Repite el Paso 3.

### **Error 2: "Column does not exist"**
- **Solución**: Asegúrate de copiar TODO el archivo SQL, no solo una parte.

### **Error 3: "Syntax error"**
- **Solución**: Puede ser que copiaste mal. Intenta abrir el archivo `.sql` directamente en Supabase:
  1. En Supabase → SQL Editor
  2. Botón **"New query"**
  3. Botón **"Upload SQL"**
  4. Selecciona el archivo `AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql`
  5. Click en **"Run"**

---

## 📦 Archivos que Debes Ejecutar:

### **Para que funcione el código de acceso:**
✅ **1. `AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql`** (OBLIGATORIO)

### **Para trazabilidad de votos (próximamente):**
⏳ **2. `AGREGAR-TRAZABILIDAD-VOTOS.sql`** (opcional por ahora)

### **Para OTP por email (próximamente):**
⏳ **3. `AGREGAR-SISTEMA-OTP.sql`** (opcional por ahora)

---

## ✅ Checklist:

- [ ] Entré a Supabase Dashboard
- [ ] Abrí SQL Editor
- [ ] Copié TODO el contenido de `AGREGAR-CODIGO-ACCESO-ASAMBLEAS.sql`
- [ ] Pegué en el SQL Editor
- [ ] Hice clic en "Run"
- [ ] Vi "Success"
- [ ] Ejecuté el script de verificación
- [ ] Vi ✅ OK en todo
- [ ] Probé la URL y funcionó

---

## 🆘 Si Aún No Funciona:

1. **Ejecuta el script de verificación** (Paso 4)
2. **Copia el resultado** que te muestra
3. **Compártelo conmigo** para ver qué falta

---

**¿Necesitas ayuda con algún paso específico?** 🚀
