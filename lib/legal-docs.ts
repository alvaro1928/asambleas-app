export type LegalDocKey = 'terminos_condiciones' | 'eula' | 'politica_privacidad' | 'politica_cookies'

export interface LegalDocument {
  key: LegalDocKey
  titulo: string
  contenido: string
  ultima_actualizacion: string
}

export const LEGAL_DOC_ORDER: LegalDocKey[] = [
  'terminos_condiciones',
  'eula',
  'politica_privacidad',
  'politica_cookies',
]

export const LEGAL_DOC_TITLES: Record<LegalDocKey, string> = {
  terminos_condiciones: 'Términos y Condiciones',
  eula: 'EULA (Licencia de uso del software)',
  politica_privacidad: 'Política de Privacidad',
  politica_cookies: 'Política de Cookies',
}

const FECHA_BASE = '24 de marzo de 2026'

export const LEGAL_DOCS_DEFAULT: Record<LegalDocKey, LegalDocument> = {
  terminos_condiciones: {
    key: 'terminos_condiciones',
    titulo: LEGAL_DOC_TITLES.terminos_condiciones,
    ultima_actualizacion: FECHA_BASE,
    contenido: `1. Aceptación
Al registrarte, acceder o usar Asambleas App aceptas estos Términos y Condiciones. Si no estás de acuerdo, abstente de usar la plataforma.

2. Objeto del servicio
Asambleas App es una plataforma para gestionar asambleas de propiedad horizontal, incluyendo convocatoria, registro de asistencia, quórum, poderes, votación, reportes y actas.

3. Roles y cuentas
El usuario administrador es responsable de:
- La veracidad de la información cargada de conjuntos, unidades y asistentes.
- Custodiar credenciales de acceso.
- Gestionar permisos internos de su organización.
Cada usuario responde por la actividad realizada con su cuenta.

4. Uso permitido
Está prohibido:
- Usar la plataforma para actividades ilícitas o contrarias a la Ley 675 de 2001.
- Intentar vulnerar seguridad, disponibilidad o integridad de datos.
- Cargar contenido fraudulento, engañoso o sin autorización.

5. Votaciones y evidencia
La plataforma registra trazabilidad técnica de eventos (por ejemplo, registro de asistencia, votos y cambios de estado) para fines de auditoría. El cliente es responsable de validar que la configuración de la asamblea corresponda a su reglamento interno y marco legal aplicable.

6. Poderes y representación
Asambleas App permite registrar y verificar poderes, pero la validez jurídica material del poder y sus soportes documentales corresponde al administrador, consejo o autoridad competente del conjunto.

7. Disponibilidad y soporte
Se realizan esfuerzos razonables para mantener continuidad del servicio, sin garantizar disponibilidad ininterrumpida. Pueden ocurrir mantenimientos, actualizaciones o incidentes de terceros.

8. Pagos y créditos
Algunas funcionalidades requieren créditos/tokens. Los valores, consumos y condiciones comerciales se informan en la plataforma. Los pagos pueden procesarse mediante terceros.

9. Propiedad intelectual
El software, marca, interfaz, código y documentación son propiedad de sus titulares y están protegidos por normas de propiedad intelectual. No se otorga cesión del software.

10. Limitación de responsabilidad
En la máxima medida permitida por la ley, Asambleas App no responde por:
- Decisiones de negocio o jurídicas tomadas con base en la información del sistema.
- Configuraciones erróneas realizadas por usuarios.
- Fallas atribuibles a terceros (conectividad, servicios externos, proveedores de pago, etc.).

11. Modificaciones
Estos términos pueden actualizarse. La versión vigente se publica en el módulo Legal indicando fecha de última actualización.

12. Legislación aplicable
Este servicio se interpreta bajo la legislación colombiana, especialmente normas sobre propiedad horizontal, comercio electrónico y protección de datos.

Fuentes legales de referencia (Colombia):
- Ley 675 de 2001 (Propiedad Horizontal).
- Ley 527 de 1999 (mensajes de datos y comercio electrónico): https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4276
- Ley 1581 de 2012 (protección de datos personales): https://sedeelectronica.sic.gov.co/transparencia/normativa/ley-1581
`,
  },
  eula: {
    key: 'eula',
    titulo: LEGAL_DOC_TITLES.eula,
    ultima_actualizacion: FECHA_BASE,
    contenido: `1. Licencia
Se concede una licencia limitada, revocable, no exclusiva e intransferible para usar Asambleas App conforme a este EULA y al plan contratado.

2. Alcance
La licencia permite uso operativo del software para administración de asambleas y funciones relacionadas dentro de la organización del cliente.

3. Restricciones
No está permitido:
- Copiar, sublicenciar, vender, alquilar o distribuir el software sin autorización.
- Descompilar, hacer ingeniería inversa o intentar extraer código fuente, salvo habilitación legal expresa.
- Eludir controles técnicos o de seguridad.

4. Titularidad
El software y sus componentes siguen siendo propiedad de sus titulares. Este EULA no transfiere propiedad intelectual.

5. Actualizaciones
Podemos desplegar mejoras, parches o cambios funcionales para seguridad, rendimiento y evolución del producto.

6. Datos y configuración
La licencia habilita el uso del sistema; no garantiza por sí sola el cumplimiento normativo del cliente. El cliente debe configurar correctamente sus procesos internos, quórum, poderes y votación.

7. Terminación
La licencia puede terminar por:
- Incumplimiento de este EULA o de los Términos.
- Mora o incumplimiento contractual.
- Decisión de descontinuación conforme a aviso previo razonable.
Al terminar, debe cesar el uso de la plataforma.

8. Exclusión de garantías
El software se suministra "tal cual", con medidas razonables de calidad, sin garantía absoluta de operación ininterrumpida.

9. Limitación de responsabilidad
En la medida permitida por la ley, la responsabilidad total frente al uso del software se limita a los montos efectivamente pagados por el cliente en el periodo definido contractualmente.

10. Ley aplicable
Este EULA se rige por las leyes de la República de Colombia.

Nota: este texto es base operativa y puede ajustarse según asesoría legal especializada.
`,
  },
  politica_privacidad: {
    key: 'politica_privacidad',
    titulo: LEGAL_DOC_TITLES.politica_privacidad,
    ultima_actualizacion: FECHA_BASE,
    contenido: `1. Responsable del tratamiento
Asambleas App trata datos personales para operar servicios de asambleas, votación y gestión documental en propiedad horizontal.

2. Datos tratados
Podemos tratar:
- Identificación y contacto (nombre, correo, teléfono).
- Datos de unidades y participación en asambleas.
- Registros de asistencia, poderes, votación y auditoría técnica.
- Datos técnicos de uso (IP, navegador, eventos de sesión).
- Datos transaccionales de pagos (a través de pasarelas externas).

3. Finalidades
Tratamos datos para:
- Prestar el servicio contratado.
- Gestionar autenticación y seguridad.
- Cumplir obligaciones legales y atender requerimientos de autoridad.
- Emitir comunicaciones operativas de la plataforma.
- Mejorar rendimiento y experiencia de usuario.

4. Base legal y consentimiento
El tratamiento se fundamenta en:
- Ejecución del contrato de servicio.
- Cumplimiento de obligaciones legales.
- Consentimiento del titular cuando aplique.

5. Derechos del titular
El titular puede ejercer derechos de acceso, actualización, rectificación, supresión, revocatoria y consulta según ley aplicable.

6. Encargados y terceros
Podemos usar encargados para infraestructura, autenticación, mensajería o pagos. Estos terceros tratan datos bajo condiciones de seguridad y finalidad.

7. Transferencia y almacenamiento
Los datos pueden almacenarse o procesarse en infraestructuras en nube bajo controles razonables de seguridad.

8. Conservación
Conservamos la información por el tiempo necesario para la finalidad del servicio y obligaciones legales.

9. Seguridad
Aplicamos medidas técnicas y organizativas razonables para proteger confidencialidad, integridad y disponibilidad.

10. Cambios de política
La política puede actualizarse; la versión vigente estará disponible en este módulo.

11. Fuentes legales de referencia
- Ley 1581 de 2012 (SIC): https://sedeelectronica.sic.gov.co/transparencia/normativa/ley-1581
- Ley 1266 de 2008 (SIC): https://sedeelectronica.sic.gov.co/transparencia/normativa/ley-estatutaria-1266-de-2008
- Autoridad de protección de datos (SIC): https://www.sic.gov.co

Nota: esta política base no reemplaza asesoría jurídica particular para tu organización.
`,
  },
  politica_cookies: {
    key: 'politica_cookies',
    titulo: LEGAL_DOC_TITLES.politica_cookies,
    ultima_actualizacion: FECHA_BASE,
    contenido: `1. ¿Qué son las cookies?
Son archivos o tecnologías similares que se almacenan en tu dispositivo para reconocer sesiones, recordar preferencias y analizar uso de la plataforma.

2. Tipos de cookies que usamos
- Esenciales: necesarias para autenticación, seguridad y funcionamiento.
- Funcionales: recuerdan preferencias de interfaz.
- Analíticas o de rendimiento: ayudan a mejorar estabilidad y experiencia.
- De terceros: pueden existir cuando se integran servicios externos (por ejemplo, autenticación o analítica).

3. Finalidad
Usamos cookies para:
- Mantener la sesión iniciada de forma segura.
- Mejorar tiempos de respuesta y navegación.
- Comprender uso agregado del producto.

4. Gestión del consentimiento
Cuando aplique por normativa o configuración del sitio, podrás aceptar, rechazar o ajustar categorías no esenciales.

5. Desactivación
Puedes controlar cookies desde tu navegador. Desactivar cookies esenciales puede afectar funcionamiento del servicio.

6. Cambios
Podemos actualizar esta política para reflejar cambios técnicos o normativos.

7. Referencias
- Documentación de cookies de la SIC: https://sedeelectronica.sic.gov.co/transparencia/normativa/politicas-lineamientos-y-manuales/documentacion-de-cookies
- Política de privacidad SIC: https://www.sic.gov.co/politica-privacidad

Nota: esta política debe revisarse con tu asesor legal según el uso específico de cookies y herramientas de terceros en tu despliegue.
`,
  },
}

export function getDefaultLegalDocs(): LegalDocument[] {
  return LEGAL_DOC_ORDER.map((key) => ({ ...LEGAL_DOCS_DEFAULT[key] }))
}

