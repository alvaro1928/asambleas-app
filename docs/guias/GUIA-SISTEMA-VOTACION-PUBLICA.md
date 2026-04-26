# 🗳️ Guía Completa: Sistema de Votación Pública

## 🎯 Objetivo

Permitir que los residentes voten de forma transparente, segura y conforme a la **Ley 675** de Propiedad Horizontal en Colombia.

---

## ⚖️ Requisitos Legales (Ley 675)

### 1. **Trazabilidad Completa**
✅ **Registro detallado de:**
- Quién votó (email identificador)
- Cuándo votó (timestamp)
- Por cuál unidad(es) votó
- Si usó poderes o no
- Historial de cambios de voto
- IP y dispositivo (opcional para auditoría adicional)

### 2. **Derecho a Modificar el Voto**
✅ **Mientras la pregunta esté "abierta":**
- El votante puede cambiar su voto cuantas veces quiera
- Solo cuenta el último voto emitido
- Se registra el historial completo de cambios
- Una vez "cerrada" la pregunta, no se puede modificar

### 3. **Transparencia en Tiempo Real**
✅ **El votante debe ver:**
- ✅ Su propio voto (marcado claramente)
- ✅ Quórum actual (alcanzado o no)
- ✅ Estadísticas de la votación (% por opción)
- ✅ Gráficos de distribución
- ✅ Número de unidades que han votado

### 4. **Quórum según Ley 675**
- Mínimo: **50% del coeficiente total** para que la asamblea sea válida
- Mayorías:
  - Simple: > 50% de votos emitidos
  - Absoluta: > 50% del coeficiente total
  - Calificada: > 70% del coeficiente total (casos especiales)

---

## 📊 Base de Datos: Trazabilidad

### Tabla: `historial_votos`
Registra **TODOS** los votos y cambios:

```sql
CREATE TABLE historial_votos (
  id UUID PRIMARY KEY,
  voto_id UUID,                    -- Referencia al voto actual
  pregunta_id UUID NOT NULL,
  unidad_id UUID NOT NULL,
  opcion_id UUID NOT NULL,
  votante_email TEXT NOT NULL,
  votante_nombre TEXT,
  es_poder BOOLEAN DEFAULT false,
  poder_id UUID,
  accion TEXT,                     -- 'crear' o 'modificar'
  opcion_anterior_id UUID,         -- Opción anterior (si modificó)
  ip_address TEXT,                 -- IP del votante
  user_agent TEXT,                 -- Navegador/dispositivo
  created_at TIMESTAMP NOT NULL
);
```

### Función: `registrar_voto_con_trazabilidad`
Maneja todo el proceso de votación:

```sql
SELECT * FROM registrar_voto_con_trazabilidad(
  p_pregunta_id := 'uuid-pregunta',
  p_unidad_id := 'uuid-unidad',
  p_opcion_id := 'uuid-opcion',
  p_votante_email := 'votante@email.com',
  p_votante_nombre := 'Nombre Votante',
  p_es_poder := true,              -- Si vota con poder
  p_poder_id := 'uuid-poder',      -- ID del poder
  p_ip_address := '192.168.1.100', -- IP del votante
  p_user_agent := 'Chrome/...'     -- Navegador
);
```

**Retorna:**
- `voto_id`: UUID del voto
- `accion`: 'crear' o 'modificar'
- `mensaje`: Confirmación

---

## 🖥️ Interfaz de Usuario

### Ruta: `/votar/[codigo-asamblea]`

**Flujo del Usuario:**

```
1. Acceso
   ↓
2. Identificación (Email)
   ↓
3. Detección de Poderes
   ↓
4. Vista de Preguntas
   ↓
5. Selección de Respuesta
   ↓
6. Confirmación
   ↓
7. Registro del Voto
   ↓
8. Ver Resultados en Tiempo Real
```

---

## 📱 Componentes de la Interfaz

### 1. **Pantalla de Acceso**
```
┌─────────────────────────────────────┐
│  🗳️  Asamblea Ordinaria 2026       │
│  Conjunto Residencial Las Palmas    │
├─────────────────────────────────────┤
│  Ingresa tu email para votar:       │
│  [___________________________]      │
│  [  Continuar  ]                    │
└─────────────────────────────────────┘
```

**Validación:**
- Email existe en las unidades del conjunto
- O email tiene poderes activos en esta asamblea

