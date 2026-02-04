# 📊 Guía de Importación Masiva de Coeficientes

## 🎯 Objetivo

Esta funcionalidad permite a los administradores cargar la base de datos completa de su copropiedad (unidades, coeficientes, propietarios) en **segundos**, cumpliendo con la **Ley 675 de 2001**.

---

## 🚀 Paso a Paso

### 1. Preparar tu Archivo

Puedes usar **Excel (.xlsx, .xls)** o **CSV (.csv)**

#### Columnas Requeridas

| Columna | Requerida | Descripción | Ejemplo |
|---------|-----------|-------------|---------|
| `torre` | No | Torre o bloque | A, B, Torre 1 |
| `numero` | **SÍ** | Número de unidad | 101, 202, Casa 5 |
| `coeficiente` | **SÍ** | Coeficiente de copropiedad | 0.5234, 1.234567 |
| `tipo` | No | Tipo de inmueble | apartamento, casa, local |
| `propietario` | No | Nombre del propietario | Juan Pérez |
| `email` | No | Email del propietario | juan@email.com |
| `telefono` | No | Teléfono del propietario | 3001234567 |

#### Ejemplo de Archivo Excel

```
torre | numero | coeficiente | tipo       | propietario  | email           | telefono
------|--------|-------------|------------|--------------|-----------------|----------
A     | 101    | 0.5234      | apartamento| Juan Pérez   | juan@email.com  | 3001234567
A     | 102    | 0.4766      | apartamento| María López  | maria@email.com | 3007654321
B     | 201    | 0.8123      | casa       | Pedro Gómez  | pedro@email.com | 3009876543
```

---

### 2. Validaciones Automáticas

El sistema valida automáticamente:

#### ✅ Números Únicos
- No puede haber dos unidades con el mismo número
- Error mostrado en tiempo real

#### ✅ Coeficientes Numéricos
- Deben ser números válidos mayores a 0
- Soporta comas y puntos decimales (0,5234 o 0.5234)

#### ✅ Ley 675 de 2001
- **CRÍTICO**: La suma de todos los coeficientes debe estar **entre 99,9% y 100,1%** (se acepta un pequeño margen por redondeo en Excel/decimales, sin contravenir la regulación).
- El sistema calcula la suma y muestra:
  - ✓ Verde si está en el rango aceptado
  - ⚠️ Amarillo/Rojo si queda fuera del rango
  - Diferencia exacta para que puedas ajustar

---

### 3. Proceso de Importación

1. **Accede al Dashboard**
   - Haz clic en "Importar Unidades"

2. **Carga tu Archivo**
   - Arrastra y suelta tu archivo Excel o CSV
   - O haz clic para seleccionar

3. **Revisa la Vista Previa**
   - El sistema muestra:
     - Total de unidades
     - Suma de coeficientes
     - Estado de validación Ley 675
     - Tabla con las primeras 10 unidades

4. **Confirma e Importa**
   - Si la suma está en el rango aceptado (99,9%–100,1%), haz clic en "Confirmar e Importar"
   - Si queda fuera del rango, ajusta tu archivo y vuelve a cargar

---

## 🎨 Características de la UI

### Componentes Profesionales (ShadcnUI)

- ✅ **Alertas Contextuales**: Info, éxito, warning, error
- ✅ **Tablas Responsivas**: Scroll horizontal en móviles
- ✅ **Botones con Estados**: Loading, disabled
- ✅ **Iconos Modernos**: Lucide React
- ✅ **Dark Mode**: Soporte completo

### Feedback Visual

#### Suma correcta (dentro del rango 99,9%–100,1%)
```
┌─────────────────────────┐
│ ✓ Suma Coeficientes     │
│   99.99% – 100.01% ✓    │
│ ✓ Aprobado (Ley 675)    │
└─────────────────────────┘
```

#### Suma Incorrecta
```
┌─────────────────────────┐
│ ⚠ Suma Coeficientes     │
│   99.456789%            │
│ ⚠ Revisar               │
│ Diferencia: -0.543211%  │
└─────────────────────────┘
```

---

## 🔧 Casos de Uso Especiales

### Multi-Conjunto

Si administras **múltiples conjuntos**:

1. El sistema importa unidades al **conjunto seleccionado actualmente**
2. Puedes cambiar de conjunto en la Configuración
3. Cada conjunto tiene su propia base de datos independiente

### Importaciones Incrementales

- ✅ Puedes importar en varias veces
- ✅ El sistema verifica duplicados en la BD antes de insertar
- ❌ No se permiten números de unidad duplicados

