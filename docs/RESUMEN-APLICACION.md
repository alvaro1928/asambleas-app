# Resumen de la aplicación: funcional y técnico

Resumen de todo lo que tiene la aplicación **Asambleas App** desde el punto de vista funcional (qué hace cada rol) y técnico (stack, rutas, APIs, librerías).

---

## 1. Resumen funcional por rol

### 1.1 Administrador (dashboard)

**Autenticación**
- Login con **email + contraseña**, **Magic Link** (enlace por correo) o **Google OAuth**.
- Restablecer contraseña por correo; cambio de contraseña en Configuración.
- Cerrar sesión (API para no romper cookies de Google).

**Multi-conjunto (multi-tenant)**
- Un usuario puede tener **varios conjuntos** (organizations).
- **Selector de conjunto** en el header para cambiar de conjunto activo.
- **Listado de conjuntos** (`/dashboard/conjuntos`).
- **Nuevo conjunto** (`/dashboard/nuevo-conjunto`).
- **Editar conjunto** (`/dashboard/conjuntos/[id]/editar`): nombre, NIT, dirección, ciudad.

**Unidades**
- **Listado de unidades** (`/dashboard/unidades`) con búsqueda y filtro por torre.
- **Importación masiva** desde Excel/CSV (`/dashboard/unidades/importar`) con validación de coeficientes (suma 100%) y torre/unidad única.
- Editar y eliminar unidades.
- **Notificar vía WhatsApp**: selección por checkbox y botón para enviar enlace de votación por Meta API. Se descuentan tokens (configurable en Super Admin → WhatsApp). Delay 300 ms entre mensajes.
- Métricas en dashboard: total unidades, suma coeficientes, censo, distribución por tipo.

**Asamblea de pruebas (sandbox)**
- **Acceso:** En la cabecera del listado de asambleas (`/dashboard/asambleas`, botón "Probar en entorno de pruebas") o con la URL `/dashboard/asambleas?demo=1` (se abre el modal automáticamente).
- **Qué hace:** Crea una asamblea de demostración con datos de ejemplo (10 unidades, 2 preguntas, votación ya activada). **No consume tokens.** Incluye las mismas funcionalidades y diseño que una asamblea real: verificación de asistencia, acceso de asistente delegado, secciones colapsables en Acceso Público y en la página de Acceso, y panel Quórum y Participación con tarjeta de asistencia verificada (incluso sin preguntas abiertas).
- **Modos:** En la página de la asamblea demo puedes elegir **Unidades de demostración (10)** (cuentas test1@…test10@asambleas.online) o **Unidades reales del conjunto**. En sandbox está habilitada la **gestión de unidades**: el enlace "Gestionar unidades del conjunto" lleva a `/dashboard/unidades` para editar unidades reales (útil cuando pruebas con unidades reales).
- **Restricciones:** En asambleas y unidades marcadas como demo no se pueden editar ni eliminar las unidades de demostración; el acta lleva la marca "DEMO - SIN VALIDEZ LEGAL". En reportes globales se excluyen las asambleas demo. La verificación de quórum y el acceso delegado funcionan igual en sandbox.

**Asambleas**
- **Listado de asambleas** (`/dashboard/asambleas`).
- **Crear asamblea** (`/dashboard/asambleas/nueva`): nombre, descripción, fecha.
- **Detalle de asamblea** (`/dashboard/asambleas/[id]`):
  - Agregar, editar y eliminar **preguntas** y **opciones** (tipos: coeficiente o nominal; estados: pendiente, abierta, cerrada).
  - Umbral de aprobación por pregunta.
  - Activar/desactivar **votación pública** (genera código de acceso y URL).
  - En la sección **Acceso Público**, botones de **Verificación de quórum**: **Activar/Desactivar verificación** y **Registrar asistencia** (enlace a la página de acceso para el modal de registro manual); se muestra el resumen de asistencia verificada y si se alcanzó quórum (Ley 675).
  - Ver **quórum** (unidades que votaron, coeficiente, porcentaje nominal/coeficiente).
  - Ver estadísticas por pregunta (votos por opción, porcentajes).
  - **Registrar voto a nombre de un residente** (admin): selección de unidad, email y votos por pregunta abierta.
  - Copiar código y enlace; enlace a pantalla de acceso/QR.
