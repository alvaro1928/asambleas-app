# Funcionalidades de la aplicación y validación de capacidad (500+ usuarios)

---

## 1. Resumen de funcionalidades

### Autenticación
- Login con **email + contraseña**.
- Login con **Magic Link** (enlace por correo).
- **Entrar con Google** (OAuth).
- **Restablecer contraseña** (enlace por correo → `/auth/restablecer`).
- **Cerrar sesión** (vía API para no romper Google).
- Cambio de contraseña en **Dashboard → Configuración**.

### Multi-conjunto (multi-tenant)
- Un usuario puede tener **varios conjuntos** (organizations).
- **Selector de conjunto** en el dashboard para cambiar de conjunto activo.
- **Registro de nuevo conjunto** (`/dashboard/nuevo-conjunto`).
- **Edición de conjunto** (`/dashboard/conjuntos/[id]/editar`).
- **Listado de conjuntos** (`/dashboard/conjuntos`).

### Unidades
- **Listado de unidades** por conjunto (`/dashboard/unidades`) con búsqueda y filtro por torre.
- **Importación masiva** desde Excel/CSV (`/dashboard/unidades/importar`) con validación de coeficientes (suma 100%) y torre/unidad única.
- Métricas en dashboard: total unidades, suma coeficientes, censo.

### Asambleas y votaciones
- **Listado de asambleas** (`/dashboard/asambleas`).
- **Crear asamblea** (`/dashboard/asambleas/nueva`).
- **Detalle de asamblea** (`/dashboard/asambleas/[id]`):
  - Agregar/editar **preguntas** y **opciones**.
  - Tipos: coeficiente o nominal.
  - Estados: pendiente, abierta, cerrada.
  - Activar/desactivar votación pública (genera código de acceso).
- **Acceso público** (`/dashboard/asambleas/[id]/acceso`): código, QR, enlace para votantes.
- **Poderes** (`/dashboard/asambleas/[id]/poderes`): asignar apoderados por unidad; importación masiva de poderes.
- **Acta** (`/dashboard/asambleas/[id]/acta`): descarga/impresión con resultados por pregunta, quórum y **detalle de auditoría** (quién votó, cuándo, IP, dispositivo).

### Votación pública (votantes)
- **Entrada por código** (`/votar/[codigo]`): validación por email/teléfono, listado de unidades (propias + poderes), votación por pregunta.
- Trazabilidad: **historial_votos** con IP y user_agent (API `/api/client-info`).
- Estadísticas y quórum en tiempo real.

### Dashboard principal
- Métricas: conjuntos, unidades, coeficientes, censo.
- Gráfico de distribución por tipo de unidad.
- Enlaces rápidos a asambleas, unidades, conjuntos, configuración.

---

## 2. Cómo validar capacidad con 500+ usuarios

### 2.1 Objetivo
Comprobar que la app aguanta **más de 500 usuarios** (votantes y/o administradores) en escenarios reales: login simultáneo, muchas votaciones a la vez, listados grandes, etc.

### 2.2 Herramientas de prueba de carga

- **k6 (Grafana)** – recomendado  
  - Scripts en JavaScript; métricas claras (RPS, latencia, errores).  
  - Ejemplo mínimo: muchos usuarios virtuales que hagan login, carguen `/dashboard`, carguen `/votar/[codigo]`, envíen un voto.  
  - Ejecución: `k6 run script.js` (local o en la nube).

- **Artillery**  
  - Configuración YAML; bueno para HTTP y flujos por escenarios.

- **Apache JMeter**  
  - Interfaz gráfica; más pesado, útil para pruebas muy detalladas.

- **Vercel**  
  - Límites del plan (ancho de banda, invocaciones). Con 500+ usuarios concurrentes puede hacer falta plan Pro o Enterprise.

- **Supabase**  
  - Límites del plan (conexiones, ancho de banda, filas). Revisar dashboard y docs de límites según plan (Free/Pro).

### 2.3 Qué medir

1. **Autenticación**
   - Login (contraseña y Magic Link): tiempo de respuesta y % de error con 50–100–500 usuarios virtuales en 1–2 minutos.
   - Google OAuth: idem (callback `/auth/callback/oauth`).

2. **Dashboard**
   - Carga de `/dashboard` y de listados (asambleas, unidades, conjuntos) con muchos registros (ej. 100+ asambleas, 500+ unidades).

3. **Votación**
   - Carga de `/votar/[codigo]` (validación de código + email, listado de preguntas).
   - Envío de votos: muchas peticiones simultáneas a `registrar_voto_con_trazabilidad` (y a `/api/client-info` si se usa).

4. **Acta**
   - Generación del acta (página + posible export PDF) con muchas preguntas y muchos votos en `historial_votos`.

### 2.4 Ejemplo de script k6 (esqueleto)

```javascript
// script-load-test.js (ejemplo mínimo)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // subir a 50 usuarios
    { duration: '2m', target: 200 },   // subir a 200
    { duration: '2m', target: 500 },   // subir a 500
    { duration: '2m', target: 500 },   // mantener 500
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% de peticiones < 5s
    http_req_failed: ['rate<0.01'],     // menos del 1% de error
  },
};

const BASE = 'https://tu-dominio.vercel.app';

export default function () {
  let res = http.get(`${BASE}/login`);
  check(res, { 'login page ok': (r) => r.status === 200 });
  sleep(1);
  // Añadir aquí: POST login, GET /dashboard, GET /votar/CODIGO, etc.
}
```

Ejecución: `k6 run script-load-test.js`.

### 2.5 Ajustes recomendados para 500+ usuarios

- **Vercel:** Plan que soporte el tráfico esperado (Pro o superior si hay picos altos).
- **Supabase:** Plan Pro o superior si hay muchas conexiones simultáneas o mucho volumen de lecturas/escrituras (votos, historial).
- **Caché:** Donde sea posible, cachear respuestas de solo lectura (listados, estadísticas) con `revalidate` o ISR en Next.js.
- **Índices en BD:** Asegurar índices en tablas críticas (votos, historial_votos, preguntas, unidades, asambleas) para consultas por `asamblea_id`, `pregunta_id`, `votante_email`, etc.
- **Rate limiting:** En APIs sensibles (login, votar) para evitar abusos y picos artificiales.

### 2.6 Checklist de validación

- [ ] Probar login (contraseña + Magic Link) con 100–500 usuarios virtuales.
- [ ] Probar Google OAuth con al menos 50–100 usuarios virtuales.
- [ ] Probar carga de dashboard y listados con conjuntos que tengan 100+ asambleas y 500+ unidades.
- [ ] Probar votación: 200–500 votos en ventana corta (ej. 2–5 min) en una misma asamblea.
- [ ] Revisar límites y uso en Vercel y Supabase durante las pruebas.
- [ ] Definir umbrales aceptables (ej. p95 < 3s, tasa de error < 0,5%) y documentarlos.

---

## 3. Documentos relacionados

- **Autenticación:** `AUTH-RESUMEN-COMPLETO.md`
- **Plantillas de email:** [docs/supabase/PLANTILLAS-EMAIL-SUPABASE.md](../supabase/PLANTILLAS-EMAIL-SUPABASE.md)
- **Despliegue:** `DEPLOYMENT-GUIDE.md`, `LISTO-PARA-DEPLOY.md`
- **Votaciones y códigos:** `GUIA-CODIGOS-ACCESO-VOTACION.md`, `GUIA-SISTEMA-VOTACION-PUBLICA.md`
- **Auditoría:** [docs/supabase/AUDITORIA-Y-BLOCKCHAIN.md](../supabase/AUDITORIA-Y-BLOCKCHAIN.md)
