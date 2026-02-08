# Handoff: Refactor UX, Unidades, Sandbox y SEO

Documento para que otro agente (o sesión) continúe el trabajo. **Proyecto:** Votaciones de Asambleas Online (Next.js, Supabase).

---

## 1. Objetivo general

Intervención en la app para:
- Automatización de poderes (auto-fill)
- Mejora del Sandbox (credenciales de prueba)
- Precisión semántica (Abrir/Cerrar **Pregunta**)
- Diseño responsive / mobile-first
- CRUD manual de unidades + barra de coeficientes
- Edición de fecha de asamblea + modal guía
- SEO (metadatos, sitemap, robots, alt, H1/H2/H3)

---

## 2. Lo que YA está hecho (verificar y no duplicar)

### 2.1 Auto-fill en Registro de Poderes
- **Archivo:** `app/dashboard/asambleas/[id]/poderes/page.tsx`
- **Qué hay:** Dos `useEffect` que al seleccionar unidad **otorgante** o **receptora** hacen `supabase.from('unidades').select(...).eq('id', ...).single()` y actualizan:
  - Otorgante: `setSelectedOtorgante` con datos frescos (nombre, email, coeficiente).
  - Receptor: `setEmailReceptor` y `setNombreReceptor`.
- **Nota:** Hay un tercer `useEffect` (líneas ~144–160) que también rellena receptor; podría estar duplicado. Revisar y dejar uno solo si es redundante.

### 2.2 Panel de Credenciales de Prueba (Sandbox)
- **Archivo:** `app/dashboard/asambleas/[id]/page.tsx`
- **Qué hay:** Panel que solo se muestra cuando `isDemo === true`:
  - Tabla con `test1@asambleas.online` … `test10@asambleas.online` y botón Copiar.
  - Ubicación: columna izquierda, después del bloque “Billetera de tokens”.
- **Posible duplicado:** Hay otra sección “Credenciales de Prueba” más abajo (aprox. líneas 1667 y siguientes) dentro de otro bloque. **Revisar** si son dos versiones del mismo panel y eliminar la duplicada, dejando solo la que tiene la tabla con copiar.

### 2.3 Botones “Abrir Pregunta” / “Cerrar Pregunta”
- **Archivo:** `app/dashboard/asambleas/[id]/page.tsx`
- **Qué hay:** En el panel de preguntas de votación:
  - “Abrir Votación” → **“Abrir Pregunta”**
  - “Cerrar Votación” → **“Cerrar Pregunta”**
  - “Reabrir” → **“Reabrir Pregunta”**
  - Texto “• Votación finalizada” → **“• Pregunta cerrada”**
- La palabra “Votación” se reserva para el botón de activar/desactivar votación pública.

### 2.4 Modal “Sin tokens” con cantidad editable
- **Archivo:** `app/dashboard/asambleas/[id]/page.tsx`
- **Qué hay:** Estado `cantidadCompraSinTokens`, `MIN_TOKENS_COMPRA = 20`, input numérico, validación “Mínimo 20 tokens” y botón “Comprar X tokens ahora” que usa esa cantidad.

### 2.5 Unidades: CRUD manual + Sticky bar coeficientes
- **Archivo:** `app/dashboard/unidades/page.tsx`
- **Qué hay:**
  - **Sticky bar** (aprox. líneas 383–398): `totalCoeficientes = unidades.reduce(...)`, `coeficientesCorrecto = sumaCoeficientesValida(totalCoeficientes)`.
  - Si no es 100% (según tolerancia): mensaje “Atención: La suma actual es [X]%. Debe ser 100% …”.
  - **Formulario “Añadir unidad”:** estado `showAddUnidad`, `newUnidad` (torre, numero, coeficiente, tipo, nombre_propietario, email, telefono), `handleAddUnidad` que hace `supabase.from('unidades').insert(...)` con `organization_id` del conjunto seleccionado.
- **Librería de validación:** `lib/coeficientes.ts` — `sumaCoeficientesValida(suma)`, `rangoCoeficientesAceptado()`, `TOLERANCIA_COEFICIENTE_PORCENTAJE = 0.1` (99.9%–100.1%).

