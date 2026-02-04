# Informe Técnico y Funcional Detallado de Asambleas App

## Introducción

Este documento detalla la arquitectura, funcionalidades y lecciones aprendidas durante el desarrollo y ajuste de Asambleas App. Su propósito es consolidar el conocimiento adquirido, permitiendo que futuros desarrollos sean más precisos y eficientes, evitando retrabajos sobre decisiones clave de diseño funcional y técnico.

---

## 1. Resumen Funcional por Rol

### 1.1 Administrador (Dashboard)

El rol de Administrador gestiona la configuración de la copropiedad y el ciclo completo de las asambleas.

**Autenticación y Sesión:**
- **Login:** Email + contraseña, Magic Link (correo) o Google OAuth.
- **Seguridad:** Restablecer contraseña, cambio de contraseña desde Configuración. Cerrar sesión (`/api/auth/signout`).

**Gestión Multi-conjunto (Multi-tenant):**
- Un gestor (usuario) puede administrar **múltiples conjuntos** (`organizations`).
- **Selector de conjunto:** En el header, permite cambiar de conjunto activo, afectando los datos mostrados.
- **Listado de conjuntos:** `/dashboard/conjuntos`.
- **Creación de conjunto:** `/dashboard/nuevo-conjunto`.
- **Edición de conjunto:** `/dashboard/conjuntos/[id]/editar` (nombre, NIT, dirección).

**Gestión de Unidades:**
- **Listado:** `/dashboard/unidades` con búsqueda y filtro por torre.
- **Importación masiva:** `/dashboard/unidades/importar` (Excel/CSV), con validación de coeficientes (suma en rango 99,9%–100,1%, tolerancia por redondeo Ley 675) y unicidad (torre/número).
- **Métricas:** El dashboard principal muestra total de unidades, suma de coeficientes, datos del censo.

**Asamblea de Simulación (Demo / Sandbox):**
- **Dónde acceder:** (1) **Dashboard principal:** botón "Probar en sandbox" junto a "Asambleas". (2) **Listado de asambleas** (`/dashboard/asambleas`): botón "Probar en sandbox" en la cabecera (icono matraz). (3) **URL directa:** `/dashboard/asambleas?demo=1` abre automáticamente el modal de demostración. Si el usuario no tiene asambleas, el modal de bienvenida también se muestra al cargar la página.
- **Acción:** "Probar ahora" / "Crear asamblea de demostración" llama a `POST /api/dashboard/crear-asamblea-demo`, que crea una asamblea con `is_demo: true`, inserta 10 unidades (Apto 101–110, coeficiente 10% c/u) y 2 preguntas abiertas con opciones por defecto, activa la votación sin descontar tokens y redirige al Centro de Control.
- **Restricciones en demo:** En vistas de asamblea con `is_demo === true` se muestra `<StickyBanner />` ("Estás viendo una asamblea de demostración..."); no se pueden añadir/editar/eliminar preguntas ni cambiar su estado; las unidades demo no se pueden editar ni eliminar en `/dashboard/unidades`.
- **Acta:** El acta de una asamblea demo lleva watermark diagonal: "BORRADOR DE PRUEBA — SIN VALIDEZ LEGAL".
- **Tokens:** Las asambleas `is_demo` no consumen créditos (bypass en `descontar-token-asamblea-pro` y `descontar-token-acta`). En reportes/estadísticas globales deben excluirse las asambleas con `is_demo = true`.

**Gestión de Asambleas:**
- **Listado:** `/dashboard/asambleas`.
- **Creación:** `/dashboard/asambleas/nueva` (nombre, descripción, fecha).
- **Detalle y Configuración:** `/dashboard/asambleas/[id]`
  - **Preguntas y Opciones:** Añadir, editar, eliminar preguntas y sus opciones (tipos: coeficiente o nominal; estados: pendiente, abierta, cerrada). Definición de umbral de aprobación.
  - **Activación:** Activar/desactivar la **votación pública** (genera código de acceso y URL).
  - **Quórum:** Visualización en tiempo real (unidades que votaron, coeficiente, porcentaje).
  - **Estadísticas:** Resultados por pregunta (votos por opción, porcentajes).
  - **Voto manual (admin):** Registro de voto a nombre de un residente.
  - Compartir: Copiar código y enlace; enlace a pantalla de acceso/QR.
- **Control de Acceso y Quórum:** `/dashboard/asambleas/[id]/acceso`
  - Generación de QR y URL para votantes (`/votar/[codigo]`).
  - Registro de ingresos de votantes en tiempo real.
  - Avance de votaciones actualizado cada 10 s.