### 2. **Detección Automática de Poderes**
```
┌─────────────────────────────────────┐
│  ✅ Bienvenido, María García        │
├─────────────────────────────────────┤
│  Estás votando por:                 │
│                                      │
│  🏠 Apto 303 (Tu unidad)            │
│     Coeficiente: 1.5%               │
│                                      │
│  📝 Apto 101 (Poder de Juan)        │
│     Coeficiente: 2.0%               │
│                                      │
│  📝 Apto 202 (Poder de Pedro)       │
│     Coeficiente: 3.0%               │
│                                      │
│  TOTAL: 3 unidades | 6.5% del total│
└─────────────────────────────────────┘
```

### 3. **Panel de Quórum** (Siempre Visible)
```
┌─────────────────────────────────────┐
│  👥 QUÓRUM ACTUAL                   │
├─────────────────────────────────────┤
│  ✅ ALCANZADO (52.5%)               │
│                                      │
│  [████████████████░░░░░░] 52.5%     │
│                                      │
│  25 de 48 unidades han votado       │
│  52.50% del coeficiente total       │
└─────────────────────────────────────┘
```

### 4. **Tarjeta de Pregunta**
```
┌─────────────────────────────────────┐
│  Pregunta #1                         │
│  ¿Aprueban el presupuesto 2026?     │
├─────────────────────────────────────┤
│  Descripción:                        │
│  Presupuesto de $500M para...        │
├─────────────────────────────────────┤
│  Tipo: Por Coeficiente (Ley 675)    │
│  Estado: 🟢 Abierta                 │
├─────────────────────────────────────┤
│  Selecciona tu respuesta:            │
│                                      │
│  ○ 🟢 A favor (45.2%)               │
│  [████████████░░░░░░░░░░] 45.2%     │
│  22 votos | 45.20% coeficiente      │
│                                      │
│  ✓ 🔴 En contra (35.8%) ← TU VOTO   │
│  [███████████░░░░░░░░░░░] 35.8%     │
│  15 votos | 35.80% coeficiente      │
│                                      │
│  ○ ⚪ Me abstengo (19.0%)            │
│  [████░░░░░░░░░░░░░░░░░░] 19.0%     │
│  8 votos | 19.00% coeficiente       │
│                                      │
│  [  Confirmar Voto  ]               │
│  [  Modificar Voto  ]               │
├─────────────────────────────────────┤
│  ℹ️ Puedes cambiar tu voto mientras  │
│     la pregunta esté abierta         │
└─────────────────────────────────────┘
```

### 5. **Confirmación de Voto**
```
┌─────────────────────────────────────┐
│  ✅ Voto Registrado                 │
├─────────────────────────────────────┤
│  Pregunta #1: ¿Aprueban el          │
│  presupuesto 2026?                  │
│                                      │
│  Tu respuesta: 🔴 En contra         │
│                                      │
│  Votaste por 3 unidades:            │
│  • Apto 303 (tu unidad)             │
│  • Apto 101 (poder)                 │
│  • Apto 202 (poder)                 │
│                                      │
│  Total: 6.5% del coeficiente        │
│                                      │
│  Fecha: 25/01/2026 - 10:30 AM      │
└─────────────────────────────────────┘
```

### 6. **Ya Votaste (Pregunta Cerrada)**
```
┌─────────────────────────────────────┐
│  🔒 Votación Cerrada                │
├─────────────────────────────────────┤
│  Pregunta #1                         │
│  ¿Aprueban el presupuesto 2026?     │
│                                      │
│  Tu voto: 🔴 En contra              │
│  (No se puede modificar)            │
│                                      │
│  RESULTADO FINAL:                   │
│  🟢 A favor: 55.2% ✓ APROBADO       │
│  🔴 En contra: 30.8%                │
│  ⚪ Abstenidos: 14.0%                │
└─────────────────────────────────────┘
```

---

## 🔄 Flujo de Modificación de Voto

```javascript
// Usuario ya votó "A favor"
// Ahora quiere cambiar a "En contra"

1. Usuario selecciona nueva opción "En contra"
2. Clic en "Confirmar Voto"
3. Sistema detecta que ya votó
4. Muestra confirmación:
   
   ┌─────────────────────────────────┐
   │  ⚠️ Cambiar Voto                │
   ├─────────────────────────────────┤
   │  Voto actual: 🟢 A favor        │
   │  Nuevo voto: 🔴 En contra       │
   │                                  │
   │  ¿Confirmas el cambio?          │
   │  [Cancelar] [Sí, cambiar]      │
   └─────────────────────────────────┘

5. Si confirma:
   - Se actualiza el voto en DB
   - Se registra en historial_votos
   - Estadísticas se actualizan
   - Ve confirmación
```

