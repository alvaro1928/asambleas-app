# 📊 Guía Completa: Módulo de Votaciones

## 🎯 Características Implementadas

### ✅ 1. Configuración de Opciones de Respuesta

Cada pregunta ahora permite:
- **Opciones personalizadas** (mínimo 2, sin límite máximo)
- **Colores personalizados** para cada opción (visualización)
- **Textos personalizados** (Ej: "Sí/No", "Apruebo/Rechazo", etc.)
- **Opciones por defecto**: "A favor", "En contra", "Me abstengo"

### ✅ 2. Control de Estado de Preguntas

Cada pregunta tiene 3 estados:

#### 🔒 **Pendiente** (Estado inicial)
- La pregunta está creada pero no visible para votantes
- Administrador puede editarla o eliminarla
- **Acción disponible**: "Abrir Votación"

#### 🟢 **Abierta** (Votación activa)
- Los propietarios pueden votar en esta pregunta
- No se puede eliminar (protección de datos)
- **Acción disponible**: "Cerrar Votación"

#### 🔵 **Cerrada** (Votación finalizada)
- Los votos están contabilizados y ya no se aceptan más
- Se pueden ver resultados
- **Acción disponible**: "Reabrir" (por si es necesario)

### ✅ 3. Preparación para Votación Pública

La estructura está lista para:
- Interfaz pública de votación (próximo paso)
- Registro de votos en tiempo real
- Cálculo de quórum
- Validación de Ley 675

---

## 🗄️ Estructura de Base de Datos

### Tabla: `opciones_pregunta`

```sql
CREATE TABLE opciones_pregunta (
  id UUID PRIMARY KEY,
  pregunta_id UUID REFERENCES preguntas(id),
  texto_opcion TEXT NOT NULL,
  orden INTEGER DEFAULT 1,
  color TEXT DEFAULT '#6366f1',
  votos_count INTEGER DEFAULT 0,           -- Votos nominales
  votos_coeficiente NUMERIC(12, 6) DEFAULT 0, -- Suma de coeficientes
  created_at TIMESTAMP
);
```

**Campos clave**:
- `texto_opcion`: Texto de la opción (Ej: "A favor")
- `orden`: Orden de visualización
- `color`: Color en formato hex para UI
- `votos_count`: Contador de votos (nominal)
- `votos_coeficiente`: Suma de coeficientes (ponderado)

---

## 🎨 Flujo de Uso

### Paso 1: Crear Asamblea

```
Dashboard → Asambleas → Nueva Asamblea
  ├─ Nombre: "Asamblea Ordinaria 2026"
  ├─ Fecha: 15 de febrero, 2026
  └─ Estado inicial: Borrador
```

### Paso 2: Agregar Preguntas con Opciones

```
Asamblea → Agregar Pregunta
  ├─ Pregunta: "¿Aprueban el presupuesto 2026?"
  ├─ Tipo: Coeficiente (Ley 675)
  └─ Opciones:
      ├─ ✅ A favor (verde)
      ├─ ❌ En contra (rojo)
      └─ ⚪ Me abstengo (gris)
```

**Ejemplo con opciones personalizadas**:
```
Pregunta: "¿Prefieren reunirse presencial o virtual?"
Opciones:
  ├─ 🏢 Presencial (azul)
  ├─ 💻 Virtual (morado)
  └─ 🤝 Híbrido (naranja)
```

### Paso 3: Activar Asamblea

```
Asamblea [Borrador] → Botón "Activar" → Asamblea [Activa]
```

### Paso 4: Abrir Votación por Pregunta

```
Pregunta [Pendiente] → Botón "Abrir Votación" → Pregunta [Abierta]
```

🟢 **Votación abierta**: Los propietarios ya pueden votar

### Paso 5: Cerrar Votación

```
Pregunta [Abierta] → Botón "Cerrar Votación" → Pregunta [Cerrada]
```

🔵 **Votación cerrada**: Se contabilizan resultados

---

## 🔐 Lógica de Negocio (Ley 675)

### Tipos de Votación

#### 1. **Por Coeficiente** (Ponderado)
```typescript
// Cada voto se multiplica por el coeficiente
Unidad 101: Coeficiente 1.5% → Vota "A favor"
  → Suma 1.5% a "A favor"

Unidad 202: Coeficiente 0.8% → Vota "En contra"
  → Suma 0.8% a "En contra"
```

**Resultado**:
- ✅ A favor: 52.3%
- ❌ En contra: 30.2%
- ⚪ Abstención: 17.5%
- **Total: 100%** ✓ (Ley 675)

#### 2. **Nominal** (Un voto por unidad)
```typescript
// Cada unidad cuenta 1 voto
Unidad 101: Vota "A favor" → +1 voto
Unidad 202: Vota "En contra" → +1 voto
```

**Resultado**:
- ✅ A favor: 15 votos
- ❌ En contra: 8 votos
- ⚪ Abstención: 2 votos
- **Total: 25 votos**

---

## 📊 Visualización en la Interfaz

### Vista de Pregunta