- **Poderes:** `/dashboard/asambleas/[id]/poderes`
  - Asignación y gestión de apoderados.
  - **Importación masiva** desde Excel/CSV (`/dashboard/asambleas/[id]/poderes/importar`).
  - Revocar poderes.
- **Acta:** `/dashboard/asambleas/[id]/acta`
  - Descarga/impresión del acta con resultados, quórum y **detalle de auditoría** (votante, IP, user-agent).
  - **Clave:** La generación del acta está habilitada si la asamblea ya fue activada (cobro único).

**Dashboard Principal (`/dashboard`):**
- Métricas generales del gestor.
- Enlaces rápidos a las secciones principales.
- **Billetera de tokens:** El saldo se muestra en el perfil del gestor. CTA para compra de tokens.

**Configuración (`/dashboard/configuracion`):**
- Interfaz organizada con **menú lateral** (desktop) o navegación por secciones (móvil).
- **Secciones:** Mi perfil, Contraseña, Datos del conjunto, Mis pagos. (Se eliminó la sección "Info unidades").
- **Mis pagos:** Historial de compras de tokens.

### 1.2 Votantes (Página Pública)

El votante interactúa con la aplicación para registrar sus votos en una asamblea activa.

**Flujo de Votación (`/votar/[codigo]`):**
- **Paso 1: Acceso:** Validación del código de acceso (`validar_codigo_acceso` RPC).
- **Paso 2: Identificación:** Ingreso de email o teléfono, validación (`validar_votante_asamblea` RPC), listado de unidades asignadas (propias + poderes).
- **Paso 3: Votación:** Registro de voto por cada pregunta abierta (una opción por unidad).
- **Experiencia:** Indicador de pasos (`StepIndicator`), progreso de votación, mensaje de finalización, historial de preguntas cerradas.
- **Trazabilidad:** IP y user-agent (`/api/client-info`, `registrar_voto_con_trazabilidad` RPC).
- **Sesión:** Heartbeat (`ping-quorum`) cada 2 minutos, marca salida al abandonar (`marcar-salida-quorum`).

### 1.3 Super Administrador

Acceso restringido para la gestión global y configuración del sistema.

**Acceso (`/super-admin`):**
- Solo usuarios cuyo email coincida con `NEXT_PUBLIC_ADMIN_EMAIL` (variable de entorno).

**Funcionalidad:**
- **Conjuntos:** Listado, gestión de planes y precios.
- **Planes:** Edición de parámetros (nombre, precio por token COP, límites, tokens iniciales, vigencia).
- **Ajustes:** Configuración del color principal de la landing page, número de WhatsApp de contacto.
- **Transacciones y pagos:** Lista `pagos_log` con filtros. Herramienta "Reprocesar pago manualmente".
- **Ranking:** Visualización del ranking de gestores por tokens.

---

## 2. Modelo de Negocio: Billetera de Tokens por Gestor

Este es el pilar del modelo de monetización y uso de la aplicación, con detalles clave que se refinaron.

**Core Logic:**
- **Saldo:** Almacenado en `profiles.tokens_disponibles` (por usuario/gestor). Un gestor utiliza su billetera en todos los conjuntos que administra. El saldo se consolida tomando el valor máximo entre las filas de perfil de un mismo usuario.
- **Equivalencia:** **1 token = 1 unidad de vivienda.**
- **Costo de operación:** Para un conjunto dado, el costo de una operación es el número de unidades de ese conjunto.
- **Operación que consume tokens:** **Solo activar una asamblea.** Este es un cobro único. Al activar, se descuentan los tokens necesarios y se marca `asambleas.pago_realizado = true`. Una vez pagada, el acta se puede generar y descargar **cuantas veces se quiera sin nuevos cobros**.
- **No consumen tokens:** Crear asambleas, crear preguntas, importar unidades, generar/descargar el acta (si la asamblea ya está activada), registrar votos manuales, entrar a una asamblea.

**Obtención de Tokens:**
1. **Bono de bienvenida:** Nuevos gestores reciben 50 tokens al registrarse (configurado por trigger o default en `profiles` en la DB).
2. **Super Administración:** El Super Admin puede asignar o sumar tokens a gestores individuales.
3. **Compra por Pasarela:** Mediante `POST /api/pagos/checkout-url` con `user_id` y `cantidad_tokens`. El backend interactúa con Wompi para generar un link de pago.

