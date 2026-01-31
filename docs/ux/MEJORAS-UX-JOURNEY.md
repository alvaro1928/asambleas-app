# Mejoras de experiencia (journey) por rol

Propuestas para que **administrador**, **votantes** y **super usuario** tengan la mejor experiencia posible.

---

## 1. Administrador (dashboard)

### Ya implementado
- Tooltips en botones y enlaces
- Mensajes de éxito en verde (ej. "Asamblea creada")
- Selector de conjunto en header
- Límites de planes parametrizables
- Registrar voto a nombre de un residente

### Mejoras sugeridas

| Mejora | Impacto | Descripción |
|--------|---------|-------------|
| **Breadcrumbs** | Alto | "Dashboard > Asambleas > [Nombre asamblea]" para saber dónde está y volver rápido |
| **Toasts en lugar de alert()** | Alto | Notificaciones no bloqueantes (éxito/error) que desaparecen solas; el usuario sigue trabajando |
| **Confirmación antes de eliminar** | Alto | Diálogo "¿Eliminar pregunta X?" con botón rojo; ya existe en preguntas, extender a poderes/unidades |
| **Estados vacíos claros** | Medio | Si no hay asambleas: ilustración + "Crea tu primera asamblea" + botón destacado (ya parcialmente) |
| **Indicador de progreso** | Medio | Ej. "3 de 5 preguntas abiertas" o "2 preguntas pendientes de abrir" en la tarjeta de la asamblea |
| **Búsqueda / filtro en listas** | Medio | En Asambleas: por nombre o estado; en Unidades: ya hay búsqueda |
| **Guardado automático o "¿Salir sin guardar?"** | Medio | En formularios largos (nueva pregunta, editar pregunta) avisar si hay cambios sin guardar |
| **Atajos de teclado** | Bajo | Ej. Ctrl+S para guardar en modales |
| **Paginación** | Bajo | Si hay muchas asambleas o unidades, paginar o "Cargar más" |

---

## 2. Votantes (página pública `/votar/[codigo]`)

### Ya implementado
- Validación de código y email
- Resumen de unidades (propias + poderes)
- Progreso "X/Y unidades votadas" por pregunta
- Mensaje "Has votado con todas tus unidades"
- Historial de votos
- Tooltips en botones

### Mejoras sugeridas

| Mejora | Impacto | Descripción |
|--------|---------|-------------|
| **Indicador de pasos** | Alto | Mostrar "Paso 1: Email → Paso 2: Unidades → Paso 3: Votar" para que sepan en qué etapa están |
| **Toasts en lugar de alert()** | Alto | Al registrar voto: "Voto registrado" en toast; errores también en toast, no en alert |
| **Pantalla de éxito al votar** | Alto | Tras votar en todas las unidades: mensaje claro "Gracias, tu participación quedó registrada" + opción "Ver historial" |
| **Mensajes de error amigables** | Medio | Ej. "Este correo no está asociado a ninguna unidad" en lugar de mensaje técnico |
| **Recordar email en sesión** | Medio | Si vuelve a entrar con el mismo código, no obligar a escribir el email de nuevo (localStorage o sesión) |
| **Diseño móvil primero** | Medio | Botones grandes, texto legible, menos scroll en móvil |
| **Accesibilidad** | Medio | Labels en inputs, focus visible, contraste suficiente |
| **Resumen antes de enviar** | Bajo | Opcional: "Vas a votar: Unidad A → A favor; Unidad B → En contra. ¿Confirmar?" |

---

## 3. Super usuario (super-admin)

### Ya implementado
- Filtros por nombre y por plan
- Tabla de planes con "Qué cubre" y límites editables
- Contador "X de Y" conjuntos
- Tooltips en botones

### Mejoras sugeridas

| Mejora | Impacto | Descripción |
|--------|---------|-------------|
| **Toasts en lugar de alert()** | Alto | Al guardar plan o aplicar plan: éxito/error en toast |
| **Resumen en dashboard** | Medio | Tarjetas: total conjuntos, por plan (free/pro/pilot), ingresos del mes |
| **Exportar lista de conjuntos** | Medio | Botón "Exportar CSV" con nombre, plan, estado |
| **Paginación de conjuntos** | Bajo | Si hay muchos conjuntos, paginar o "Cargar más" |
| **Búsqueda global** | Bajo | Buscar conjunto por nombre sin filtrar solo en tabla |

---

## 4. Transversal

| Mejora | Impacto | Descripción |
|--------|---------|-------------|
| **Toasts globales** | Alto | Un solo sistema de notificaciones (éxito, error, info) que sustituya a `alert()` en toda la app |
| **Estados de carga consistentes** | Medio | Mismo estilo de spinner o skeleton en todas las pantallas |
| **Páginas 404 amigables** | Bajo | "Página no encontrada" con enlace a Dashboard o Inicio |
| **Mantenimiento de sesión** | Medio | Evitar deslogueos inesperados; renovar token o avisar "Tu sesión expiró" |

---

## Orden sugerido de implementación

1. **Toasts** – Sustituir `alert()` por toasts en flujos críticos (votar, guardar plan, registrar voto admin, login).
2. **Indicador de pasos (votantes)** – Dejar claro el flujo: email → unidades → votar.
3. **Breadcrumbs (admin)** – En detalle de asamblea y en páginas internas del dashboard.
4. **Confirmaciones** – Revisar que todas las acciones destructivas (eliminar pregunta, revocar poder, etc.) tengan diálogo de confirmación.
5. **Mensajes de error amigables** – Especialmente en login y en votación pública.