- **Control de acceso y QR** (`/dashboard/asambleas/[id]/acceso`):
  - Código QR y URL para que los votantes entren a `/votar/[codigo]`.
  - **Verificación de quórum (asistencia):** botón **Activar verificación**; al activarlo, en la página de votación aparece un popup para que cada votante confirme "Verifico asistencia". Botón **Registrar asistencia** para marcar manualmente una o varias unidades como presentes. Al desactivar la verificación se resetean todas las confirmaciones (al reactivar, todos deben verificar de nuevo). Cuando la verificación está activa, los paneles de la página de acceso muestran **Ya verificaron asistencia** y **Faltan por verificar** (en lugar de Sesión Activa / Ya Votaron / Pendientes).
  - **Acceso de asistente delegado:** el administrador puede **Generar enlace** para dar a una persona de confianza; ese enlace (`/asistir/[codigo]?t=token`) permite registrar asistencia y votos en nombre de unidades. Todas las acciones quedan registradas como "registrado por asistente delegado". Se puede revocar el token en cualquier momento.
  - **Registro de ingresos en tiempo real** (sesiones activas con actividad reciente).
  - **Avance de votaciones**: quórum (unidades que ya votaron) y progreso por pregunta abierta; se actualiza cada 10 s.
- **Envío de correo:** Botón "Enviar enlace por correo" envía por **SMTP** desde el servidor (sin Outlook). Configurable en Super Admin → Ajustes o por variables. Plantilla adicional en Configuración → Poderes y correo.
- **Poderes** (`/dashboard/asambleas/[id]/poderes`):
  - Asignar apoderados por unidad (quién otorga, email y nombre del apoderado).
  - Límite máximo de poderes por apoderado **configurable** en Dashboard → Configuración → Poderes y correo; validación antes de crear.
  - Revocar poder (con diálogo de confirmación).
  - **Importación masiva** de poderes desde Excel/CSV (`/dashboard/asambleas/[id]/poderes/importar`).
- **Acta** (`/dashboard/asambleas/[id]/acta`): descarga/impresión con resultados por pregunta, quórum y **detalle de auditoría** (quién votó, cuándo, IP, user-agent).

**Dashboard principal**
- Métricas: conjuntos, unidades, coeficientes, censo.
- Enlaces rápidos a asambleas, unidades, conjuntos, configuración, y **Probar en sandbox** (asamblea de demostración sin consumir tokens).
- **Billetera de tokens por gestor:** el saldo (`tokens_disponibles`) está en el perfil del usuario (gestor), no por conjunto. **1 token = 1 unidad de vivienda.** Solo se consumen tokens **al activar una asamblea** (cobro único); después se puede generar el acta y registrar votos sin nuevo cobro. Si el gestor no tiene suficientes tokens al intentar activar, se muestra CTA para comprar más. Los nuevos gestores reciben un bono de bienvenida (ej. 50 tokens). Enlaces a pago/contacto en Super Admin → Ajustes.

**Configuración** (`/dashboard/configuracion`)
- **Mi perfil**, **Contraseña**, **Datos del conjunto**, **Poderes y correo**, **Mis pagos**, **Uso de tokens**.
- **Poderes y correo:** Máx. poderes por apoderado (parametrizable) y plantilla adicional para correos de votación (ej. enlace Teams/Meet).
- **Uso de tokens:** Tabla con historial de operaciones que consumieron tokens (fecha/hora, tipo, tokens usados, saldo restante, detalle). Incluye Votación, Acta, Registro manual, Compra, Ajuste manual, WhatsApp.

---

### 1.2 Votantes (página pública)

