# Asambleas App

Aplicación SaaS construida con Next.js y Supabase.

## Configuración

1. Instala las dependencias:
```bash
npm install
```

2. Configura las variables de entorno en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
```

3. Ejecuta el script SQL en tu proyecto de Supabase:
   - Ve a tu proyecto en Supabase
   - Abre el SQL Editor
   - Copia y pega el contenido de `supabase/schema.sql`
   - Ejecuta el script

4. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## Estructura

- `app/` - Rutas y componentes de Next.js App Router
- `lib/` - Utilidades y configuración (incluye `supabase.ts`)
- `supabase/` - Scripts SQL y migraciones