### 2.6 Edición de fecha de asamblea
- **Archivo:** `app/dashboard/asambleas/[id]/page.tsx`
- **Qué hay:**
  - Estado y lógica para editar fecha (solo si estado es borrador o activa).
  - Modal “Cambiar fecha” (paso 1) y modal “¿Confirmar cambio de fecha?” (paso 2 — doble confirmación).
  - `handleSaveFecha` que hace `supabase.from('asambleas').update({ fecha: ... }).eq('id', asamblea.id)`.
- **Pendiente de verificar:** Que el botón “Editar fecha” esté oculto o deshabilitado cuando estado sea “finalizada” (o “cerrada” si existe).

### 2.7 SEO base
- **Archivos:**
  - `app/layout.tsx`: `metadata` con title, description, keywords, openGraph.
  - `app/robots.ts`: `allow: '/'`, `disallow: ['/dashboard/', '/api/', '/auth/', '/super-admin/', '/votar/']`, sitemap URL.
  - `app/sitemap.ts`: entradas para `/`, `/login`, `/dashboard` con `lastModified`, `changeFrequency`, `priority`.

---

## 3. Lo que FALTA por hacer (instrucciones para el siguiente agente)

### 3.1 Responsive / mobile-first (botones Archivar, Editar, Finalizar)
- **Objetivo:** En móviles que los botones no se desborden; usar `flex-wrap`, iconos en lugar de texto largo, o menú tipo “kebab” (tres puntos) para acciones secundarias.
- **Dónde mirar:**
  - **Unidades:** `app/dashboard/unidades/page.tsx` — tabla de unidades: botones Editar y Eliminar por fila. Ya son solo iconos (`Edit`, `Trash2`). Revisar que el contenedor use `flex flex-wrap gap-2` y que la tabla tenga `overflow-x-auto`.
  - **Asamblea [id]:** `app/dashboard/asambleas/[id]/page.tsx` — en cada pregunta: botones “Archivar”, “Editar”, “Cerrar Pregunta”, etc. En pantallas pequeñas:
    - Envolver en `flex flex-wrap gap-2`.
    - Opcional: en móvil mostrar solo iconos (con `title` para tooltip) o un dropdown de tres puntos que abra “Editar”, “Archivar”, “Cerrar”.
- **Componentes UI:** En `components/ui` no hay `DropdownMenu`; se puede usar un `Dialog` o un `Popover` con botones, o simplemente iconos + `flex-wrap`.

### 3.2 Onboarding / modal guía en página de asamblea
- **Objetivo:** Replicar el concepto del modal guía de la página de inicio **dentro de la página de la asamblea** (real y Sandbox), explicando brevemente qué hace cada panel: **Quórum**, **Preguntas**, **Poderes**.
- **Dónde:**
  - Ya existe `GuiaTokensModal` en la asamblea (botón “Guía” en el header) — `components/GuiaTokensModal.tsx` habla de tokens y funcionalidades.
  - **Opción A:** Añadir una segunda pestaña o sección dentro de ese mismo modal con “Quórum”, “Preguntas”, “Poderes”.
  - **Opción B:** Crear un componente nuevo, p. ej. `GuiaAsambleaModal.tsx`, con tres bloques (Quórum, Preguntas, Poderes) y un botón “Guía de esta asamblea” o “¿Qué hace cada panel?” que lo abra.
- **Contenido sugerido:** 2–3 líneas por panel (qué es el quórum, para qué sirven las preguntas, qué son los poderes).

### 3.3 SEO avanzado (metadatos dinámicos y estructura)
- **Metadatos por ruta:**
  - En las páginas que lo permitan, exportar `metadata` o `generateMetadata` (Next.js 13+):
    - Landing: `app/page.tsx` — título tipo “Simulador de Votaciones | Asambleas Virtuales”.
    - Login: `app/login/page.tsx`.
    - Dashboard: `app/dashboard/page.tsx` — p. ej. “Centro de Control | Asambleas Online”.
    - Página de asamblea: `app/dashboard/asambleas/[id]/page.tsx` — si es posible, título con el nombre de la asamblea (puede requerir layout o `generateMetadata` con `params`).
  - Usar el `template` del `layout` raíz: `"%s | Asambleas Online"` para que cada página ponga solo su parte.
