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

- **Tokens por cuenta:** cada cuenta (conjunto) tiene un saldo de tokens que se va descontando al crear o activar asambleas. Cuando se quedan sin tokens, compran más o actualizan a Plan Pro (ilimitado).
- **Planes:** Gratis (2 tokens iniciales), Piloto (10, vigencia configurable), Pro (ilimitado, vigencia configurable). Precio por token/asamblea y ajustes de landing (color, WhatsApp) se configuran en **Super Admin → Ajustes** y en la tabla de **Planes**.

## Estructura del proyecto

- `app/` — Rutas y componentes (Next.js App Router)
- `lib/` — Utilidades y configuración (Supabase, auth, planes)
- `supabase/` — Scripts SQL (ver orden en `docs/supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md`)
- `docs/` — Documentación (índice en **[docs/README.md](docs/README.md)**)

## Documentación

Índice completo: **[docs/README.md](docs/README.md)** — resumen de la app, guías de uso, configuración, despliegue, Supabase, referencia técnica, pruebas y UX.