---

## 📋 Descargar Plantilla

Haz clic en **"Descargar Plantilla"** en la página de importación para obtener un archivo Excel pre-configurado con:

- Todas las columnas necesarias
- Ejemplos de datos
- Formato correcto

---

## ⚠️ Errores Comunes

### Error: "Suma de coeficientes fuera del rango"

**Causa**: La suma no está entre 99,9% y 100,1% (rango aceptado por Ley 675 con tolerancia por redondeo).

**Solución**:
1. Revisa la diferencia mostrada
2. Ajusta los coeficientes en tu archivo
3. Asegúrate de usar 6 decimales o redondea de forma que la suma quede en el rango
4. Vuelve a importar

### Error: "Número de unidad duplicado"

**Causa**: Hay dos filas con el mismo número de unidad

**Solución**:
1. Revisa el mensaje de error (indica la fila)
2. Corrige el número duplicado
3. Vuelve a importar

### Error: "Coeficiente inválido"

**Causa**: El valor del coeficiente no es numérico

**Solución**:
1. Verifica que sean números (no texto)
2. Usa punto o coma para decimales
3. No uses símbolos (%, $, etc.)

---

## 🎓 Mejores Prácticas

### Preparación de Datos

1. **Exporta desde tu sistema actual** (Excel, contabilidad, etc.)
2. **Verifica la suma** antes de importar
3. **Usa un decimal estándar** (punto o coma consistente)
4. **Nombra las columnas exactamente** como en la plantilla

### Validación

1. **Revisa la vista previa** antes de confirmar
2. **Verifica los primeros registros** en la tabla
3. **Confirma el total de unidades** esperado

### Multi-Tenant

1. **Un conjunto = Un archivo**
2. **Importa por partes** si tienes muchos datos
3. **Verifica el conjunto activo** antes de importar

---

## 🛠️ Soporte Técnico

### Formatos Soportados

- ✅ Excel 2007+ (.xlsx)
- ✅ Excel 97-2003 (.xls)
- ✅ CSV UTF-8 (.csv)

### Límites

- **Máximo de unidades**: Sin límite técnico
- **Tamaño de archivo**: Depende del navegador (~10MB recomendado)
- **Tiempo de procesamiento**: ~1-2 segundos por cada 100 unidades

### Compatibilidad

- ✅ Chrome, Edge, Firefox (últimas versiones)
- ✅ Desktop y tablet
- ⚠️ Móvil (funciona, pero mejor usar desktop para archivos grandes)

---

## 📱 Capturas de Pantalla

### 1. Página de Carga
```
┌─────────────────────────────────────┐
│ 📤 Importación Masiva de Coeficientes│
├─────────────────────────────────────┤
│                                       │
│    [Arrastra tu archivo aquí]       │
│    o haz clic para seleccionar      │
│                                       │
│  Formatos: Excel (.xlsx) o CSV      │
│                                       │
├─────────────────────────────────────┤
│ ℹ️  Descarga la plantilla si es tu   │
│    primera vez importando           │
└─────────────────────────────────────┘
```

### 2. Vista Previa
```
┌─────────────────────────────────────┐
│ 📊 Resumen de Importación           │
├─────────────────────────────────────┤
│ Total: 245 unidades                 │
│ Suma: en rango Ley 675 ✓           │
│ Estado: Aprobado (Ley 675)         │
├─────────────────────────────────────┤
│ Torre | Número | Coeficiente | ...  │
│-------|--------|-------------|------|
│   A   |  101   |  0.523400%  | ...  │
│   A   |  102   |  0.476600%  | ...  │
│   B   |  201   |  0.812300%  | ...  │
├─────────────────────────────────────┤
│ [Cancelar]  [Confirmar e Importar] │
└─────────────────────────────────────┘
```

---

## 🎉 Resultado Final

Una vez importadas, las unidades están listas para:

- ✅ **Control de Quórum**: El sistema calcula automáticamente
- ✅ **Votaciones**: Cada voto tiene peso según coeficiente
- ✅ **Reportes**: Estadísticas por torre, tipo, etc.
- ✅ **Gestión**: Ver, editar, exportar

---

## 📞 Contacto

Si tienes problemas con la importación:

1. Verifica que tu archivo cumple con el formato
2. Descarga y usa la plantilla oficial
3. Revisa los mensajes de error detallados
4. Contacta soporte con captura de pantalla del error

---

**¡Tu base de datos de copropiedad lista en segundos!** 🚀