- **Estructura de encabezados:**
  - Revisar que las páginas principales tengan un único **H1** (título principal) y **H2/H3** lógicos (secciones, tarjetas).
  - Ejemplo: en `app/dashboard/asambleas/[id]/page.tsx` el título de la asamblea debería ser H1; “Preguntas de Votación”, “Quórum y Participación”, “Acceso Público” pueden ser H2.
- **Imágenes:**
  - Buscar todas las `<img>` o componentes que rendericen imagen y asegurar que tengan atributo `alt` descriptivo (p. ej. “Logo Asambleas Online”, “Código QR de votación”).

### 3.4 Comprobaciones finales
- Eliminar **duplicado** del panel “Credenciales de Prueba” en `app/dashboard/asambleas/[id]/page.tsx` si existen dos bloques.
- Revisar **poderes:** dejar un solo `useEffect` de auto-fill por receptor/otorgante si hay lógica duplicada en `app/dashboard/asambleas/[id]/poderes/page.tsx`.
- **Fecha asamblea:** confirmar que en estado “finalizada” (y “cerrada” si aplica) el botón “Editar fecha” no se muestre o esté deshabilitado.

---

## 4. Referencias técnicas rápidas

### 4.1 Rutas principales
- Landing: `app/page.tsx`
- Login: `app/login/page.tsx`
- Dashboard: `app/dashboard/page.tsx`
- Lista asambleas: `app/dashboard/asambleas/page.tsx`
- Detalle asamblea: `app/dashboard/asambleas/[id]/page.tsx`
- Poderes: `app/dashboard/asambleas/[id]/poderes/page.tsx`
- Unidades: `app/dashboard/unidades/page.tsx`
- Importar unidades: `app/dashboard/unidades/importar/page.tsx`

### 4.2 Coeficientes (Ley 675)
- `lib/coeficientes.ts`: `sumaCoeficientesValida(suma)`, `rangoCoeficientesAceptado()`, `TOLERANCIA_COEFICIENTE_PORCENTAJE = 0.1`.

### 4.3 Supabase
- Unidades: `organization_id`, `torre`, `numero`, `coeficiente`, `tipo`, `nombre_propietario`, `email`, `email_propietario`, `telefono`, `is_demo`.
- Asambleas: `fecha` (ISO string), `estado`: `'borrador' | 'activa' | 'finalizada'`.

### 4.4 Demo / Sandbox
- Asamblea demo: `asambleas.is_demo === true`.
- Unidades demo: `unidades.is_demo === true`; correos de prueba `test1@asambleas.online` … `test10@asambleas.online` (definidos en `lib/create-demo-data.ts` y mostrados en el panel de credenciales).

---

## 5. Comando final (cuando todo esté verificado)

```bash
git add .
git commit -m "Refactor: UX improvements, manual unit management, and SEO setup"
git push origin main
```

---

## 6. Resumen de estado por ítem

| # | Ítem | Estado | Notas |
|---|------|--------|--------|
| 1 | Auto-fill Poderes (useEffect al seleccionar unidad) | Hecho | Revisar posible duplicado en useEffects |
| 2 | Panel Credenciales de Prueba (Sandbox) | Hecho | Revisar y quitar bloque duplicado si hay dos |
| 3 | Abrir/Cerrar Pregunta (no “Votación”) | Hecho | |
| 4 | Responsive / mobile (flex-wrap, kebab, iconos) | Pendiente | Unidades + asamblea [id] |
| 5 | CRUD manual unidades + Sticky bar coeficientes | Hecho | |
| 6 | Edición fecha asamblea + doble confirmación | Hecho | Verificar bloqueo en finalizada |
| 6b | Modal guía (Quórum, Preguntas, Poderes) en asamblea | Pendiente | Extender GuiaTokensModal o nuevo modal |
| 7 | SEO (metadatos dinámicos, sitemap, robots, alt, H1–H3) | Parcial | robots + sitemap + layout; faltan por-ruta y estructura |

Con esta información otro agente puede retomar el refactor sin perder contexto.
