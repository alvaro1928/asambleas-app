# 📊 Guía: Estadísticas, Quórum y Sistema de Poderes

## 🎯 Características Implementadas

### ✅ 1. Estadísticas en Tiempo Real

Cada pregunta (abierta o cerrada) muestra:
- **Resultados en vivo** actualizados cada 5 segundos
- **Barras de progreso** con colores personalizados
- **Porcentajes** según tipo de votación:
  - **Coeficiente**: Porcentaje ponderado (Ley 675)
  - **Nominal**: Porcentaje de votos
- **Contador de votos** para cada opción
- **Indicador visual** "En vivo" para preguntas abiertas

### ✅ 2. Panel de Quórum en Línea

Panel superior que muestra:
- **Unidades votantes**: X/Y (porcentaje)
- **Coeficiente votante**: % del total (Ley 675)
- **Unidades pendientes**: Cuántas faltan
- **Estado del quórum**: ✅ Alcanzado / ⚠️ Pendiente
- **Actualización automática**: Cada 5 segundos

### ✅ 3. Sistema de Poderes (Preparado)

Estructura lista para:
- Registrar poderes entre propietarios
- Un residente puede votar por múltiples unidades
- Validación y seguimiento de poderes
- Estados: Activo, Revocado, Usado

### ✅ 4. Verificación de quórum (asistencia)

- **Activar/Desactivar verificación:** En Control de acceso (`/dashboard/asambleas/[id]/acceso`) y en Acceso Público de la asamblea. Al activar, en la página de votación aparece un popup para que cada votante confirme "Verifico asistencia".
- **Registrar asistencia manual:** El administrador puede marcar una o varias unidades como presentes (modal con lista y búsqueda). Se actualiza el porcentaje de asistencia verificada y el indicador de quórum (Ley 675 >50%).
- **Paneles según estado:** Con verificación activa, la página de acceso muestra dos paneles: **Ya verificaron asistencia** y **Faltan por verificar**. Al desactivar la verificación, vuelven los paneles habituales: Sesión Activa, Ya Votaron, Pendientes.
- **Reseteo:** Si el admin desactiva y vuelve a activar la verificación, todas las confirmaciones se borran; los votantes deben verificar de nuevo.
- **Acta:** La verificación de asistencia se refleja en el acta (global y por pregunta, según el momento de la votación). Scripts: `ADD-VERIFICACION-ASISTENCIA.sql`, `ADD-VERIFICACION-POR-PREGUNTA.sql`, `FIX-VERIFICACION-QUORUM-SANDBOX.sql`.

### ✅ 5. Acceso de asistente delegado

- **Enlace seguro:** El administrador puede generar un enlace (`/asistir/[codigo]?t=token`) para una persona de confianza. Ese enlace permite registrar asistencia y votos en nombre de unidades sin iniciar sesión.
- **Registro:** Todas las acciones quedan registradas como "registrado por asistente delegado". Se puede revocar el token en cualquier momento desde Control de acceso.
- **APIs:** `POST|DELETE /api/delegado/configurar`, `POST /api/delegado/validar`, `POST /api/delegado/registrar-asistencia`, `POST /api/delegado/registrar-voto`. Columna `asambleas.token_delegado` (script `ADD-TOKEN-DELEGADO.sql`).

---

## 🗄️ Estructura de Base de Datos

### Tabla: `votos`

```sql
CREATE TABLE votos (
  id UUID PRIMARY KEY,
  pregunta_id UUID,           -- ¿En qué pregunta votó?
  unidad_id UUID,             -- ¿Qué unidad votó?
  opcion_id UUID,             -- ¿Qué opción seleccionó?
  votante_email TEXT,         -- Email de quien votó
  votante_nombre TEXT,        -- Nombre de quien votó
  es_poder BOOLEAN,           -- ¿Votó con un poder?
  poder_id UUID,              -- Referencia al poder
  created_at TIMESTAMP,
  
  UNIQUE(pregunta_id, unidad_id) -- Una unidad solo vota 1 vez por pregunta
);
```

**Validación**: Una unidad no puede votar dos veces en la misma pregunta.

### Tabla: `poderes`

