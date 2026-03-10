# 📋 Guía Completa: Módulo de Poderes

## 🎯 Objetivo

Permitir que los propietarios deleguen su derecho al voto a otra persona (apoderado) durante las asambleas, cumpliendo con la regulación de propiedad horizontal en Colombia.

---

## 📊 Estructura de Base de Datos

### Tabla: `poderes`
```sql
- id: UUID (Primary Key)
- asamblea_id: UUID (FK a asambleas)
- unidad_otorgante_id: UUID (FK a unidades) - La unidad que delega
- unidad_receptor_id: UUID (FK a unidades, opcional) - Si el apoderado es propietario
- email_otorgante: TEXT
- nombre_otorgante: TEXT
- email_receptor: TEXT - Identificador único del apoderado
- nombre_receptor: TEXT
- estado: TEXT ('activo', 'revocado', 'usado')
- archivo_poder: TEXT (URL del documento escaneado, opcional)
- observaciones: TEXT
- created_at: TIMESTAMP
- revocado_at: TIMESTAMP

CONSTRAINT UNIQUE(asamblea_id, unidad_otorgante_id, estado)
```

### Tabla: `configuracion_poderes`
```sql
- id: UUID (Primary Key)
- organization_id: UUID (FK a organizations)
- max_poderes_por_apoderado: INTEGER (default: 3, configurable 1–10)
- plantilla_adicional_correo: TEXT (opcional) — texto que se añade al cuerpo del correo de enlace de votación (ej. enlace Teams/Meet)
- requiere_documento: BOOLEAN (default: false)
- notas: TEXT

CONSTRAINT UNIQUE(organization_id)
```

**Configuración:** El gestor modifica estos valores en **Dashboard → Configuración → Poderes y correo**.

---

## 🔧 Funciones SQL Importantes

### 1. `validar_limite_poderes`
Valida si un apoderado puede recibir un nuevo poder según el límite configurado.

**Parámetros:**
- `p_asamblea_id`: UUID de la asamblea
- `p_email_receptor`: Email del apoderado
- `p_organization_id`: UUID del conjunto

**Retorna:**
- `puede_recibir_poder`: BOOLEAN
- `poderes_actuales`: INTEGER
- `limite_maximo`: INTEGER
- `mensaje`: TEXT

**Ejemplo de uso:**
```sql
SELECT * FROM validar_limite_poderes(
  'asamblea-uuid',
  'apoderado@example.com',
  'organization-uuid'
);
```

### 2. `resumen_poderes_asamblea`
Calcula el resumen estadístico de poderes en una asamblea.

**Parámetros:**
- `p_asamblea_id`: UUID de la asamblea

**Retorna:**
- `total_poderes_activos`: INTEGER
- `total_unidades_delegadas`: INTEGER
- `coeficiente_total_delegado`: NUMERIC
- `porcentaje_coeficiente`: NUMERIC

**Ejemplo de uso:**
```sql
SELECT * FROM resumen_poderes_asamblea('asamblea-uuid');
```

---

## 🖥️ Interfaz de Usuario

### Página Principal: `/dashboard/asambleas/[id]/poderes`

**Secciones:**

1. **Resumen en Tarjetas:**
   - Poderes Activos
   - Unidades Delegadas
   - Coeficiente Total Delegado
   - Límite por Apoderado

2. **Información Regulatoria:**
   - Alerta azul explicando qué son los poderes
   - Límite actual configurado
   - Cómo funcionan en las votaciones

3. **Buscador:**
   - Búsqueda por unidad, propietario o apoderado

4. **Tabla de Poderes:**
   | Unidad Otorgante | Propietario | Apoderado | Coeficiente | Estado | Acciones |
   |-----------------|-------------|-----------|-------------|--------|----------|
   | Torre - Apto    | Nombre      | Nombre    | %           | Badge  | Revocar  |

5. **Documento del poder (opcional):**
   - En el modal de registro y en la tabla: cargar documento PDF o Word (.doc, .docx), máximo 2MB
   - Se puede reemplazar en cualquier momento con el botón "Reemplazar" o "Cargar documento"
   - **Checklist manual (Ley 675):** Lista desplegable con lo que debe contener el documento según normativa, para que el gestor verifique antes de subir
   - Requiere ejecutar `supabase/STORAGE-BUCKET-PODERES-DOCS.sql` una vez

6. **Documentos de poder como anexos en la descarga del acta**
   - En la página del acta (`/dashboard/asambleas/[id]/acta`), al descargar el PDF el administrador puede elegir **incluir documentos de poder como anexos** (checkbox en el modal de descarga, visible solo si hay poderes con documento cargado).
   - Si se marca la opción, se genera un **ZIP** que contiene: el PDF del acta (auditoría completa o versión pública) y una carpeta **anexos-documentos-poder** con los archivos de cada poder (nombre tipo `poder-T{torre}-Apt{numero}.pdf`). Útil para adjuntar las pruebas de poderes al acta en un solo paquete.

