# Ejecucion segura: acceso a votacion y descuento de tokens

Esta guia describe exactamente que ejecutar en Supabase y como validar que el flujo quedo estable.

## 1) SQL canónico a aplicar (produccion/staging)

Ejecuta en SQL Editor el contenido completo de:

- `supabase/SESION-Y-TOKENS-CONSENTIMIENTO.sql`

Si prefieres aplicar solo lo critico, ejecuta al menos los bloques:

- `CREATE OR REPLACE FUNCTION validar_codigo_acceso(...)`
- `CREATE OR REPLACE FUNCTION registrar_consentimiento_y_consumo_sesion(...)`

## 2) Verificacion inmediata de firmas

Ejecuta esta consulta y confirma que ambas columnas existan en `validar_codigo_acceso`:

```sql
SELECT
  p.proname,
  pg_get_function_result(p.oid) AS resultado
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('validar_codigo_acceso', 'registrar_consentimiento_y_consumo_sesion');
```

Resultado esperado en `validar_codigo_acceso`: debe incluir `session_mode text` y `session_seq integer`.

## 3) Smoke test SQL

Reemplaza `CODIGO_VALIDO` por un codigo real:

```sql
SELECT * FROM validar_codigo_acceso('CODIGO_VALIDO');
```

Debes ver columnas:

- `acceso_valido`
- `session_mode`
- `session_seq`

## 4) Smoke test API (desde tu terminal local)

Reemplaza dominio/codigo/identificador:

```powershell
curl -X POST "https://www.asamblea.online/api/votar/validar-codigo-acceso" `
  -H "Content-Type: application/json" `
  -d "{\"codigo\":\"CODIGO_VALIDO\"}"
```

```powershell
curl -X POST "https://www.asamblea.online/api/votar/consentimiento" `
  -H "Content-Type: application/json" `
  -d "{\"codigo\":\"CODIGO_VALIDO\",\"identificador\":\"correo@dominio.com\"}"
```

Estados esperados:

- 200: consentimiento registrado.
- 402: saldo insuficiente.
- 403: identificador no autorizado/sin unidades.
- 409: sesion inactiva o acceso cerrado.
- 500: no esperado (si aparece, revisar logs y firma de funciones).

## 5) Checklist QA rapido

- Codigo invalido devuelve mensaje claro, sin 500.
- Codigo valido con `session_mode=inactive` no permite avanzar a voto.
- En `session_mode=verification`, muestra pantalla de verificacion sin preguntas.
- En `session_mode=voting`, permite cargar preguntas y votar.
- Consentimiento repetido en misma `session_seq` no duplica cobro por unidad.
- En asamblea demo:
  - si `sandbox_usar_unidades_reales=false`: solo unidades demo.
  - si `sandbox_usar_unidades_reales=true`: solo unidades reales.
  - el cambio a unidades reales debe estar habilitado solo para Super Admin.

## Regla de negocio unificada (demo = sandbox)

- `is_demo=true` identifica entorno de prueba/capacitacion (sandbox).
- En demo no se descuentan tokens por consentimiento.
- El acta demo mantiene marca de agua.
- Por defecto demo usa unidades de demostracion.
- Solo Super Admin puede habilitar `sandbox_usar_unidades_reales=true`.

## 6) Prueba de concurrencia recomendada

Dispara dos peticiones simultaneas de consentimiento con el mismo codigo e identificador.
Verifica en SQL:

```sql
SELECT asamblea_id, session_seq, unidad_id, COUNT(*) AS repeticiones
FROM sesion_token_consumos
GROUP BY asamblea_id, session_seq, unidad_id
HAVING COUNT(*) > 1;
```

Esperado: cero filas.

## 7) Rollback (si algo falla)

1. Restaurar definiciones previas de funciones desde tu respaldo SQL del entorno.
2. Repetir verificacion de firmas (`pg_get_function_result`).
3. Ejecutar smoke tests de codigo + consentimiento.

Nota: no ejecutes scripts historicos de `validar_codigo_acceso` que no incluyen `session_mode/session_seq`.