**Votación pública** (`/votar/[codigo]`)
- **Paso 1:** Validación del código de acceso (RPC `validar_codigo_acceso`).
- **Paso 2:** Ingreso de **email o teléfono**; validación con RPC `validar_votante_asamblea`; listado de **unidades** (propias + poderes).
- **Paso 3:** **Votación** por cada pregunta abierta: una opción por unidad (propias y poderes).
- **Indicador de pasos** (StepIndicator): Código → Email → Unidades → Votar.
- Progreso "X/Y unidades votadas" por pregunta.
- Mensaje al completar todas las votaciones; **historial** de preguntas cerradas con resultados y votos del votante.
- **Trazabilidad**: IP y user-agent vía `/api/client-info`; RPC `registrar_voto_con_trazabilidad`.
- Heartbeat cada 2 min y marcar salida al abandonar (quorum_asamblea, registro de ingresos).
- Toasts para éxito/error (no `alert()`).
- Diseño responsive; soporte modo oscuro.

---

### 1.3 Super usuario (super-admin)

**Acceso**
- Solo el usuario cuyo email coincida con **`NEXT_PUBLIC_ADMIN_EMAIL`** (o tabla `app_config.super_admin_email` con RLS).
- Ruta protegida: `/super-admin`.

**Funcionalidad**
- **Tabla de conjuntos (cuentas):** listado; los **tokens** están en **profiles** (billetera por gestor), no por conjunto. El super admin puede gestionar planes y precios.
- **Tabla de planes:** edición de nombre, **precio por token (COP)** (`precio_por_asamblea_cop`), etc.; botón Guardar por plan. El webhook acredita tokens en el perfil del gestor cuando la referencia es `REF_<user_id>_<timestamp>`.
- **Ajustes** (`/super-admin/ajustes`): color principal, WhatsApp, precio por token, bono de bienvenida. **Correo (SMTP):** host, puerto, usuario, contraseña para envío de enlace de votación.
- **WhatsApp** (`/super-admin/whatsapp`): Token Meta, Phone Number ID, nombre de plantilla, tokens por mensaje. Meta cobra por mensaje marketing; se configura tokens_por_mensaje para no perder dinero.
- **Exportar lista** de conjuntos (CSV).
- Filtros por nombre de conjunto.
- Toasts para éxito/error al guardar.

---

## 2. Resumen técnico

### 2.0 Modelo de negocio: Billetera de Tokens por Gestor

- **Saldo:** `profiles.tokens_disponibles` (por usuario/gestor). El gestor usa su billetera en todos sus conjuntos. El saldo mostrado es el **máximo** entre todas las filas de perfil del mismo usuario (billetera única).
- **Equivalencia:** **1 token = 1 unidad de vivienda.** El costo al activar una asamblea = número de unidades del conjunto.
- **Operaciones que consumen tokens:** **activar la asamblea** (cobro único; se marca `pago_realizado = true`; después acta y votos sin nuevo cobro), **descargar acta** y **enviar WhatsApp** (configurable tokens/mensaje en Super Admin). Las asambleas con `is_demo = true` no consumen tokens.
- **Regalo de bienvenida:** cada nuevo gestor recibe un bono configurado (ej. 50 tokens) al registrarse (trigger o default en `profiles`).
- **Compra:** la pasarela Wompi; el webhook acredita tokens en `profiles` del gestor según el pago aprobado.

### 2.1 Stack

| Capa | Tecnología |
|------|------------|
| Framework | **Next.js 14** (App Router) |
| UI | **React 18**, **Tailwind CSS**, **Lucide React** (iconos) |
| Base de datos y auth | **Supabase** (PostgreSQL, Auth, RLS) |
| Cliente Supabase | `@supabase/ssr` (cookies), `@supabase/supabase-js` (browser) |
| Gráficos | **Recharts** |
| Importación/exportación | **xlsx**, **papaparse** (CSV) |
| QR | **qrcode.react** |
| Utilidades | **class-variance-authority**, **clsx**, **tailwind-merge** |
| Tests | **Vitest**, **@testing-library/react** |
| Linting | **ESLint** (next lint) |

### 2.2 Estructura de la aplicación

