# Pruebas, optimización y ideas de mejora

Resumen de estado de pruebas, optimizaciones aplicadas e ideas concretas para mejorar funcionalidad y usabilidad.

---

## 1. Estado de pruebas y build

| Comando        | Resultado | Nota |
|----------------|-----------|------|
| `npm run lint` | ✅ Pasa   | Sin warnings ni errores de ESLint. |
| `npm run test:run` | ⚠️ EPERM en sandbox | Vitest falla con `spawn EPERM` en el entorno de Cursor; ejecutar localmente: `npm run test:run`. |
| `npm run build` | ⚠️ EPERM en sandbox | Next.js falla al crear workers por restricciones del sandbox; ejecutar localmente: `npm run build`. |

**Recomendación:** Ejecutar en tu máquina:

```bash
npm run lint
npm run test:run
npm run build
```

---

## 2. Optimizaciones aplicadas

### ToastProvider – limpieza de timeouts

- **Problema:** Los `setTimeout` que ocultan toasts no se cancelaban al cerrar un toast manualmente ni al desmontar el provider, pudiendo causar actualizaciones de estado en componentes desmontados y fugas menores.
- **Cambio:** Se guardan los IDs de los timeouts en un `useRef` (Map). Al cerrar un toast se hace `clearTimeout` y se elimina del Map. En el `useEffect` de limpieza del provider se cancelan todos los timeouts y se vacía el Map.
- **Archivo:** `components/providers/ToastProvider.tsx`

### Eliminación de logs de depuración en producción

- **Problema:** `console.log` / `console.warn` de depuración en la página de votación, login y detalle de asamblea ensucian la consola y pueden afectar rendimiento en producción.
- **Cambio:** Se eliminaron los logs de depuración (emojis tipo 📋, 📊, ✅, etc.) en:
  - `app/votar/[codigo]/page.tsx` – carga de preguntas, votos, estadísticas e historial.
  - `app/login/page.tsx` – Magic Link.
  - `app/dashboard/asambleas/[id]/page.tsx` – estadísticas y RPC.
- Se mantienen los `console.error` para errores reales y trazabilidad en desarrollo/producción.

---

## 3. Ideas de mejora por área

Cada idea incluye **qué** mejorar y **cómo** implementarlo de forma concreta.

---

### 3.1 Votación pública (`/votar/[codigo]`)

| Mejora | Qué hacer | Cómo |
|--------|------------|------|
| **Indicador de pasos** | Dejar claro en qué etapa está el votante. | Componente tipo stepper arriba del contenido: "1. Código → 2. Email → 3. Unidades → 4. Votar". Marcar el paso actual y los completados con íconos/colores. |
| **Pantalla de éxito al terminar** | Refuerzo positivo al completar todos los votos. | Cuando todas las unidades hayan votado en todas las preguntas abiertas, mostrar una vista "Gracias, tu participación quedó registrada" con botón "Ver historial" en lugar de solo el mensaje inline. |
| **Recordar email por código** | Evitar repetir email si se vuelve a entrar con el mismo código. | Guardar en `localStorage` la clave `votar_email_${codigo}` con el email (opcionalmente hasheado). En `validarCodigo` si hay valor y el código es el mismo, pre-rellenar el campo y permitir "Continuar" directo. |
| **Mensajes de error amigables** | Menos mensajes técnicos, más guía. | Mapear errores conocidos (ej. "no se encontraron unidades") a textos tipo: "Este correo o teléfono no está asociado a ninguna unidad en esta asamblea. Revisa el dato o contacta al administrador." Usar un pequeño map `errorCode → mensaje` y `toast.error(mensaje)`. |
| **Carga de opciones en lote** | Menos round-trips en preguntas con muchas opciones. | En lugar de un `for` con una query por pregunta para `opciones_pregunta`, hacer una sola query: `opciones_pregunta` donde `pregunta_id in (ids de preguntas)` y agrupar en memoria por `pregunta_id`. |

---

### 3.2 Dashboard (administrador)

