# Auditoría de votos y opciones de integridad

## Lo que ya tienes (auditable)

- **historial_votos**: cada voto y cada cambio de voto (crear/modificar) con:
  - votante (email, nombre), unidad, opción elegida, opción anterior (si modificó)
  - **ip_address** (IP del votante, si se envía desde la app)
  - **user_agent** (navegador/dispositivo)
  - **fecha/hora** (created_at)
- **reporte_auditoria_pregunta(p_pregunta_id)**: listado para auditoría por pregunta.
- En el **acta** (página Descargar acta): resultados por pregunta + tabla de auditoría (quién votó, cuándo, IP, dispositivo).

Ejecuta el SQL que añade `user_agent` al reporte si aún no lo tienes:
`supabase/ACTUALIZAR-REPORTE-AUDITORIA-USER-AGENT.sql`

---

## Hash de integridad (sin blockchain, sin coste)

Para dejar constancia de que el acta no se modificó después de cerrar la votación:

1. **En la base de datos**: al cerrar la última pregunta (o la asamblea), calcular un **hash** (por ejemplo SHA-256) de un texto que incluya:
   - id asamblea, fecha/hora cierre, resumen de resultados (por pregunta: opción, cantidad de votos, coeficiente).
2. Guardar ese hash en una tabla (ej. `asambleas.hash_acta` o `actas_integridad`) con la fecha.
3. Incluir ese hash en el PDF/acta que se descarga (“Hash de integridad: abc123…”).

Cualquier persona puede, más adelante, volver a generar el mismo texto desde los datos y comprobar que el hash coincide. No requiere blockchain ni coste extra.

---

## Blockchain (opcional, con coste)

**Qué aporta**: que un tercero (la red) certifique que en un momento dado existía ese hash, y que no se pueda alterar el historial sin que se note.

**Opciones típicas**:

- **Ethereum / Polygon / otra L2**: escribir en la cadena un hash del acta (o del resumen de la votación). Cada escritura paga “gas” (puede ser poco en Polygon, más en Ethereum).
- **Servicios tipo “notarización en blockchain”**: algunas APIs permiten registrar un hash a cambio de una tarifa.

**Coste**: depende de la red y del tráfico; en redes baratas puede ser del orden de céntimos por acta; en Ethereum mainnet puede ser más.

**Recomendación**: empezar con **hash de integridad en BD + en el acta** (gratis y auditable). Si más adelante necesitas certificación externa, añadir el registro del mismo hash en blockchain.
