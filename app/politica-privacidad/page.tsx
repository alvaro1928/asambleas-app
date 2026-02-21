import type { Metadata } from "next";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Política de privacidad de Asambleas App: cómo usamos, divulgamos y administramos los datos de los usuarios.",
};

export default function PoliticaPrivacidadPage() {
  return (
    <main
      className="min-h-screen text-slate-100"
      style={{ backgroundColor: "#0B0E14" }}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Política de Privacidad
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Última actualización: febrero 2025
            </p>
          </div>
        </div>

        <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              1. Responsable del tratamiento
            </h2>
            <p>
              Los datos personales que recopilamos a través de Asambleas App
              (“la App”, “nosotros”) son administrados por el titular del
              producto. Esta política describe cómo usamos, divulgamos y
              administramos la información de los usuarios para el correcto
              funcionamiento del servicio de asambleas y votaciones para
              propiedad horizontal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              2. Datos que recopilamos
            </h2>
            <p className="mb-2">Podemos recopilar los siguientes datos:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-300">
              <li>
                <strong className="text-slate-200">Datos de cuenta:</strong>{" "}
                correo electrónico, nombre (cuando lo proporciones), y datos
                asociados al inicio de sesión (por ejemplo, si usas inicio con
                Google).
              </li>
              <li>
                <strong className="text-slate-200">Datos del servicio:</strong>{" "}
                información de conjuntos residenciales, asambleas, unidades,
                votaciones, actas, poderes y asistencia (quórum), necesarios
                para prestar el servicio de asambleas virtuales y cumplimiento
                normativo (Ley 675).
              </li>
              <li>
                <strong className="text-slate-200">Datos de uso:</strong>{" "}
                información técnica como dirección IP, tipo de navegador y
                actividad en la App para operar, mejorar y asegurar el servicio.
              </li>
              <li>
                <strong className="text-slate-200">Datos de pago:</strong> si
                utilizas funciones de pago, podemos recibir datos de
                transacciones a través de nuestros proveedores de pago (por
                ejemplo, referencia de pago, monto); no almacenamos números
                completos de tarjetas.
              </li>
            </ul>
            <p className="mt-3">
              No recopilamos datos personales sensibles (salud, étnicos, etc.)
              salvo que sea estrictamente necesario para el servicio y con tu
              consentimiento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              3. Uso de los datos
            </h2>
            <p>Utilizamos tus datos para:</p>
            <ul className="list-disc pl-6 space-y-1 text-slate-300 mt-2">
              <li>Proporcionar y operar la App (asambleas, votaciones, actas).</li>
              <li>Autenticarte y gestionar tu cuenta.</li>
              <li>Cumplir obligaciones legales y normativas aplicables.</li>
              <li>Mejorar la seguridad, rendimiento y experiencia de usuario.</li>
              <li>Comunicarnos contigo sobre el servicio (por ejemplo,
                notificaciones de asambleas o recuperación de contraseña).</li>
              <li>Gestionar pagos y soporte cuando aplique.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              4. Divulgación y terceros
            </h2>
            <p>
              No vendemos tus datos personales. Podemos compartir información
              con:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-slate-300 mt-2">
              <li>
                <strong className="text-slate-200">Proveedores de servicios:</strong>{" "}
                infraestructura (por ejemplo, Supabase), autenticación (por
                ejemplo, Google OAuth), envío de correos y procesamiento de
                pagos, que actúan según nuestras instrucciones y sus propias
                políticas de privacidad.
              </li>
              <li>
                <strong className="text-slate-200">Autoridades:</strong> cuando
                la ley lo exija o para proteger derechos y seguridad.
              </li>
            </ul>
            <p className="mt-3">
              Si la App utiliza servicios de Meta (por ejemplo, Facebook Login o
              SDKs de Meta), la información que Meta reciba está sujeta a la
              política de privacidad de Meta. Te recomendamos revisar las
              políticas de los terceros con los que interactúes a través de la
              App.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              5. Administración y retención
            </h2>
            <p>
              Conservamos los datos el tiempo necesario para prestar el
              servicio, cumplir obligaciones legales y resolver disputas. Los
              datos de asambleas y actas pueden conservarse más tiempo cuando la
              normativa (por ejemplo, Ley 675) lo requiera. Puedes solicitar la
              eliminación de tu cuenta y, cuando la ley lo permita, de los datos
              asociados contactándonos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              6. Seguridad
            </h2>
            <p>
              Aplicamos medidas técnicas y organizativas para proteger tus
              datos (acceso restringido, cifrado en tránsito, buenas prácticas
              de desarrollo). Ningún sistema es infalible; en caso de incidente
              que afecte tus datos, actuaremos conforme a la ley aplicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              7. Tus derechos
            </h2>
            <p>
              Según la ley aplicable (por ejemplo, Ley 1581 de 2012 en Colombia),
              puedes ejercer derechos de acceso, corrección, supresión y
              oposición al tratamiento. Para ejercerlos o para consultas sobre
              esta política, escríbenos al correo de contacto que indiquemos en
              la App o en la web oficial del producto.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              8. Cambios
            </h2>
            <p>
              Podemos actualizar esta política ocasionalmente. La versión
              vigente estará publicada en esta página con la fecha de “Última
              actualización”. El uso continuado de la App tras cambios
              importantes constituye aceptación de la política actualizada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">
              9. Contacto
            </h2>
            <p>
              Para preguntas sobre esta Política de Privacidad o sobre el
              tratamiento de tus datos, contacta al responsable a través del
              canal indicado en la página principal de la App (por ejemplo,
              WhatsApp o correo de contacto).
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