```sql
CREATE TABLE poderes (
  id UUID PRIMARY KEY,
  asamblea_id UUID,           -- Asamblea donde aplica el poder
  unidad_otorgante_id UUID,   -- Unidad que otorga el poder
  unidad_receptor_id UUID,    -- Unidad que recibe el poder
  email_otorgante TEXT,       -- Propietario que otorga
  email_receptor TEXT,        -- Propietario que recibe
  estado TEXT,                -- activo | revocado | usado
  archivo_poder TEXT,         -- Documento escaneado (opcional)
  created_at TIMESTAMP
);
```

**Estados**:
- **Activo**: Poder válido, aún no usado
- **Usado**: Ya se utilizó para votar
- **Revocado**: Cancelado antes de usarse

### Tabla: `quorum_asamblea`

```sql
CREATE TABLE quorum_asamblea (
  id UUID PRIMARY KEY,
  asamblea_id UUID,
  unidad_id UUID,
  email_propietario TEXT,
  presente_fisica BOOLEAN,    -- Asiste presencialmente
  presente_virtual BOOLEAN,   -- Asiste virtualmente
  hora_llegada TIMESTAMP,
  
  UNIQUE(asamblea_id, unidad_id)
);
```

**Propósito**: Registrar asistencia para calcular quórum inicial.

---

## 📊 Funciones SQL (RPC)

### 1. `calcular_estadisticas_pregunta(pregunta_id)`

**Retorna**:
```json
[
  {
    "opcion_id": "uuid",
    "texto_opcion": "A favor",
    "color": "#10b981",
    "votos_count": 12,
    "votos_coeficiente": 45.23,
    "porcentaje_nominal": 48.00,
    "porcentaje_coeficiente": 45.23
  },
  {
    "opcion_id": "uuid",
    "texto_opcion": "En contra",
    "color": "#ef4444",
    "votos_count": 8,
    "votos_coeficiente": 30.15,
    "porcentaje_nominal": 32.00,
    "porcentaje_coeficiente": 30.15
  }
]
```

**Uso en código**:
```typescript
const { data } = await supabase.rpc('calcular_estadisticas_pregunta', {
  p_pregunta_id: preguntaId
})
```

### 2. `calcular_quorum_asamblea(asamblea_id)`

**Retorna**:
```json
{
  "total_unidades": 25,
  "unidades_votantes": 18,
  "unidades_pendientes": 7,
  "coeficiente_total": 100.000000,
  "coeficiente_votante": 68.500000,
  "coeficiente_pendiente": 31.500000,
  "porcentaje_participacion_nominal": 72.00,
  "porcentaje_participacion_coeficiente": 68.50,
  "quorum_alcanzado": true
}
```

**Uso en código**:
```typescript
const { data } = await supabase.rpc('calcular_quorum_asamblea', {
  p_asamblea_id: asambleaId
})
```

### 3. `puede_votar(pregunta_id, unidad_id)`

**Retorna**: `boolean`

**Validaciones**:
- ✅ La pregunta debe estar abierta
- ✅ La unidad no debe haber votado ya
- ✅ Si es con poder, el poder debe estar activo

**Uso en código**:
```typescript
const { data: puedeVotar } = await supabase.rpc('puede_votar', {
  p_pregunta_id: preguntaId,
  p_unidad_id: unidadId
})
```

---

## 🎨 Interfaz de Usuario

### Panel de Quórum

```
┌──────────────────────────────────────────────────────────┐
│ 🧑‍🤝‍🧑 Quórum y Participación      [✅ Quórum Alcanzado] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│ │Unidades      │  │Coeficiente   │  │Pendientes de │  │
│ │Votantes      │  │Votante       │  │Votar         │  │
│ │              │  │              │  │              │  │
│ │   18/25      │  │   68.50%     │  │      7       │  │
│ │[████████  ]  │  │[███████   ]  │  │              │  │
│ │72% partic.   │  │68.50% total  │  │Coef: 31.50%  │  │
│ └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│ ⏱️ Datos actualizados en tiempo real cada 5 segundos    │
└──────────────────────────────────────────────────────────┘
```

### Estadísticas de Pregunta (Abierta)