| Mejora | Qué hacer | Cómo |
|--------|------------|------|
| **Breadcrumbs** | Contexto y navegación rápida. | En layout o en cada página del dashboard, componente `Breadcrumbs` que lea la ruta (ej. `/dashboard/asambleas/123`) y muestre "Dashboard > Asambleas > [Nombre]". El nombre de asamblea puede venir de React Context o de un fetch ligero en la página. |
| **Confirmaciones destructivas** | Evitar borrados por error. | Para "Eliminar pregunta", "Revocar poder", "Eliminar unidad" usar siempre el mismo patrón: modal con título "¿Eliminar X?", mensaje breve, botón secundario "Cancelar" y botón rojo "Eliminar". Reutilizar el mismo componente de diálogo. |
| **Indicador de progreso en asamblea** | Saber cuántas preguntas están abiertas/pendientes. | En la tarjeta de cada asamblea en la lista (o en el detalle), mostrar por ejemplo "3 de 5 preguntas abiertas" o "2 pendientes de abrir". Calcular a partir de los estados de `preguntas` ya cargadas. |
| **Búsqueda/filtro en listas** | Encontrar asambleas o unidades rápido. | En la lista de asambleas: input de búsqueda por nombre y filtro por estado (borrador/activa/finalizada). Filtrar en cliente si la lista es pequeña; si crece, pasar parámetros a la API. En unidades ya hay búsqueda; revisar que sea accesible y estable. |
| **Guardado sin perder datos** | Avisar si hay cambios sin guardar. | En modales de "Nueva pregunta" / "Editar pregunta" usar un estado `dirty` (comparar valores actuales vs iniciales). Al intentar cerrar o salir, si `dirty` mostrar diálogo "Hay cambios sin guardar. ¿Salir?" con Cancelar / Salir. |

---

### 3.3 Super-admin

| Mejora | Qué hacer | Cómo |
|--------|------------|------|
| **Toasts de éxito al guardar** | Confirmar que los cambios se aplicaron. | Tras PATCH exitoso de plan o "Aplicar plan", llamar `toast.success('Plan actualizado')` o `toast.success('Plan aplicado al conjunto')`. Ya se usa toast para errores; añadir el éxito. |
| **Resumen en dashboard** | Vista rápida del negocio. | Arriba de la tabla: tarjetas con "Total conjuntos", "Por plan (Free / Pro / Pilot)", opcionalmente "Ingresos del mes" si tienes datos de pagos. Usar los mismos datos que la tabla (o un endpoint resumido) para no duplicar lógica. |
| **Exportar conjuntos a CSV** | Permitir análisis externo. | Botón "Exportar CSV": construir un array de objetos `{ nombre, plan, estado, ... }` desde los datos ya cargados y descargar con un blob + enlace temporal o librería tipo `papaparse` (ya en el proyecto). |
| **Paginación o "Cargar más"** | Si hay muchos conjuntos. | Si la lista supera por ejemplo 50, mostrar solo los primeros N y un botón "Cargar más" que pida el siguiente bloque (offset/limit o cursor) y concatene al estado. Opcional: indicador "Mostrando X de Y". |

---

### 3.4 Transversal

| Mejora | Qué hacer | Cómo |
|--------|------------|------|
| **Estados de carga unificados** | Misma sensación en toda la app. | Crear un componente `LoadingSpinner` o `PageSkeleton` (por ejemplo en `components/ui/`) y usarlo en todas las pantallas que esperan datos (votar, dashboard, super-admin). Misma altura y estilo que el contenido que reemplaza cuando sea posible. |
| **Página 404 amigable** | No dejar al usuario en blanco. | Añadir `app/not-found.tsx` con mensaje "Página no encontrada", enlace a "/" y a "/dashboard" (si aplica), y estilo coherente con el resto de la app. |
| **Sesión y deslogueo** | Menos sorpresas por sesión expirada. | En el cliente, escuchar el evento de Supabase `onAuthStateChange`; si la sesión se invalida o expira, mostrar un toast "Tu sesión expiró" y redirigir a `/login`. Opcional: renovar token en segundo plano antes de que expire (Supabase lo hace en parte; revisar duración en Dashboard). |
| **Middleware y rutas públicas** | Evitar redirecciones incorrectas. | El middleware ya protege `/dashboard` y `/super-admin`. Confirmar que `/votar/*` y `/login` no exigen sesión y que las rutas de API públicas (votar, client-info, etc.) están fuera del matcher que exige sesión. |

---

## 4. Orden sugerido para implementar

1. **Indicador de pasos en votación** + **Pantalla de éxito** – Mayor impacto directo para el votante.
2. **Breadcrumbs en dashboard** – Mejora rápida de contexto para el administrador.
3. **Confirmaciones destructivas** – Revisar y unificar en todas las acciones de eliminar/revocar.
4. **Recordar email (localStorage)** y **mensajes de error amigables** en votación.
5. **Carga de opciones en lote** en votación – Mejora de rendimiento.
6. **Resumen y export CSV en super-admin** – Valor operativo sin tocar flujos críticos.
7. **404, estados de carga y sesión** – Pulido transversal.

---

## 5. Resumen de archivos tocados en esta pasada

- `components/providers/ToastProvider.tsx` – Limpieza de timeouts.
- `app/votar/[codigo]/page.tsx` – Eliminación de logs de depuración.
- `app/login/page.tsx` – Eliminación de logs de depuración.
- `app/dashboard/asambleas/[id]/page.tsx` – Eliminación de logs de depuración.

Si quieres, el siguiente paso puede ser implementar el **indicador de pasos** y la **pantalla de éxito** en la votación pública; son los que más mejoran el journey del votante.