7. **Botón "Registrar Poder":**
   - Abre modal con 2 pasos:
     1. Seleccionar unidad que otorga el poder
     2. Ingresar datos del apoderado y opcionalmente adjuntar documento

---

## 🔐 Reglas de Negocio

### 1. Límite de Poderes por Apoderado

**Regulación Colombia (Ley 675):**
- Los reglamentos de propiedad horizontal pueden limitar cuántos poderes puede recibir una persona
- Típicamente: 2-3 poderes máximo por apoderado
- **Configurable por conjunto** en **Dashboard → Configuración → Poderes y correo** (1–10 poderes máximo por apoderado)

**Validación:**
- Al registrar un nuevo poder, se valida contra el límite
- Si el apoderado ya alcanzó el límite, se rechaza
- Mensaje claro al administrador

### 2. Una Unidad = Un Poder por Asamblea

**Regla:**
- Una unidad solo puede otorgar UN poder activo por asamblea
- Si necesita cambiar el apoderado, debe revocar el anterior primero

**Implementación:**
```sql
UNIQUE(asamblea_id, unidad_otorgante_id, estado)
```

### 3. Estados del Poder

| Estado | Descripción | ¿Puede usarse para votar? |
|--------|-------------|---------------------------|
| `activo` | Poder vigente y válido | ✅ SÍ |
| `revocado` | Cancelado por el administrador | ❌ NO |
| `usado` | Ya se utilizó para votar | ⚠️ Depende de la implementación |

### 4. Revocación de Poderes

**¿Quién puede revocar?**
- El administrador de la asamblea
- El propietario que otorgó el poder (futuro)

**¿Cuándo se puede revocar?**
- Antes de que el apoderado vote
- Durante la asamblea si el propietario decide asistir

**Efecto:**
- Cambia `estado` a 'revocado'
- Registra `revocado_at`
- El apoderado ya no puede votar por esa unidad

---

## 🗳️ Integración con Votaciones

### Cálculo del Voto del Apoderado

**Escenario:**
1. Juan (Apto 101) delega poder a María
2. Pedro (Apto 202) delega poder a María
3. María también es propietaria (Apto 303)

**Cuando María vota:**
- Su voto representa:
  - Coeficiente del Apto 101 (de Juan)
  - Coeficiente del Apto 202 (de Pedro)
  - Coeficiente del Apto 303 (propio)
  - **Total: Suma de los 3 coeficientes**

### Implementación en la Tabla `votos`

```sql
-- Voto de María por el Apto 101 (poder de Juan)
INSERT INTO votos (pregunta_id, unidad_id, opcion_id, votante_email, es_poder, poder_id)
VALUES ('pregunta-uuid', 'apto-101-uuid', 'opcion-uuid', 'maria@example.com', true, 'poder-uuid');

-- Voto de María por el Apto 202 (poder de Pedro)
INSERT INTO votos (pregunta_id, unidad_id, opcion_id, votante_email, es_poder, poder_id)
VALUES ('pregunta-uuid', 'apto-202-uuid', 'opcion-uuid', 'maria@example.com', true, 'poder-uuid');

-- Voto de María por su propio Apto 303
INSERT INTO votos (pregunta_id, unidad_id, opcion_id, votante_email, es_poder)
VALUES ('pregunta-uuid', 'apto-303-uuid', 'opcion-uuid', 'maria@example.com', false);
```

### Actualización de la Función `calcular_estadisticas_pregunta`

**YA IMPLEMENTADA** ✅

La función actual en `CREAR-SISTEMA-VOTOS-PODERES.sql` ya suma correctamente el coeficiente de cada `unidad_id` votada, sin importar quién votó:

```sql
SELECT COALESCE(SUM(u.coeficiente), 0) INTO v_total_coeficiente
FROM votos v
JOIN unidades u ON v.unidad_id = u.id
WHERE v.pregunta_id = p_pregunta_id;
```

**¿Por qué funciona?**
- Cada voto registra `unidad_id` (la unidad que está votando)
- El JOIN con `unidades` obtiene el coeficiente de cada unidad
- Si María votó por 3 unidades (2 poderes + 1 propio), se crean 3 registros en `votos`
- La suma total incluye los 3 coeficientes automáticamente

---

## 📱 Flujo de Usuario (Administrador)

### Registrar un Poder

1. **Acceder al Módulo:**
   - Desde detalle de asamblea → "Gestión de Poderes"

2. **Clic en "Registrar Poder"**

3. **Paso 1: Seleccionar Unidad Otorgante**
   - Buscar por torre, número o nombre del propietario
   - Ver coeficiente de la unidad
   - Seleccionar

4. **Paso 2: Datos del Apoderado**
   - Nombre completo (requerido)
   - Email (requerido - identificador único)
   - Observaciones (opcional)

5. **Validación Automática:**
   - ¿La unidad ya tiene un poder activo? → Rechazar
   - ¿El apoderado alcanzó el límite? → Rechazar con mensaje claro
   - ¿Datos válidos? → Proceder

