# Cumplimiento regulatorio – Ley 675 y propiedad horizontal

Este documento relaciona las **funcionalidades de la aplicación** con los **requisitos de la Ley 675 de 2001** (Propiedad Horizontal, Colombia) y buenas prácticas de asambleas y votaciones.

---

## 1. Resumen ejecutivo

| Área | Cumplimiento | Observaciones |
|------|--------------|---------------|
| Coeficientes y censo | ✅ | Validación suma 100%, importación con Ley 675 |
| Quórum (50% coeficiente) | ✅ | Cálculo automático, indicador alcanzado/no |
| Votación por coeficiente | ✅ | Ponderación por unidad, porcentajes sobre total conjunto |
| Trazabilidad de votos | ✅ | Historial, IP, user_agent, quien/cuando/unidad |
| Modificación de voto | ✅ | Solo mientras pregunta abierta; historial registrado |
| Poderes | ✅ | Límite por apoderado configurable, revocación |
| Transparencia en tiempo real | ✅ | Estadísticas, quórum, resultados visibles al votante |
| Acta y auditoría | ✅ | Descarga, detalle por pregunta, auditoría (quién, cuándo, IP, dispositivo) |
| Mayoría calificada (70%) | ✅ | Campo "Umbral de aprobación (%)" por pregunta; etiqueta Aprobado/No aprobado según umbral |
| Convocatoria formal | ⚠️ | No hay módulo de convocatoria/notificación; se asume externa |

**Conclusión:** Las funcionalidades implementadas cubren los aspectos centrales de la Ley 675 para asambleas y votaciones. Algunos puntos (mayoría calificada, convocatoria) dependen de criterio o procesos externos.

---

## 2. Requisitos Ley 675 vs implementación

### 2.1 Coeficiente de copropiedad (Art. 15 y relacionados)

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| Coeficientes por unidad que reflejen participación en bienes comunes | Tabla `unidades` con `coeficiente` por organización | ✅ |
| Suma de coeficientes = 100% del conjunto | Validación en importación (Excel/CSV) y en UI; rechazo si ≠ 100% | ✅ |
| Censo actualizado (propietarios, contacto) | Unidades con email/teléfono, búsqueda y filtros | ✅ |

**Archivos / flujos:** `app/dashboard/unidades/importar`, validación “Ley 675” en importación; `supabase` scripts que definen `unidades.coeficiente`.

---

### 2.2 Quórum de asamblea (Art. 39 Ley 675)

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| Asamblea válida con al menos 50% del coeficiente total | Función `calcular_quorum_asamblea`: compara coeficiente votante vs total, `quorum_alcanzado` si ≥ 50% | ✅ |
| Cálculo en tiempo real | Panel en detalle de asamblea; RPC y polling | ✅ |
| Registro de asistencia (presentes) | Tabla `quorum_asamblea` (presente_virtual/presente_fisica); solo sesiones activas en “Registro de Ingresos” | ✅ |

**Archivos:** `calcular_quorum_asamblea` en SQL; `app/dashboard/asambleas/[id]/page.tsx` (panel quórum); `app/dashboard/asambleas/[id]/acceso` (registro de ingresos).

---

### 2.3 Votación y mayorías (Art. 23, 24, 18 Ley 675)

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| Voto ponderado por coeficiente | Tipo de votación “coeficiente”; cada voto suma el coeficiente de la unidad | ✅ |
| Voto nominal (1 unidad = 1 voto) | Tipo “nominal”; conteo por cantidad de votos | ✅ |
| Porcentajes sobre el total del conjunto | `calcular_estadisticas_pregunta` usa coeficiente total del conjunto (100%); estadísticas en % sobre ese total | ✅ |
| Mayoría simple (> 50% de lo emitido) | Se muestran % por opción; el administrador interpreta si se aprueba o no | ✅ |
| Mayoría calificada (ej. 70% para reforma estatutos, Art. 18) | No hay campo “umbral de aprobación” (50%, 70%, etc.) por pregunta; el administrador debe interpretar los % mostrados | ⚠️ |

**Recomendación:** Para mayorías calificadas, el administrador debe (1) crear la pregunta con el tipo correcto (coeficiente) y (2) interpretar el resultado (ej. “A favor 72%” → aprobado si el reglamento exige 70%). Opcional a futuro: campo por pregunta “Umbral de aprobación (%)” y etiqueta “Aprobado / No aprobado” según ese umbral.

---

### 2.4 Trazabilidad y auditoría (buenas prácticas y obligaciones de registro)

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| Registro de quién votó | `votos` + `historial_votos` con `votante_email`, `unidad_id`, `opcion_id` | ✅ |
| Cuándo votó | `created_at` en votos e historial | ✅ |
| Por qué unidad(es) y si es poder | `unidad_id`, `es_poder`, `poder_id` en `registrar_voto_con_trazabilidad` | ✅ |
| Historial de cambios de voto | `historial_votos` con `accion` (crear/modificar), `opcion_anterior_id` | ✅ |
| IP y dispositivo (auditoría) | `ip_address`, `user_agent` en historial; `/api/client-info` y envío al registrar voto | ✅ |
| Acta con resultados y detalle auditable | Acta descargable con resultados por pregunta, quórum y detalle de auditoría (quién, cuándo, IP, dispositivo) | ✅ |

