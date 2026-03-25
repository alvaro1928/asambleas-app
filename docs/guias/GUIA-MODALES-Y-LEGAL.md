# Guía: Modales operativos y configuración legal

Esta guía resume los modales clave del flujo operativo y la configuración de documentos legales en base de datos.

## 1) Modal de guía de tokens y funcionalidades

Componente: `components/GuiaTokensModal.tsx`

Objetivo:
- Explicar cuándo se consumen tokens (cobro único al activar asamblea).
- Aclarar funcionalidades incluidas (votación, poderes, actas, blockchain).
- Recordar cómo dejar acta definitiva (cerrar asamblea).
- Dar contexto sobre documentos legales administrables por Super Admin.

Buenas prácticas UX:
- Texto directo y accionable.
- Secciones cortas para lectura en móvil.
- Mensajes de costo y alcance sin ambiguedad.

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

- Verificar textos finales en ambos modales.
- Confirmar contraste y navegación por teclado.
- Ejecutar script legal en Supabase.
- Validar lectura pública de documentos y edición solo desde backend seguro.