**Refinamientos Críticos en la Lógica de Tokens:**

- **Consumo de Tokens:** Se clarificó y se aseguró que **solo la acción de "Activar Asamblea" consume tokens**. Cualquier otra acción de configuración, creación o visualización es gratuita.
- **Bloqueo de Acceso:** Se **eliminó el bloqueo** del enlace "Asambleas" en el dashboard principal cuando el saldo de tokens era bajo. Los gestores siempre pueden acceder y configurar asambleas, unidades y poderes. El único momento de bloqueo por saldo es al intentar *activar* una asamblea.
- **Textos en UI:** Se actualizó la etiqueta "Costo por operación" en la billetera a **"Costo al activar asamblea"** y se ajustaron los mensajes en el banner de "pocos tokens" y los CTA de compra para reflejar la lógica del "cobro único al activar".
- **Input de compra:** El campo de cantidad de tokens para compra customizada permite **escribir cualquier número libremente**. La validación de un mínimo de 20 tokens se aplica al intentar pagar, y el botón de pago se deshabilita si la cantidad es menor.

---

## 3. Stack Tecnológico

| Capa | Tecnología | Notas |
| :---------------- | :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------- |
| **Framework** | **Next.js 14** (App Router) | Servidor y cliente. |
| **UI** | **React 18**, **Tailwind CSS**, **Lucide React** (iconos) | Componentes reutilizables, UI responsiva y moderna. |
| **Base de datos y Auth** | **Supabase** (PostgreSQL, Auth, RLS) | Backend-as-a-Service para DB y autenticación. |
| **Cliente Supabase** | `@supabase/ssr` (cookies), `@supabase/supabase-js` (browser) | Manejo de sesiones y acceso a DB desde servidor y cliente. |
| **Pasarela de pagos** | **Wompi** | Integración vía webhook y API REST para payment links. |
| **Gráficos** | **Recharts** | Visualización de datos (ej. votos por coeficiente). |
| **Importación/Exportación** | **xlsx**, **papaparse** (CSV) | Manejo de archivos Excel y CSV para unidades y poderes. |
| **QR** | **qrcode.react** | Generación de códigos QR para acceso a asambleas. |
| **Utilidades** | **class-variance-authority**, **clsx**, **tailwind-merge** | Gestión de estilos CSS dinámicos. |
| **Tests** | **Vitest**, **@testing-library/react** | Pruebas unitarias y de integración. |
| **Linting** | **ESLint** (next lint) | Análisis de código para mantener la calidad. |

---

## 4. Estructura de la Aplicación

```
app/
├── layout.tsx              # Layout global, ToastProvider.
├── page.tsx                # Landing / página de inicio.
├── not-found.tsx           # Página 404 personalizada.
├── globals.css             # Estilos globales de Tailwind.
├── login/page.tsx          # Página de inicio de sesión.
├── auth/                   # Rutas de autenticación.
│   ├── callback/           # Manejo de callbacks de OAuth y Magic Link.
│   └── restablecer/        # Flujo de restablecimiento de contraseña.
├── api/                    # APIs de backend (Next.js API Routes).
│   ├── auth/               # Gestión de sesiones y cierre de sesión.
│   ├── client-info/        # Obtención de IP del cliente para trazabilidad.
│   ├── dashboard/          # APIs para funcionalidades del dashboard.
│   │   ├── mis-pagos/           # Listado de historial de pagos del usuario.
│   │   ├── crear-asamblea/      # Creación de nuevas asambleas.
│   │   ├── crear-asamblea-demo/ # Creación de asamblea de demostración (sandbox; is_demo).
│   │   ├── descontar-token-asamblea-pro/ # Descuento de tokens al activar asamblea.
│   │   ├── descontar-token-acta/         # Verificación para generar acta (ya pagada o demo).
│   │   └── organization-status/ # Tokens disponibles y costo por conjunto (billetera única).
│   ├── pagos/              # APIs relacionadas con la pasarela de pagos.
│   │   ├── checkout-url/   # Generación de URLs de pago de Wompi.
│   │   ├── reprocesar/     # Reprocesamiento manual de pagos.
│   │   └── webhook/        # Webhook de Wompi para recibir notificaciones de pago.
│   ├── super-admin/        # APIs para el rol de Super Administrador.
│   │   ├── gestores/       # Gestión de gestores y tokens.
│   │   └── transacciones/  # Historial de transacciones global.
│   └── votar/              # APIs para registro de votos.
├── dashboard/              # Rutas protegidas para el administrador.
│   ├── page.tsx            # Dashboard principal.
│   ├── configuracion/      # Página de configuración del usuario y conjunto.
│   ├── conjuntos/          # Listado y gestión de conjuntos.
│   ├── unidades/           # Listado e importación de unidades.
│   └── asambleas/          # Listado, creación y gestión de asambleas.
│       └── [id]/           # Detalle de una asamblea específica.
│           ├── acceso/     # Control de acceso y quórum.
│           ├── acta/       # Generación y descarga de acta.
│           └── poderes/    # Gestión e importación de poderes.
├── pago-ok/page.tsx        # Página de retorno post-pago (neutra).
└── votar/[codigo]/page.tsx # Página pública para votantes.

components/                 # Componentes reutilizables de UI.
lib/                        # Funciones de utilidad, Supabase client, lógica de negocio.
supabase/                   # Scripts SQL para el esquema y migraciones de Supabase.
docs/                       # Documentación técnica y funcional.
```

