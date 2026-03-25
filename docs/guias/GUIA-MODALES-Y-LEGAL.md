# Guía: Modales operativos y configuración legal

Esta guía resume los modales clave del flujo operativo y la configuración de documentos legales en base de datos.

## 1) Modal de guía: tokens, acceso público y LOPD

Componente: `components/GuiaTokensModal.tsx`

### Comportamiento

- **Cabecera** tipo píldora: título «Guía: tokens (créditos), acceso público y cobro» y subtítulo breve.
- **Con contexto de asamblea** (prop opcional `accesoPublicoContext` desde `app/dashboard/asambleas/[id]/page.tsx`):
  - Bloque principal **Acceso público**: estado (borrador / activa sin acceso / activa con votación pública / finalizada), instrucciones solo cuando aplica (no repetir el texto largo si la votación pública ya está activa).
  - Tarjeta **Cómo se cobran los créditos (tokens)** con reglas de **LOPD en sesión pública** (primeras 5 unidades distintas sin cobro por ese concepto; desde la 6.ª unidad nueva en la sesión, 1 crédito por unidad; la misma unidad no paga dos veces en la misma sesión aunque use varios dispositivos). En asamblea **demo** no se descuentan créditos por LOPD.
  - Botón **Ver más** / **Ver menos** (por defecto colapsado): despliega las secciones **A** (más sobre billetera y consumo) y **B** (qué puedes hacer con la aplicación), más los recuadros de **acta definitiva / certificación** y **documentos legales**. Así el modal no resulta una pared de texto si el usuario ya leyó la parte esencial arriba.
- **Sin contexto de asamblea** (p. ej. desde gestión de poderes u otras pantallas): se muestra la explicación completa de tokens y las dos columnas, **sin** el bloque «Acceso público» ni el botón «Ver más».

### Objetivos de contenido

- Dejar claro qué cubre el **acceso público**, la **sesión LOPD** y el **cobro por aceptación** frente a otras operaciones (p. ej. envíos masivos por WhatsApp).
- Aclarar que **generar o descargar el acta con tabla de auditoría no supone un cargo adicional de tokens** por elegir esa versión (el requisito de saldo/plan es el que muestra la interfaz).
- Recordar **acta definitiva** y certificación OpenTimestamps (si está activada en Super Admin) y el cierre de documentos legales versionables.

Buenas prácticas UX (implementadas en el componente):

- Texto directo; jerarquía por tarjetas y, con contexto de asamblea, contenido extendido bajo «Ver más».
- Mensajes de costo sin ambigüedad; en móvil el modal es desplazable (`max-h` + scroll).

Referencia de reglas técnicas LOPD/sesión: `supabase/SESION-Y-TOKENS-CONSENTIMIENTO.sql` y APIs de consentimiento asociadas.

## 2) Modal de registro de asistencia manual

Componente: `components/ModalRegistroAsistencia.tsx`

Objetivo:
- Permitir registro manual de asistencia por unidad.
- Facilitar búsqueda por torre+número, número, propietario o correo.
- Soportar selección masiva y reversión puntual ("Quitar").

Mejoras vigentes:
- Filtrado memoizado para reducir trabajo de render.
- Contador visible de resultados filtrados y seleccionados.
- Mensajes de estado para éxito/error durante guardado.

## 3) Configuración legal editable

Script base: `supabase/CONFIGURACION-LEGAL-DOCUMENTOS.sql`

Crea la tabla `configuracion_legal` para administrar:
- `terminos_condiciones`
- `eula`
- `politica_privacidad`
- `politica_cookies`

Política de acceso:
- Lectura pública (`SELECT`).
- Escritura restringida (vía backend seguro con `service_role`).

Recomendación operativa:
- Mantener `ultima_actualizacion` con formato legible para usuario final.
- Versionar cambios legales en commits separados cuando sea posible.

## 4) Checklist rápido antes de producción

- Verificar textos finales en **GuiaTokensModal** y en **ModalRegistroAsistencia**.
- Con asamblea real: abrir la guía desde la página de asamblea y comprobar bloque superior + «Ver más» + cierre del diálogo (estado del acordeón se resetea al cerrar).
- Confirmar contraste y navegación por teclado en los diálogos.
- Ejecutar script legal en Supabase (`CONFIGURACION-LEGAL-DOCUMENTOS.sql`).
- Validar lectura pública de documentos y edición solo desde backend seguro.