---

## 🔐 Seguridad y Validaciones

### Backend (API/Funciones SQL)
1. ✅ Verificar que la pregunta esté "abierta"
2. ✅ Verificar que el email existe en el conjunto
3. ✅ Verificar poderes activos del votante
4. ✅ Validar que cada unidad vote solo una vez por pregunta
5. ✅ Registrar IP y User-Agent para auditoría
6. ✅ Registrar timestamp exacto

### Frontend (UX)
1. ✅ Mostrar claramente el estado de la pregunta
2. ✅ Deshabilitar votación si está cerrada
3. ✅ Marcar visualmente el voto actual
4. ✅ Confirmación antes de modificar voto
5. ✅ Actualización en tiempo real de estadísticas

---

## 📊 Reportes de Auditoría

### Para Administradores
```sql
-- Reporte completo de auditoría
SELECT * FROM reporte_auditoria_pregunta('uuid-pregunta');
```

**Retorna:**
| Votante | Unidad | Opción | Es Poder | Acción | Opción Anterior | Fecha | IP |
|---------|--------|--------|----------|--------|-----------------|-------|-----|
| maria@email.com | 101 | A favor | No | crear | - | 10:30 | 192.168.1.1 |
| maria@email.com | 101 | En contra | No | modificar | A favor | 10:35 | 192.168.1.1 |
| juan@email.com | 202 | A favor | No | crear | - | 10:32 | 192.168.1.2 |

### Exportar a PDF
- Listado completo de votantes
- Historial de cambios
- Resultado final con firmas digitales
- Cumple con requisitos de acta de asamblea

---

## 🚀 Estado de implementación

### Archivos implementados en el proyecto:

1. **`supabase/AGREGAR-TRAZABILIDAD-VOTOS.sql`** ✅ (Ya creado)
   - Tabla `historial_votos`
   - Función `registrar_voto_con_trazabilidad`
   - Función `obtener_votos_votante`
   - Función `reporte_auditoria_pregunta`

2. **`app/votar/[codigo]/page.tsx`** ✅
   - Interfaz pública de votación
   - Detección de poderes
   - Panel de quórum
   - Estadísticas en tiempo real

3. **`app/api/votar/route.ts`** ✅
   - API para registrar votos
   - Validaciones de seguridad
   - Captura de IP y User-Agent

4. **Panel de quórum en dashboard/asistencia** ✅
   - Quórum por coeficiente y estado de presencia en vivo
   - Actualización automática + recálculo por eventos

5. **Tarjetas de pregunta y resultados** ✅
   - Preguntas con opciones y gráficos en tiempo real
   - Indicador de voto actual y trazabilidad

---

## ✅ Checklist de Cumplimiento Legal

| Requisito | Estado | Implementación |
|-----------|--------|----------------|
| Trazabilidad completa | ✅ | `historial_votos` + función SQL |
| Modificar voto | ✅ | Lógica en `registrar_voto_con_trazabilidad` |
| Ver mi voto | ✅ | Función `obtener_votos_votante` |
| Ver quórum | ✅ | `calcular_quorum_asamblea` (ya existe) |
| Ver estadísticas | ✅ | `calcular_estadisticas_pregunta` (ya existe) |
| Reporte auditoría | ✅ | Función `reporte_auditoria_pregunta` |
| Detección poderes | ✅ | Query a tabla `poderes` |
| Registro timestamp | ✅ | Campo `created_at` automático |
| IP/Dispositivo | ✅ | Campos `ip_address`, `user_agent` |

---

## 📞 Próximos pasos recomendados

1. ✅ **Ejecutar SQL de trazabilidad** (AGREGAR-TRAZABILIDAD-VOTOS.sql)
2. ✅ **Interfaz de votación pública** (`app/votar/[codigo]/page.tsx`)
3. ✅ **API de votación** (incluye trazabilidad)
4. ⏳ **Expandir pruebas E2E** (reconexión/presencia/snapshots)
5. ⏳ **Endurecer validaciones de producción y reportes de no regresión**

---

**La interfaz de votación y la API ya están operativas; la prioridad actual es fortalecer pruebas y observabilidad.**