```
app/
├── layout.tsx              # ToastProvider global
├── page.tsx                # Landing / inicio
├── politica-privacidad/    # Política de privacidad (Meta, tratamiento de datos)
├── epbco/                  # Página EPBCO Solutions (empresa, producto, contacto)
├── not-found.tsx           # 404 amigable
├── globals.css             # Variables CSS (paleta psicología/marketing)
├── login/page.tsx          # Login (contraseña, Magic Link, Google)
├── auth/
│   ├── callback/           # Callback OAuth y Magic Link
│   └── restablecer/        # Restablecer contraseña
├── api/
│   ├── auth/set-session/   # Establecer sesión (cookies)
│   ├── auth/signout/       # Cerrar sesión
│   ├── client-info/        # IP del cliente (trazabilidad votación)
│   ├── marcar-salida-quorum/  # Marcar salida al abandonar votación
│   ├── ping-quorum/       # Heartbeat sesión activa
│   ├── votar/              # Proxy/registro voto (opcional)
│   ├── admin/registrar-voto/ # Registrar voto desde admin
│   ├── dashboard/
│   │   ├── uso-tokens/     # GET historial uso tokens (billing_logs)
│   │   └── enviar-whatsapp-votacion/  # POST envío masivo WhatsApp (descuenta tokens)
│   ├── planes/             # GET planes (público)
│   ├── pagos/webhook/      # Webhook Wompi (pagos)
│   └── super-admin/
│       ├── conjuntos/      # GET/PATCH conjuntos (plan, tokens)
│       ├── planes/         # GET/PATCH planes (límites, precio, tokens_iniciales, vigencia_meses)
│       ├── configuracion-landing/  # GET/PATCH color, WhatsApp (Ajustes)
│       ├── configuracion-whatsapp/ # GET/PATCH Meta API (token, plantilla, tokens/mensaje)
│       └── carga-masiva-piloto/   # POST carga masiva plan Piloto
├── dashboard/              # Todas las rutas protegidas por sesión
│   ├── page.tsx            # Dashboard principal
│   ├── configuracion/
│   ├── conjuntos/, nuevo-conjunto/
│   ├── unidades/, unidades/importar/
│   └── asambleas/
│       ├── page.tsx, nueva/
│       └── [id]/            # Detalle, acceso, acta, poderes, poderes/importar
├── super-admin/page.tsx    # Super admin (protegido por email)
└── votar/[codigo]/page.tsx # Votación pública (sin sesión)
```

### 2.3 Middleware

- **Supabase** con cookies (get/set/remove) para sesión.
- **Refresco de sesión** en cada request.
- **Protección**: `/dashboard` y `/super-admin` exigen sesión; redirección a `/login` con `?redirect=...`.
- **Login**: si ya hay sesión, redirección a `/dashboard`.
- **Excluye**: `_next/static`, `_next/image`, `favicon.ico`, `auth`, assets (svg, png, etc.).

### 2.4 Librerías (`lib/`)

| Archivo | Uso |
|---------|-----|
| `supabase.ts` | Cliente browser (createBrowserClient). |
| `auth.ts` | Helpers de autenticación. |
| `conjuntos.ts` | `getSelectedConjuntoId`, persistencia en localStorage. |
| `plan-utils.ts` | `planEfectivo()` (vigencia plan_active_until). |
| `plan-limits.ts` | Límites por plan (max_preguntas_por_asamblea, incluye_acta_detallada). |
| `precio-pro.ts` | Formateo precio Plan Pro. |
| `super-admin.ts` | `isAdminEmail()` / comprobación super admin. |
| `metaWhatsapp.ts` | `sendWhatsAppTemplate()` — envío de plantilla Meta API (variables {{1}}..{{5}}). |
| `utils.ts` | `cn()` (Tailwind merge), etc. |

### 2.5 Componentes

