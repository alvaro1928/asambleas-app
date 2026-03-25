# Asambleas App

Aplicación SaaS para asambleas de propiedades horizontales: votaciones, quórum, poderes y actas. Construida con Next.js y Supabase.

## Configuración rápida

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Variables de entorno** — Crea `.env.local` con al menos:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
   ```
   Lista completa: **[docs/configuracion/VARIABLES-ENTORNO-VERCEL.md](docs/configuracion/VARIABLES-ENTORNO-VERCEL.md)**.

3. **Base de datos** — En Supabase (SQL Editor) ejecuta los scripts en el orden indicado en **[docs/supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md](docs/supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md)** (empezando por `schema.sql` si es proyecto nuevo).

4. **Arrancar**
   ```bash
   npm run dev
   ```

## Modelo de negocio (resumen)

- **Billetera de tokens (créditos) por gestor:** el saldo está en el perfil del usuario (gestor), no por conjunto. **1 token = 1 unidad de vivienda** como referencia de costos. Consumos habituales: **activación de asamblea** (requisito de saldo), **aceptación LOPD** en sesión de votación pública (reglas por sesión), **envíos masivos por WhatsApp** (configurable). La **descarga del acta con auditoría** no descuenta tokens extra por elegir esa versión. Compra de recarga vía pasarela (Wompi) cuando aplique.
- **Asamblea de pruebas (sandbox):** desde el listado de Asambleas, el botón **"Probar en entorno de pruebas"** crea una asamblea de demostración (10 unidades, 2 preguntas, activada). No consume tokens; el acta lleva marca de "DEMO - SIN VALIDEZ LEGAL". Incluye las mismas funcionalidades y diseño que una asamblea real: **verificación de asistencia**, **acceso de asistente delegado**, secciones **colapsables** en Acceso Público y en la página de Acceso, y panel **Quórum y Participación** con tarjeta de asistencia verificada. Puedes elegir **Unidades de demostración** (10 cuentas test) o **Unidades reales del conjunto** y **gestionar unidades** desde el enlace en el panel de la asamblea.
- **Unidades sin torre:** en listados y búsquedas (unidades, poderes, asistencia manual, asistente delegado) puedes buscar por número solo o por frases donde el último término es el apartamento, además de torre+número y propietario.
- **Verificación de quórum (asistencia):** el administrador puede activar una verificación de asistencia; los votantes ven un popup para confirmar "Verifico asistencia". El admin puede registrar asistencia manualmente por unidades. Al desactivar y volver a activar, todos deben verificar de nuevo. En la página de Control de acceso, con verificación activa se muestran dos paneles: "Ya verificaron" y "Faltan por verificar".
- **Acceso delegado:** el administrador puede generar un enlace seguro para un asistente de confianza que permita registrar asistencia y votos en nombre de unidades (todas las acciones quedan registradas como "registrado por asistente delegado").
- **Planes y configuración:** Precio por token, bono de bienvenida y ajustes de landing (color, WhatsApp) se configuran en **Super Admin → Ajustes** y en la tabla **Planes**.

## Estructura del proyecto

- `app/` — Rutas y componentes (Next.js App Router)
- `lib/` — Utilidades y configuración (Supabase, auth, planes)
- `supabase/` — Scripts SQL (ver orden en `docs/supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md`)
- `docs/` — Documentación (índice en **[docs/README.md](docs/README.md)**)

## Documentación

Índice completo: **[docs/README.md](docs/README.md)** — resumen de la app, guías de uso, configuración, despliegue, Supabase, referencia técnica, pruebas y UX.

Notas recientes:
- Guía operativa de modales y legal: **[docs/guias/GUIA-MODALES-Y-LEGAL.md](docs/guias/GUIA-MODALES-Y-LEGAL.md)**.
- Script de documentos legales editables (Super Admin): **[supabase/CONFIGURACION-LEGAL-DOCUMENTOS.sql](supabase/CONFIGURACION-LEGAL-DOCUMENTOS.sql)**.

## Licencia

Este proyecto es **propietario** y el código se ofrece en formato **source available** (código visible) para auditoría y verificación. No está bajo una licencia open source (MIT, GPL, etc.): el uso en producción, la distribución y el uso comercial requieren una **licencia o acuerdo** con el titular. Detalles en [LICENSE](LICENSE).