```
┌─────────────────────────────────────────────────┐
│ #1  [Coeficiente]  [🟢 Abierta]           [🗑️] │
├─────────────────────────────────────────────────┤
│ ¿Aprueban el presupuesto para 2026?            │
│ Incluye mantenimiento y mejoras                 │
│                                                 │
│ Opciones de respuesta:                          │
│   🟢 A favor                                    │
│   🔴 En contra                                  │
│   ⚪ Me abstengo                                │
│                                                 │
│ ────────────────────────────────────────────── │
│ [❌ Cerrar Votación]                            │
└─────────────────────────────────────────────────┘
```

### Estados Visuales

| Estado | Badge | Color | Icono |
|--------|-------|-------|-------|
| Pendiente | `Pendiente` | Gris | 🕐 |
| Abierta | `Abierta` | Verde | ▶️ |
| Cerrada | `Cerrada` | Azul | ✅ |

---

## 🚀 Próximos Pasos (Interfaz Pública)

### 1. Página de Votación Pública

```
/asamblea/[codigo]
  ├─ Validación de propietario (por email o código)
  ├─ Lista de preguntas abiertas
  ├─ Botones de opciones
  └─ Confirmación de voto
```

### 2. Registro de Quórum

```
Panel de Control:
  ├─ Unidades presentes: 18/25 (72%)
  ├─ Coeficiente presente: 68.5%
  └─ Quórum alcanzado: ✅ Sí
```

### 3. Resultados en Tiempo Real

```
Pregunta: ¿Aprueban el presupuesto?
  ├─ A favor: 45.2% (12 votos)
  ├─ En contra: 28.3% (7 votos)
  └─ Abstención: 10.5% (3 votos)
  
Votantes: 22/25 (88%)
Pendientes: 3 unidades
```

---

## 🎯 Casos de Uso

### Ejemplo 1: Aprobación Simple

```yaml
Pregunta: "¿Aprueban la contratación del nuevo vigilante?"
Tipo: Nominal
Opciones:
  - Sí
  - No
Resultado: Mayoría simple (más del 50%)
```

### Ejemplo 2: Reforma Estatutos (Ley 675)

```yaml
Pregunta: "¿Aprueban la reforma de estatutos?"
Tipo: Coeficiente
Opciones:
  - Apruebo
  - No apruebo
Resultado: Requiere 70% del coeficiente (Art. 18, Ley 675)
```

### Ejemplo 3: Selección Múltiple

```yaml
Pregunta: "¿Qué mejora priorizarías?"
Tipo: Nominal
Opciones:
  - Pintura de fachada
  - Arreglo de piscina
  - Renovación de ascensores
  - Zonas verdes
Resultado: Opción con más votos
```

---

## ✅ Validaciones Implementadas

### Al Crear Pregunta:
- ✅ Texto obligatorio
- ✅ Mínimo 2 opciones
- ✅ Opciones no vacías
- ✅ Tipo de votación válido

### Al Abrir Votación:
- ✅ Asamblea debe estar activa
- ✅ Pregunta debe tener opciones configuradas
- ✅ Solo una pregunta abierta a la vez (opcional)

### Al Cerrar Votación:
- ✅ Guardar resultados finales
- ✅ Bloquear nuevos votos
- ✅ Permitir reabrir si es necesario

---

## 🎨 Personalización de Opciones

### Colores Recomendados

```javascript
// Aprobación/Rechazo
A favor:     #10b981 (verde)
En contra:   #ef4444 (rojo)
Abstención:  #6b7280 (gris)

// Selección múltiple
Opción 1:    #6366f1 (índigo)
Opción 2:    #8b5cf6 (púrpura)
Opción 3:    #ec4899 (rosa)
Opción 4:    #f59e0b (ámbar)
```

### Textos Personalizados

```javascript
// Formal
"Apruebo" / "No apruebo"

// Informal
"Sí" / "No"

// Específico
"Presencial" / "Virtual" / "Híbrido"

// Escala
"Muy de acuerdo" / "De acuerdo" / "Neutral" / "En desacuerdo"
```

---

## 🔒 Seguridad y Multi-tenancy

✅ **Filtrado automático** por `organization_id`
✅ **Validación de permisos** (solo admin puede crear/modificar)
✅ **Protección de datos** (no eliminar preguntas abiertas)
✅ **Aislamiento de votos** (cada conjunto ve solo sus asambleas)

---

## 📝 Resumen de Archivos

### SQL
- `CREAR-MODULO-ASAMBLEAS.sql` - Tablas principales
- `AGREGAR-OPCIONES-PREGUNTA.sql` - Tabla de opciones ⭐ **NUEVO**

### Páginas
- `/dashboard/asambleas` - Listado
- `/dashboard/asambleas/nueva` - Crear
- `/dashboard/asambleas/[id]` - Detalle + Preguntas ⭐ **ACTUALIZADO**

---

## 🎉 ¡Listo para Usar!

1. **Ejecuta el SQL**: `AGREGAR-OPCIONES-PREGUNTA.sql`
2. **Recarga la aplicación**
3. **Crea una asamblea**
4. **Agrega preguntas con opciones personalizadas**
5. **Abre votación** cuando estés listo

---

## 🚀 Próxima Iteración

- [ ] Interfaz pública de votación
- [ ] Registro de quórum en tiempo real
- [ ] Panel de resultados con gráficos
- [ ] Exportar acta de asamblea (PDF)
- [ ] Notificaciones por email
- [ ] Control de unidades presentes