**Archivos:** `supabase/AGREGAR-TRAZABILIDAD-VOTOS.sql`, `registrar_voto_con_trazabilidad`, `app/api/client-info`, `app/dashboard/asambleas/[id]/acta/page.tsx`, `reporte_auditoria_pregunta`.

---

### 2.5 Derecho a modificar el voto

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| El votante puede cambiar su voto mientras la pregunta esté abierta | Flujo en `/votar/[codigo]`: se puede elegir otra opción; `registrar_voto_con_trazabilidad` hace UPDATE si ya existe voto | ✅ |
| Solo cuenta el último voto | Tabla `votos` 1 fila por (pregunta_id, unidad_id); actualización reemplaza opción | ✅ |
| Una vez cerrada la pregunta, no se puede modificar | Validación en backend (pregunta en estado “abierta”); preguntas cerradas no permiten nuevo voto | ✅ |

---

### 2.6 Poderes (delegación del voto)

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| Unidad puede delegar voto en un apoderado | Tabla `poderes` (unidad_otorgante, apoderado por email); validación en `validar_votante_asamblea` | ✅ |
| Límite de poderes por apoderado (reglamento) | `configuracion_poderes.max_poderes_por_apoderado`; validación al registrar poder | ✅ |
| Un poder por unidad por asamblea | Constraint y lógica: una unidad solo un poder activo por asamblea | ✅ |
| Revocación de poderes | Estado “revocado” y flujo en UI en poderes | ✅ |

**Archivos:** `GUIA-MODULO-PODERES.md`, `validar_limite_poderes`, `app/dashboard/asambleas/[id]/poderes`.

---

### 2.7 Transparencia ante el votante

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| Ver su propio voto | En `/votar/[codigo]` se muestra “Tu voto” / progreso por unidad | ✅ |
| Ver quórum actual | Panel quórum en detalle asamblea; en votación pública se puede mostrar participación | ✅ |
| Ver estadísticas de la votación | Porcentajes por opción (sobre coeficiente total del conjunto, Ley 675) en tiempo real | ✅ |

---

### 2.8 Acceso a la votación (identificación)

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| Identificación del votante (propietario o apoderado) | Entrada por código de asamblea + email/teléfono; cruce con unidades y poderes | ✅ |
| Código de acceso a la asamblea | `asambleas.codigo_acceso`, activación “votación pública”; QR y enlace en Control de Acceso | ✅ |

---

### 2.9 Convocatoria y notificaciones

| Requisito | Implementación | Estado |
|-----------|----------------|--------|
| Convocatoria formal (fecha, lugar, orden del día) | La app gestiona asambleas (nombre, fecha, preguntas) pero no envía convocatorias ni notificaciones por correo/SMS | ⚠️ |
| Notificación a propietarios | No hay módulo de “enviar convocatoria” o “notificar a todas las unidades” | ⚠️ |

**Recomendación:** La convocatoria y notificación pueden hacerse por fuera (correo, cartelera, otro sistema) usando la fecha y el enlace/QR que genera la app (Control de Acceso).

---

## 3. Checklist rápido de cumplimiento

- [x] Coeficientes con suma 100% (Ley 675) en importación y datos.
- [x] Quórum calculado (50% coeficiente) y mostrado en tiempo real.
- [x] Votación por coeficiente y nominal; porcentajes sobre total del conjunto.
- [x] Trazabilidad completa: quién, cuándo, unidad, poder, historial, IP, dispositivo.
- [x] Modificación de voto solo mientras la pregunta está abierta.
- [x] Poderes con límite por apoderado y revocación.
- [x] Acta descargable con resultados y detalle de auditoría.
- [x] Registro de ingresos en tiempo real solo con sesiones activas.
- [x] Mayoría calificada (70% u otro %) como umbral por pregunta: campo "Umbral de aprobación (%)" y etiqueta "Aprobado / No aprobado".
- [ ] Convocatoria/notificación desde la app (opcional; puede seguir siendo externa).

---

## 4. Documentos de referencia en el proyecto

- **Ley 675:** Guías que citan Art. 15, 18, 23, 24, 39: `GUIA-SISTEMA-VOTACION-PUBLICA.md`, `GUIA-MODULO-VOTACIONES.md`, `GUIA-ESTADISTICAS-QUORUM-PODERES.md`, `GUIA-MODULO-PODERES.md`, `GUIA-IMPORTACION-UNIDADES.md`.
- **Estadísticas y quórum:** `supabase/MEJORAR-ESTADISTICAS-COEFICIENTE.sql`, `SCRIPT-FINAL-LEY-675.sql`.
- **Auditoría:** `supabase/AUDITORIA-Y-BLOCKCHAIN.md`, `ACTUALIZAR-REPORTE-AUDITORIA-USER-AGENT.sql`.

---

**Conclusión:** Las funcionalidades actuales cumplen con los aspectos centrales de la Ley 675 para asambleas y votaciones (coeficientes, quórum, votación ponderada, trazabilidad, poderes, acta). La interpretación de mayorías calificadas (70%) y la convocatoria/notificación quedan como responsabilidad del administrador o de procesos externos, con posibilidad de ampliar la app más adelante si se desea.