---

## 5. Detalle de Implementación y Soluciones Clave (Aprendizajes)

Esta sección destaca los desafíos encontrados y las soluciones implementadas, cruciales para un desarrollo preciso.

### 5.1 Flujo de Pagos (Wompi Webhook)

**Problema Inicial**: Los tokens se acreditaban correctamente en `profiles.tokens_disponibles` tras un pago, pero la transacción no aparecía en "Mis pagos" del usuario ni en la lista de "Transacciones" del Super Admin.

**Causa Raíz**:
1. **`pagos_log.organization_id` era `NOT NULL`** en el esquema original de Supabase.
2. El webhook no siempre lograba obtener un `organization_id` válido para la transacción (ej. si el usuario solo tenía un perfil sin `organization_id` asociado, o si se creaba un perfil "fantasma" sin conjunto).
3. Al intentar insertar en `pagos_log` con `organization_id: null`, la base de datos rechazaba el INSERT por la restricción NOT NULL. El webhook solo registraba el error en Vercel Logs, pero continuaba el flujo y acreditaba los tokens.

**Soluciones Implementadas:**

1. **Migración de Base de Datos (`supabase/ADD-USER-ID-PAGOS-LOG.sql`):**
   - Añade la columna `user_id` a `pagos_log`.
   - Hace **nullable** la columna `organization_id` en `pagos_log`.
   - **Prompt preciso:** "Asegurar que la tabla `pagos_log` pueda registrar transacciones sin `organization_id` y permita asociarlas a un `user_id` para auditoría y visualización en el historial del usuario."

2. **Webhook de Pagos (`app/api/pagos/webhook/route.ts`):**
   - **Fallbacks mejorados para `organization_id`:**
     - Busca `organization_id` en cualquier perfil del usuario (`profiles` donde `id = userId` **o** `user_id = userId`) que tenga una organización asociada.
     - Como último recurso, busca en la tabla `organizations` si el `userId` es `owner_id` de algún conjunto.
     - **Prompt preciso:** "Implementar una lógica robusta en el webhook para resolver el `organization_id` de una transacción, buscando en todos los perfiles del usuario y en sus organizaciones si es propietario, antes de recurrir a `null`."
   - **Registro de transacciones no aprobadas:**
     - Ahora, las transacciones con estado **DECLINED** o **ERROR** (y cualquier otro estado no 'APPROVED') también se insertan en `pagos_log`. No acreditan tokens, pero su registro es crucial para la auditoría en Super Admin.
     - **Prompt preciso:** "Asegurar que **todas** las transacciones de Wompi, independientemente de su estado (APPROVED, DECLINED, ERROR, PENDING), se registren en la tabla `pagos_log`."
   - **Registro explícito con `user_id`:**
     - Todas las inserciones en `pagos_log` (para estados `APPROVED` y no `APPROVED`) ahora incluyen el `user_id` del gestor, sea `organization_id` null o no.
     - **Prompt preciso:** "Cuando se registre una transacción en `pagos_log`, incluir siempre el `user_id` del gestor asociado."
   - **Log de errores mejorado:**
     - Cuando falla la inserción en `pagos_log` (ej. por la restricción NOT NULL), el log en Vercel indica claramente la causa ("`organization_id` era null y `pagos_log` lo exige NOT NULL") y la solución (ejecutar `ADD-USER-ID-PAGOS-LOG.sql`).
     - **Prompt preciso:** "Mejorar los mensajes de error del webhook para que diagnostiquen explícitamente fallos de inserción en `pagos_log` relacionados con restricciones `NOT NULL` de `organization_id`, y sugieran la migración SQL."

