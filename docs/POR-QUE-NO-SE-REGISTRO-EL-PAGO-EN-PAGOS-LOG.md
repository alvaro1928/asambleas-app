# Por qué no se registró el pago en pagos_log

## Qué pasó

El webhook de Wompi **sí acreditó los tokens** (80 → 500) pero **no insertó la fila en `pagos_log`**, por eso el pago no aparece en "Mis pagos" ni en Super Admin → Transacciones.

## Causa

1. **La tabla `pagos_log` tiene `organization_id` NOT NULL**  
   (definido en `supabase/WOMPI-CONJUNTOS-Y-PAGOS-LOG.sql`).

2. **En ese momento el webhook no tenía un conjunto para el usuario** (`orgIdForLog` era `null`):
   - Se obtiene de los perfiles del usuario (id o user_id) y de organizations.owner_id.
   - Si el usuario solo tenía un perfil sin `organization_id` (o el perfil recién creado por el webhook con `organization_id: null`), y no había otro perfil ni organización con ese owner, `orgIdForLog` queda `null`.

3. **Se intenta insertar con `organization_id: null`** en `registrarTransaccionPago`.  
   La base de datos rechaza el INSERT por la restricción NOT NULL y devuelve un error. El webhook solo registra ese error en consola y **no lanza excepción**, así que responde 200 y los tokens ya quedaron actualizados; solo falla el registro en `pagos_log`.

Resumen: **no se guardó el log porque `organization_id` era null y la tabla no permite null en esa columna.**

## Solución para que no vuelva a pasar

Ejecutar en Supabase → SQL Editor el script **`supabase/ADD-USER-ID-PAGOS-LOG.sql`**:

- Añade la columna `user_id` a `pagos_log`.
- Hace **nullable** `organization_id` (`DROP NOT NULL`).

Después de eso:

- El webhook puede insertar en `pagos_log` aunque no tenga conjunto (con `organization_id` null y `user_id` del gestor).
- "Mis pagos" ya está preparado para mostrar filas por `user_id`, así que esos pagos se verán aunque no tengan `organization_id`.
- Los fallbacks del webhook (buscar org en perfiles por user_id y en organizations.owner_id) siguen intentando rellenar `organization_id` cuando exista.

## Recuperar el pago que no quedó registrado

Para ese pago concreto (420 tokens, ID Wompi `12026427-1770172113-90443`):

- Opción A: En Super Admin → Transacciones, usar **Reprocesar** con ese ID. Si el saldo ya está correcto (500), solo se insertará la fila en `pagos_log` sin sumar tokens de nuevo (si ya ejecutaste ADD-USER-ID-PAGOS-LOG).
- Opción B: Insertar manualmente la fila con el script `supabase/INSERTAR-PAGO-420-TOKENS.sql` (solo si no ejecutaste la migración y no puedes usar Reprocesar con user_id).