| Componente | Uso |
|------------|-----|
| `ToastProvider` | Contexto global de toasts (éxito, error, info); sustituye `alert()`. |
| `AuthSessionListener` | Escucha sesión; toast "Tu sesión fue cerrada" y redirección. |
| `ConjuntoSelector` | Selector de conjunto activo en el dashboard. |
| `Breadcrumbs` | Navegación tipo "Dashboard > Asambleas > [Nombre]". |
| `StepIndicator` | Pasos en votación (Email → Unidades → Votar). |
| `LoadingSpinner` | Spinner de carga reutilizable. |
| UI (`button`, `card`, `dialog`, `input`, `label`, `select`, `table`, `alert`, `tooltip`) | Componentes base con variantes (primary, destructive, outline, etc.). Todos los modales (`Dialog`/`DialogContent`) incluyen botón de cierre (X) por defecto; se puede ocultar con `showCloseButton={false}`. |

### 2.6 Base de datos (Supabase)

- **Auth**: usuarios, Magic Link, OAuth Google.
- **Tablas principales**: `organizations`, `profiles`, `unidades`, `asambleas`, `preguntas`, `opciones_pregunta`, `poderes`, `votos`, `quorum_asamblea`, `planes`, `pagos_log`, etc.
- **RLS**: políticas por `organization_id`; rol super admin con acceso total (script `ROL-SUPER-ADMIN.sql`).
- **RPCs**: `validar_codigo_acceso`, `validar_votante_asamblea`, `registrar_voto_con_trazabilidad`, `calcular_quorum_asamblea`, `calcular_estadisticas_pregunta`, `calcular_verificacion_quorum`, `calcular_verificacion_quorum_snapshot`, `calcular_verificacion_por_preguntas`, `activar_votacion_publica`, `desactivar_votacion_publica`, etc.
- **APIs de verificación y delegado**: `POST /api/verificar-asistencia` (votante confirma asistencia), `POST /api/registrar-asistencia-manual` (admin marca unidades), `POST|DELETE /api/delegado/configurar` (generar/revocar token), `POST /api/delegado/validar` (validar enlace delegado), `POST /api/delegado/registrar-asistencia`, `POST /api/delegado/registrar-voto`. Página pública de asistente: `/asistir/[codigo]?t=token`.

### 2.7 Variables de entorno (resumen)

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; opcional `SUPABASE_SERVICE_ROLE_KEY` (super-admin).
- **Auth:** `NEXT_PUBLIC_ADMIN_EMAIL` / `SUPER_ADMIN_EMAIL` (super-admin).
- **Opcional:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PASARELA_PAGOS_URL`; Wompi (webhook). La URL de Plan Pro, el precio por token y el WhatsApp se configuran en **Super Admin → Ajustes** y en la tabla de **Planes** (BD).

### 2.8 Diseño y UX

- **Paleta**: variables CSS en `globals.css` (primary, success, error, surface, border) y Tailwind; basada en psicología del color (confianza, éxito, fondos cálidos); regla 60-30-10.
- **Modo oscuro:** `prefers-color-scheme: dark` en variables.
- **Documentación UX:** `docs/ux/MEJORAS-UX-JOURNEY.md`, `docs/ux/PRUEBAS-OPTIMIZACION-Y-MEJORAS.md`, `docs/ux/COLORES-PSICOLOGIA-Y-MARKETING.md`.

---

## 3. Comandos útiles

```bash
npm run dev      # Desarrollo
npm run build    # Build producción
npm run start    # Servir build
npm run lint     # ESLint
npm run test:run # Tests Vitest
npx tsc --noEmit # Verificar tipos sin emitir
```

---

## 4. Documentación relacionada

- **Índice general:** [docs/README.md](README.md) — lista ordenada de toda la documentación.
- **Guías:** `docs/guias/` (votación, códigos de acceso, importación unidades, poderes, estadísticas, funcionalidades).
- **Configuración:** `docs/configuracion/` (variables Vercel, Wompi; landing/precio/WhatsApp en Super Admin).
- **Despliegue:** `docs/despliegue/` (Vercel, checklist, cambios producción).
- **Supabase:** `docs/supabase/` (scripts, RLS, plantillas email, auditoría).
- **Referencia:** `docs/referencia/` (auth, super-admin, cumplimiento, seguridad).