3. **API "Mis pagos" (`app/api/dashboard/mis-pagos/route.ts`):**
   - Modificada para listar transacciones de `pagos_log` que coincidan con `organization_id` del usuario **o** con `user_id` del usuario, incluyendo así las transacciones sin conjunto asociado.
   - **Prompt preciso:** "Ajustar la API 'Mis pagos' para que muestre todas las transacciones del usuario, incluso aquellas registradas sin un `organization_id` asociado, utilizando el `user_id` como criterio de búsqueda."

4. **API Reprocesar Pago (`app/api/pagos/reprocesar/route.ts`):**
   - **Evitar doble acreditación:** Si el usuario ya tiene en su billetera una cantidad de tokens igual o superior a la cantidad del pago a reprocesar, el sistema asume que los tokens ya fueron acreditados (ej. por un webhook previo que falló el log) y **solo inserta el registro en `pagos_log` sin sumar tokens de nuevo**.
   - **Registro con `user_id` y `org` fallbacks:** Incluye el `user_id` y usa los mismos fallbacks para obtener `organization_id` que el webhook.
   - **Prompt preciso:** "Modificar la API de reprocesar pagos para que, si una transacción ya está en la billetera del usuario (por un webhook que solo acreditó pero no registró el log), solo se cree el registro en `pagos_log` sin duplicar la acreditación de tokens."

### 5.2 Experiencia de Usuario en Pagos

**Problema Inicial**: La página de retorno `/pago-ok` (a la que Wompi redirige tras un pago) siempre mostraba un mensaje de "Pago recibido" o "compra exitosa", incluso si la transacción había sido DECLINED o ERROR.

**Causa Raíz**: Wompi redirige a una `redirect_url` única, sin pasar el estado final de la transacción en la URL. La página `/pago-ok` asumía éxito.

**Solución Implementada (`app/pago-ok/page.tsx`):**
- La página `/pago-ok` ahora muestra un **mensaje neutral**: "Proceso de pago finalizado".
- Explica al usuario que si el pago fue **aprobado**, los tokens se acreditarán, y si fue **rechazado o falló**, no.
- El enlace de "Ir al dashboard" y la redirección automática van a `/dashboard` (sin el `?pago=ok` original), para evitar que el dashboard muestre un mensaje de éxito engañoso.
- **Prompt preciso:** "Diseñar una página de retorno (`/pago-ok`) para la pasarela de pagos que sea neutral, no asuma el éxito de la transacción, y dirija al usuario al dashboard para verificar el estado de su saldo o historial de pagos."

### 5.3 Lógica de Consumo de Tokens (Frontend)

**Problema Inicial**: Los usuarios se sentían "bloqueados" al ver que no tenían suficientes tokens (ej. 80 tokens, 500 unidades en el conjunto) para un "Costo por operación" en el dashboard. Esto impedía la configuración de asambleas, aunque el objetivo era solo cobrar al activar.

**Soluciones Implementadas:**

- **Desbloqueo de Configuración (`app/dashboard/page.tsx`):**
  - El enlace "Asambleas" en el dashboard principal **siempre está activo**, permitiendo al gestor configurar libremente sus asambleas, preguntas y poderes, sin importar el saldo de tokens.
  - **Prompt preciso:** "Asegurar que la baja cantidad de tokens no impida al gestor configurar asambleas, unidades o poderes; el bloqueo solo debe aplicarse a la acción de 'activar asamblea'."
- **Clarificación de Costo (`app/dashboard/page.tsx`):**
  - La etiqueta "Costo por operación" en la billetera del dashboard se cambió a **"Costo al activar asamblea"**, indicando que este es un cobro único.
  - Los mensajes en el banner "Te quedan pocos tokens" y los CTA de compra se actualizaron para enfatizar que el cobro es **solo una vez al activar la asamblea**.
  - **Prompt preciso:** "Revisar todos los mensajes relacionados con el costo de tokens en el UI para que enfaticen el modelo de 'cobro único al activar asamblea', evitando la ambigüedad de 'costo por operación'."

### 5.4 Configuración de la Aplicación (UI)

**Problema Inicial**: La página de Configuración (`/dashboard/configuracion/page.tsx`) tenía muchas secciones apiladas, lo que dificultaba la navegación y la experiencia de usuario. También incluía una sección informativa temporal sobre la tabla de unidades.