6. **Confirmación:**
   - Poder registrado con estado 'activo'
   - Aparece en la tabla
   - Se actualiza el resumen

### Revocar un Poder

1. **En la tabla de poderes:**
   - Clic en "Revocar" (botón rojo con icono X)

2. **Confirmación:**
   - "¿Estás seguro de revocar este poder?"

3. **Efecto:**
   - Estado cambia a 'revocado'
   - Se registra fecha de revocación
   - El apoderado ya no puede votar por esa unidad

---

## 🔮 Funcionalidades Futuras

### 1. Documento del poder (implementado)
- Campo `archivo_poder` almacena la URL del documento en Supabase Storage
- Carga opcional al registrar (PDF o Word, máx. 2MB)
- Botón "Reemplazar" o "Cargar documento" en la tabla de poderes
- Bucket `poderes-docs`; ejecutar `STORAGE-BUCKET-PODERES-DOCS.sql`

### 2. Interfaz Pública para Propietarios
- Los propietarios pueden registrar sus propios poderes
- Autenticación con email
- Notificación al administrador para aprobación

### 3. Notificaciones
- Email al apoderado cuando recibe un poder
- Email al propietario confirmando el registro
- Recordatorio al apoderado antes de la asamblea

### 4. Registro de Asistencia Automático
- Cuando el apoderado marca asistencia, automáticamente:
  - Se registra asistencia de todas las unidades que representa
  - Se actualiza el quórum
  - Se muestra en pantalla

### 5. Validación de Identidad
- QR code único por poder
- Verificación de identidad al momento de votar
- Registro de quién votó por cada unidad

### 6. Reportes y Auditoría
- PDF con listado de poderes de la asamblea
- Historial de cambios (registrado, revocado)
- Estadísticas de uso de poderes por asamblea

---

## 🚀 Pasos de Implementación

### ✅ Completado

1. **Base de Datos:**
   - ✅ Tabla `poderes` (ya existía en CREAR-SISTEMA-VOTOS-PODERES.sql)
   - ✅ Tabla `configuracion_poderes` (AGREGAR-CONFIG-PODERES.sql)
   - ✅ Funciones SQL de validación y resumen
   - ✅ Vista `vista_poderes_completa`

2. **Backend (SQL):**
   - ✅ RLS deshabilitado para desarrollo
   - ✅ Funciones auxiliares creadas

3. **Frontend:**
   - ✅ Página `/dashboard/asambleas/[id]/poderes`
   - ✅ Componentes UI (modal, tabla, búsqueda)
   - ✅ Botón de acceso en detalle de asamblea

### 🔄 Pendiente (Próximos Pasos)

4. **Integración con Votación:**
   - ⏳ Interfaz pública de votación que detecte poderes
   - ⏳ Al votar, crear múltiples registros en `votos` (uno por cada unidad representada)
   - ⏳ Mostrar al apoderado cuántas unidades representa

5. **Integración con Quórum:**
   - ⏳ Al registrar asistencia del apoderado, marcar todas sus unidades
   - ⏳ Mostrar en el panel de quórum cuántas unidades están por poder

6. **Mejoras UX:**
   - ⏳ Carga de documento del poder
   - ⏳ Validación visual (checkmarks, alertas)
   - ⏳ Tooltips explicativos

---

## 💡 Consejos de Uso

### Para Administradores

1. **Registra los poderes ANTES de la asamblea:**
   - Facilita la planificación
   - Evita confusiones el día del evento

2. **Verifica el límite configurado:**
   - Ajusta en **Dashboard → Configuración → Poderes y correo** según el reglamento interno (1–10 poderes por apoderado)

3. **Comunica claramente:**
   - Informa a los propietarios sobre el proceso
   - Explica cómo funciona la delegación del voto

4. **Mantén evidencia:**
   - Si es posible, solicita el documento del poder firmado
   - Registra observaciones relevantes

### Para Desarrolladores

1. **Validación en todos los niveles:**
   - SQL (UNIQUE constraints, CHECK constraints)
   - Backend (funciones de validación)
   - Frontend (UX clara con mensajes de error)

2. **Manejo de errores:**
   - Mensajes claros para el usuario
   - Logs detallados para debugging

3. **Testing:**
   - Probar límites (1, 2, 3 poderes)
   - Probar revocación
   - Probar unidad ya delegada

---

## 📞 Siguientes Acciones Recomendadas

1. **Ejecutar el SQL:**
   ```bash
   # En Supabase Dashboard > SQL Editor
   # Ejecutar: supabase/AGREGAR-CONFIG-PODERES.sql
   ```

2. **Probar el Módulo:**
   - Ir a una asamblea
   - Clic en "Gestión de Poderes"
   - Registrar un poder de prueba
   - Verificar resumen
   - Intentar registrar más de 3 poderes para el mismo apoderado
   - Revocar un poder

3. **Siguiente Fase:**
   - Implementar interfaz pública de votación con soporte para poderes
   - Actualizar el sistema de quórum para considerar poderes

---

**¿Listo para continuar con la integración de poderes en el sistema de votación?** 🚀
