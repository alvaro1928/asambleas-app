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

- **Billetera de tokens por gestor:** el saldo está en el perfil del usuario (gestor), no por conjunto. **1 token = 1 unidad de vivienda.** El único cobro es **al activar una asamblea** (una vez por asamblea); después se puede generar el acta cuantas veces se quiera sin nuevo cobro. Sin tokens suficientes no se puede activar; el gestor puede comprar más desde la app (pasarela Wompi).
- **Asamblea de pruebas (sandbox):** desde el Dashboard o el listado de Asambleas hay un botón **"Probar en sandbox"** que crea una asamblea de demostración con datos de ejemplo (10 unidades, 2 preguntas, activada). No consume tokens; el acta lleva marca de "BORRADOR DE PRUEBA — SIN VALIDEZ LEGAL". Sirve para explorar la plataforma sin compromiso.
- **Planes y configuración:** Precio por token, bono de bienvenida y ajustes de landing (color, WhatsApp) se configuran en **Super Admin → Ajustes** y en la tabla **Planes**.

## Estructura del proyecto

- `app/` — Rutas y componentes (Next.js App Router)
- `lib/` — Utilidades y configuración (Supabase, auth, planes)
- `supabase/` — Scripts SQL (ver orden en `docs/supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md`)
- `docs/` — Documentación (índice en **[docs/README.md](docs/README.md)**)

## Documentación

Índice completo: **[docs/README.md](docs/README.md)** — resumen de la app, guías de uso, configuración, despliegue, Supabase, referencia técnica, pruebas y UX.