**Soluciones Implementadas:**
- **Organización con Navegación por Secciones (`app/dashboard/configuracion/page.tsx`):**
  - Implementado un **menú lateral sticky** en escritorio (con iconos y títulos como "Mi perfil", "Contraseña", "Datos del conjunto", "Mis pagos"). Los enlaces dirigen a cada sección mediante `id` y `scroll-mt-6`.
  - En móvil, se utiliza una **navegación horizontal por pills** (pastillas) con scroll, ofreciendo la misma funcionalidad de salto entre secciones.
  - **Prompt preciso:** "Rediseñar la página de configuración para incluir un sistema de navegación por secciones (ej. menú lateral o pestañas) que mejore la usabilidad y la organización del contenido."
- **Eliminación de Sección Informativa (`app/dashboard/configuracion/page.tsx`):**
  - Se eliminó la sección completa "Tabla de Unidades Creada", ya que era un mensaje temporal de configuración de DB.
  - **Prompt preciso:** "Eliminar la sección 'Tabla de Unidades Creada' de la página de configuración, ya que es contenido temporal y no parte de la gestión habitual del usuario."

### 5.5 Compra Customizada de Tokens

**Problema Inicial**: En el modal de compra de tokens (`app/dashboard/page.tsx`), el input para la cantidad personalizada impedía escribir libremente (ej. al escribir "1", se forzaba a "20" inmediatamente), frustrando al usuario.

**Causa Raíz**: La función `onChange` del input aplicaba `Math.max(MIN_TOKENS_COMPRA, ...)` en cada cambio, reseteando el valor si era menor al mínimo.

**Solución Implementada (`app/dashboard/page.tsx`):**
- El input (`type="number"`) ahora permite al usuario **escribir cualquier número** (o dejarlo vacío) durante la edición.
- La validación del **mínimo de 20 tokens** se aplica al calcular el monto final para el API (`cantidadCompra = Math.max(MIN_TOKENS_COMPRA, cantidadManual)`) y se muestra un mensaje de advertencia bajo el input si la cantidad es menor a 20.
- El botón "Ir a pagar" se **deshabilita** si la cantidad personalizada es menor al mínimo requerido (20).
- **Prompt preciso:** "Asegurar que el campo de entrada de cantidad de tokens en la compra personalizada permita al usuario escribir libremente, sin forzar valores mínimos en cada pulsación de tecla, aplicando la validación de mínimo de tokens al enviar el formulario."

### 5.6 Conflictos de Nombres (Build)

**Problema Inicial**: Error de compilación (`Module parse failed: Identifier 'User' has already been declared`) en `app/dashboard/configuracion/page.tsx`.

**Causa Raíz**: Se importaba `User` desde `@supabase/supabase-js` (tipo de usuario) y se intentó importar `User` también desde `lucide-react` (icono de usuario), causando un conflicto de nombres.

**Solución Implementada (`app/dashboard/configuracion/page.tsx`):**
- El icono `User` de `lucide-react` se importó con un **alias:** `User as UserIcon`.
- **Prompt preciso:** "Al integrar iconos con nombres genéricos (ej. `User`) que puedan chocar con tipos o variables existentes, utilizar aliases claros (ej. `User as UserIcon`) en la importación."

---

## 6. Scripts SQL Clave

Los siguientes scripts son fundamentales para la configuración y el mantenimiento de la base de datos de Supabase:

- **`supabase/ADD-USER-ID-PAGOS-LOG.sql`**: Añade `user_id` a `pagos_log` y permite `organization_id` NULL. **Esencial ejecutarlo para el correcto registro de pagos.**
- **`supabase/INSERTAR-PAGO-420-TOKENS.sql`**: Script de un solo uso para insertar manualmente el pago de 420 tokens que no se registró inicialmente.
- **`supabase/VER-PAGOS-LOG.sql`**: Consultas para revisar el historial de pagos en la base de datos.
- `supabase/RESETEAR-TOKENS-A-80.sql`: Script para resetear los tokens de todos los perfiles a 80.
- `supabase/WOMPI-CONJUNTOS-Y-PAGOS-LOG.sql`: Define las tablas `pagos_log`.

---

## Conclusión

Este informe encapsula las decisiones funcionales y técnicas de Asambleas App, destacando los puntos de fricción y sus soluciones. Al tener esta documentación, cualquier desarrollo futuro puede basarse en un conocimiento profundo de la aplicación, optimizando la precisión de los prompts y la eficiencia del proceso de desarrollo.
