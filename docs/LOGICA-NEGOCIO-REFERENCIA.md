# Lógica de negocio — Referencia para continuar

Documento de referencia para retomar el trabajo en este chat. **Proyecto:** Asambleas App (votaciones online propiedad horizontal, Next.js + Supabase).

---

## 1. Entidades principales

### 1.1 Organizations (Conjuntos)
- Un usuario puede tener **varios conjuntos** (multi-tenant).
- Selector de conjunto en header; se persiste en `localStorage` (`selectedConjuntoId`).
- Cada conjunto tiene unidades, asambleas, poderes.

### 1.2 Unidades
- Campos: `organization_id`, `torre`, `numero`, `coeficiente`, `tipo`, `nombre_propietario`, `email`, `email_propietario`, `telefono`, `telefono_propietario`, **`is_demo`**.
- **Coeficientes:** suma debe ser 100% (Ley 675). Tolerancia: 99.9%–100.1% (`lib/coeficientes.ts`).
- **is_demo = true:** unidades creadas por `createDemoData`; no editables/eliminables en UI. Emails `test1@asambleas.online` … `test10@asambleas.online`.

### 1.3 Asambleas
- Estados: `'borrador' | 'activa' | 'finalizada'`.
- **is_demo = true:** asamblea sandbox; no consume tokens; acta con marca "BORRADOR DE PRUEBA".
- Edición de fecha solo en borrador o activa; oculta en finalizada.
- Ventana de gracia 3 días tras activar (ajustes antes de congelar estructura).

### 1.4 Preguntas
- Estados: `'pendiente' | 'abierta' | 'cerrada'`.
- Tipos: `'coeficiente' | 'nominal'`.
- Umbral de aprobación opcional.
- **Semántica:** "Abrir/Cerrar Pregunta" (no "Votación"); "Votación" se reserva para activar/desactivar acceso público.

### 1.5 Poderes
- Otorgante → Receptor; `estado: 'activo'`; límite por apoderado (ej. 3 poderes).
- Auto-fill al seleccionar unidad otorgante o receptora (nombre, email, coeficiente).

---

## 2. Demo vs real (is_demo)

| Contexto | Asamblea real (is_demo=false) | Asamblea sandbox (is_demo=true) |
|----------|-------------------------------|----------------------------------|
| **Quórum** | Solo unidades con `is_demo = false` | Solo unidades con `is_demo = true` |
| **Registrar voto** (admin) | Solo unidades `is_demo = false` o `null` | Solo unidades `is_demo = true` |
| **Tokens** | Consume al activar | No consume |
| **Credenciales prueba** | No se muestra | Panel con test1…10@asambleas.online |
| **Editar/eliminar** | Permitido | No permitido (preguntas, unidades) |

**Quórum:** RPC `calcular_quorum_asamblea` filtra por `unidades.is_demo = asamblea.is_demo`.  
**Registrar voto:** Filtro en `handleAbrirRegistroVotoAdmin` (`app/dashboard/asambleas/[id]/page.tsx`).

---

## 3. Tokens (billetera por gestor)

- **Saldo:** `profiles.tokens_disponibles` (por gestor/usuario).
- **Regla:** 1 token = 1 unidad de vivienda. Costo = número de unidades del conjunto.
- **Consume tokens:** solo **activar la asamblea** (cobro único; `pago_realizado = true`).
- **No consume:** crear asambleas, preguntas, importar unidades, generar acta (tras activar), registrar votos manuales, sandbox.
- **Límites:** si `tokens < unidades`: máx 2 preguntas, sin acta detallada. Si `tokens >= unidades`: 999 preguntas, acta detallada (`lib/plan-limits.ts`).
- **Compra mínima:** 20 tokens (modal "Sin tokens").

---

## 4. Flujos principales

### 4.1 Crear asamblea
- `/dashboard/asambleas/nueva`: nombre, descripción, fecha. No consume tokens.

### 4.2 Activar votación pública
- RPC `activar_votacion_publica`: genera código, `url_publica`, `codigo_acceso`.  
- Consume tokens (si no es demo); marca `pago_realizado`.

### 4.3 Votación pública (`/votar/[codigo]`)
1. `validar_codigo_acceso` → asamblea_id, organization_id.
2. `validar_votante_asamblea`(codigo, email/teléfono) → unidades propias + poderes.
3. `registrar_voto_con_trazabilidad` por cada voto (IP, user-agent).

### 4.4 Registrar voto admin
- API `POST /api/admin/registrar-voto`. No consume tokens.
- Filtro unidades: real → sin demo; sandbox → solo demo.
- Auto-fill: seleccionar torre+unidad rellena email y nombre.

### 4.5 Quórum
- RPC `calcular_quorum_asamblea`: excluye unidades demo en asambleas reales; solo demo en sandbox.
- Quórum alcanzado si coeficiente_votante / coeficiente_total >= 50%.

### 4.6 Acta
- Descarga con resultados, quórum, auditoría (quién votó, IP, user-agent).
- En sandbox: marca "BORRADOR DE PRUEBA — SIN VALIDEZ LEGAL".

---

## 5. Rutas y archivos clave

| Ruta | Archivo |
|------|---------|
| Landing | `app/page.tsx` |
| Login | `app/login/page.tsx` |
| Dashboard | `app/dashboard/page.tsx` |
| Asambleas | `app/dashboard/asambleas/page.tsx` |
| Detalle asamblea | `app/dashboard/asambleas/[id]/page.tsx` |
| Poderes | `app/dashboard/asambleas/[id]/poderes/page.tsx` |
| Unidades | `app/dashboard/unidades/page.tsx` |
| Votación pública | `app/votar/[codigo]/page.tsx` |
| Registro voto API | `app/api/admin/registrar-voto/route.ts` |

---

## 6. Librerías

| Archivo | Uso |
|---------|-----|
| `lib/coeficientes.ts` | `sumaCoeficientesValida()`, `rangoCoeficientesAceptado()`, tolerancia 0.1% |
| `lib/costo-tokens.ts` | `getCostoEnTokens()`, `puedeRealizarOperacion()` |
| `lib/plan-limits.ts` | `getEffectivePlanLimits()`, límites por saldo tokens |
| `lib/create-demo-data.ts` | 10 unidades demo, 2 preguntas abiertas |

---

## 7. Cambios recientes (esta sesión)

- **Registrar voto:** Filtro unidades por `is_demo` (real sin demo; sandbox solo demo).
- **Auto-fill registrar voto:** Campo inicial "Torre y unidad"; al seleccionar rellena email y nombre.
- **Poderes:** Eliminado useEffect duplicado de auto-fill.
- **Asamblea [id]:** Eliminado panel duplicado "Credenciales de Prueba"; responsive en botones; modal guía Quórum/Preguntas/Poderes; SEO y metadatos dinámicos.

---

## 8. Posibles mejoras / pendientes

- **validar_votante_asamblea:** Actualmente no filtra por `is_demo`. En una asamblea real, un votante con `test1@asambleas.online` podría obtener unidades demo. Valorar filtrar unidades por `is_demo = asamblea.is_demo` en ese RPC.
- **calcular_estadisticas_pregunta:** Revisar si excluye unidades demo en asambleas reales (similar al quórum).
