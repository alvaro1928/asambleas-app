# Supabase – Scripts SQL

En esta carpeta están los **scripts SQL** que se ejecutan en el SQL Editor de Supabase.

**Documentación** (orden de ejecución, RLS, plantillas de email, etc.): [docs/supabase/](../docs/supabase/).

Resumen rápido: [docs/supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md](../docs/supabase/RESUMEN-SCRIPTS-A-EJECUTAR.md).

Scripts destacados:
- `SESION-Y-TOKENS-CONSENTIMIENTO.sql`: modo de sesión (`session_mode` / `session_seq`), consumo de tokens al aceptar LOPD con umbral de 5 unidades por sesión, RPC `registrar_consentimiento_y_consumo_sesion` (bloqueo `FOR UPDATE` en la fila de `asambleas` por código y en `profiles` del gestor al descontar, para idempotencia multi-dispositivo y evitar condiciones de carrera entre asambleas), y cierre de sesión. Ejecutar después de `CONSENTIMIENTO-TRATAMIENTO-DATOS.sql` y de las funciones `validar_votante_asamblea` / `validar_codigo_acceso`.
- `CONFIGURACION-LEGAL-DOCUMENTOS.sql`: tabla y políticas para documentos legales editables.
- `ADD-COLUMN-USER-AGENT-VOTOS.sql`: columna opcional para trazabilidad de `user_agent` en `votos`.
- `CONFIGURAR-SUPER-ADMINS-MULTIPLES.sql`: tabla de super admins adicionales gestionables desde `/super-admin/superadmins`.