```
┌──────────────────────────────────────────────────────┐
│ #1  [Coeficiente]  [🟢 Abierta]              [🗑️]  │
├──────────────────────────────────────────────────────┤
│ ¿Aprueban el presupuesto para 2026?                 │
│                                                      │
│ ┌────────────────────────────────────────────────┐ │
│ │ 📊 Resultados en tiempo real    [🟢 En vivo]  │ │
│ ├────────────────────────────────────────────────┤ │
│ │                                                │ │
│ │ 🟢 A favor              45.23%  (12 votos)    │ │
│ │ [████████████░░░░░░░░░░]                      │ │
│ │                                                │ │
│ │ 🔴 En contra            30.15%  (8 votos)     │ │
│ │ [████████░░░░░░░░░░░░]                        │ │
│ │                                                │ │
│ │ ⚪ Me abstengo          10.00%  (3 votos)     │ │
│ │ [███░░░░░░░░░░░░░░░░░]                        │ │
│ │                                                │ │
│ │ 📊 Votación ponderada por coeficiente (Ley 675)│ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ [❌ Cerrar Votación]                                │
└──────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Votación (Con Poderes)

### Caso 1: Votación Normal

```
Propietario (Apto 101)
  ↓
Accede a /votacion/[codigo]
  ↓
Verifica su email/código
  ↓
Ve las preguntas abiertas
  ↓
Selecciona una opción
  ↓
Confirma su voto
  ↓
Sistema registra en tabla "votos":
  - unidad_id: 101
  - votante_email: juan@email.com
  - es_poder: false
```

### Caso 2: Votación con Poder

```
Propietario (Apto 102) otorga poder a (Apto 101)
  ↓
Sistema registra en tabla "poderes":
  - unidad_otorgante: 102
  - unidad_receptor: 101
  - estado: activo
  ↓
Propietario (Apto 101) accede
  ↓
Sistema le muestra: "Tienes 2 unidades para votar"
  - Su propia unidad (101)
  - Unidad con poder (102)
  ↓
Vota por ambas unidades
  ↓
Sistema registra 2 votos:
  1. unidad_id: 101, es_poder: false
  2. unidad_id: 102, es_poder: true, poder_id: [uuid]
  ↓
Poder cambia a estado: "usado"
```

---

## 📐 Cálculos de Ley 675

### Quórum (Art. 39, Ley 675)

**Definición**: Número mínimo de coeficientes para que la asamblea sea válida.

**Cálculo**:
```javascript
Quórum = (Coeficiente Votante / Coeficiente Total) * 100

Si Quórum >= 50% → Asamblea válida ✅
Si Quórum < 50% → Asamblea inválida ❌
```

**Ejemplo**:
```
Total unidades: 25
Coeficiente total: 100%
Unidades votantes: 18
Coeficiente votante: 68.5%

Quórum: 68.5% ✅ (Alcanzado, > 50%)
```

### Mayorías (Art. 23-24, Ley 675)

#### 1. Mayoría Simple (50% + 1)
```
Pregunta: "¿Aprueban contratar vigilante?"
Tipo: Coeficiente

A favor: 51%
En contra: 30%
Abstención: 19%

Resultado: APROBADO ✅ (51% > 50%)
```

#### 2. Mayoría Calificada (70%)
```
Pregunta: "¿Aprueban reforma de estatutos?"
Tipo: Coeficiente

A favor: 72%
En contra: 18%
Abstención: 10%

Resultado: APROBADO ✅ (72% > 70%)
```

#### 3. Unanimidad (100%)
```
Pregunta: "¿Aprueban venta de bien común?"
Tipo: Coeficiente

A favor: 100%

Resultado: APROBADO ✅
```

---

## 🔐 Seguridad y Validaciones

### Al Registrar Voto:
```javascript
// 1. Verificar que la pregunta esté abierta
if (pregunta.estado !== 'abierta') {
  throw new Error('Votación cerrada')
}

// 2. Verificar que la unidad no haya votado
const yaVoto = await verificarVoto(preguntaId, unidadId)
if (yaVoto) {
  throw new Error('Ya votaste en esta pregunta')
}

// 3. Si es con poder, verificar que esté activo
if (esPoder) {
  const poder = await verificarPoder(poderId)
  if (poder.estado !== 'activo') {
    throw new Error('Poder no válido')
  }
}

// 4. Registrar voto
await supabase.from('votos').insert({
  pregunta_id: preguntaId,
  unidad_id: unidadId,
  opcion_id: opcionId,
  votante_email: email,
  es_poder: esPoder,
  poder_id: esPoder ? poderId : null
})

// 5. Si es con poder, marcar como usado
if (esPoder) {
  await supabase
    .from('poderes')
    .update({ estado: 'usado' })
    .eq('id', poderId)
}
```

### Al Calcular Estadísticas:
```sql
-- Solo contar votos válidos
SELECT COUNT(*) 
FROM votos v
JOIN preguntas p ON v.pregunta_id = p.id
WHERE p.id = $1
  AND v.unidad_id IS NOT NULL
  AND v.opcion_id IS NOT NULL
```

### Al Calcular Quórum:
```sql
-- Sumar coeficientes de unidades que han votado
SELECT SUM(DISTINCT u.coeficiente)
FROM votos v
JOIN unidades u ON v.unidad_id = u.id
WHERE v.pregunta_id IN (
  SELECT id FROM preguntas WHERE asamblea_id = $1
)
```

---

## 🚀 Próximos Pasos

### Implementación Pendiente:

#### 1. Interfaz Pública de Votación
```
/votacion/[codigo-asamblea]
  ├─ Validación de propietario
  ├─ Lista de preguntas abiertas
  ├─ Selección de opción
  ├─ Confirmación visual
  └─ Ver resultados en tiempo real
```

#### 2. Gestión de Poderes (Admin)
```
/dashboard/asambleas/[id]/poderes
  ├─ Registrar poder manualmente
  ├─ Subir documento escaneado
  ├─ Ver lista de poderes activos
  └─ Revocar poder si es necesario
```

#### 3. Registro de Poderes (Propietario)
```
/votacion/[codigo]/registrar-poder
  ├─ Formulario simple
  ├─ Email del receptor
  ├─ Subir documento (opcional)
  └─ Confirmación automática
```

#### 4. Control de Asistencia
```
/dashboard/asambleas/[id]/asistencia
  ├─ QR code para registro rápido
  ├─ Lista de unidades presentes
  ├─ Marcar presencia física/virtual
  └─ Calcular quórum inicial
```

---

## 📊 Casos de Uso Reales

### Ejemplo 1: Asamblea Ordinaria

```yaml
Asamblea: Ordinaria 2026
Fecha: 15 de febrero, 10:00 AM
Total unidades: 25
Coeficiente total: 100%

Pregunta 1: "¿Aprueban el presupuesto 2026?"
Tipo: Coeficiente
Requiere: Mayoría simple (>50%)

10:00 - Asamblea inicia
10:15 - 8 unidades votan (32%)
10:30 - 15 unidades votan (60%) ✅ Quórum alcanzado
11:00 - 20 unidades votan (80%)
11:30 - Se cierra votación

Resultados:
  A favor: 65% (13 votos) ✅ APROBADO
  En contra: 15% (3 votos)
  Abstención: 0%
  Sin votar: 5 unidades (20%)
```

### Ejemplo 2: Asamblea con Poderes

```yaml
Unidad 101: Juan Pérez (presente)
Unidad 102: María López (otorga poder a Juan)
Unidad 103: Carlos Díaz (otorga poder a Juan)

Juan tiene 3 votos:
  1. Su propia unidad (101): 1.2%
  2. Poder de María (102): 0.8%
  3. Poder de Carlos (103): 1.5%
  
Total coeficiente que controla: 3.5%

Al votar "A favor":
  → A favor suma 3.5%
  → Se registran 3 votos separados
  → Los 3 poderes quedan marcados como "usado"
```

---

## ✅ Resumen

### ¿Qué tienes ahora?
- ✅ Estadísticas en tiempo real
- ✅ Panel de quórum actualizado cada 5s
- ✅ Barras de progreso visuales
- ✅ Diferenciación coeficiente vs nominal
- ✅ Sistema de poderes (base de datos lista)
- ✅ Funciones SQL para cálculos
- ✅ Validaciones de Ley 675

### ¿Qué falta implementar?
- ⏳ Interfaz pública de votación
- ⏳ Gestión de poderes (admin)
- ⏳ Registro de poderes (propietario)
- ⏳ Control de asistencia con QR
- ⏳ Exportar resultados a PDF

---

## 🎉 Instalación

**Ejecuta el SQL**:

```bash
# En Supabase SQL Editor:
supabase/CREAR-SISTEMA-VOTOS-PODERES.sql
```

**Recarga la app** y verás:
1. Panel de quórum en la parte superior
2. Estadísticas en tiempo real por pregunta
3. Actualización automática cada 5 segundos

¡El sistema de votaciones está listo para recibir votos! 🗳️
