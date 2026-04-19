import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { PublicSitePrimarySync } from '@/components/legal/public-site-primary-sync'
import { LandingLegalNav, landingLegalFocusRing } from '@/components/legal/landing-legal-nav'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Política de privacidad de Asambleas App: cómo usamos, divulgamos y administramos los datos de los usuarios.',
}

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] antialiased selection:bg-[#4338ca]/25 selection:text-[#0b1c30]">
      <PublicSitePrimarySync />
      <a
        href="#contenido-principal"
        className={cn(
          'sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-[#0b1c30] focus:shadow-lg',
          landingLegalFocusRing
        )}
      >
        Saltar al contenido
      </a>
      <LandingLegalNav highlight="legal" />

      <div className="pt-24">
        <main id="contenido-principal" className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mb-10">
            <Link
              href="/"
              className={cn(
                'mb-6 inline-flex text-sm font-medium text-[#4338ca] transition-colors hover:text-indigo-800',
                landingLegalFocusRing,
                'rounded-md'
              )}
            >
              ← Volver al inicio
            </Link>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-md">
                <Shield className="h-7 w-7 text-white" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2a14b4]">Privacidad</p>
                <h1 className="text-3xl font-extrabold tracking-tighter text-[#0b1c30] md:text-4xl">
                  Política de Privacidad
                </h1>
                <p className="mt-1 text-sm text-[#464554]">Última actualización: febrero 2025</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_40px_rgba(11,28,48,0.05)] sm:p-10">
            <div className="space-y-8 text-[#464554]">
              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">
                  1. Responsable del tratamiento
                </h2>
                <p className="leading-7">
                  Los datos personales que recopilamos a través de Asambleas App (“la App”, “nosotros”) son
                  administrados por el titular del producto. Esta política describe cómo usamos, divulgamos y
                  administramos la información de los usuarios para el correcto funcionamiento del servicio de
                  asambleas y votaciones para propiedad horizontal.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">2. Datos que recopilamos</h2>
                <p className="mb-2 leading-7">Podemos recopilar los siguientes datos:</p>
                <ul className="list-disc space-y-1 pl-6 leading-7">
                  <li>
                    <span className="font-semibold text-[#0b1c30]">Datos de cuenta:</span> correo electrónico,
                    nombre (cuando lo proporciones), y datos asociados al inicio de sesión (por ejemplo, si usas
                    inicio con Google).
                  </li>
                  <li>
                    <span className="font-semibold text-[#0b1c30]">Datos del servicio:</span> información de
                    conjuntos residenciales, asambleas, unidades, votaciones, actas, poderes y asistencia (quórum),
                    necesarios para prestar el servicio de asambleas virtuales y cumplimiento normativo (Ley 675).
                  </li>
                  <li>
                    <span className="font-semibold text-[#0b1c30]">Datos de uso:</span> información técnica como
                    dirección IP, tipo de navegador y actividad en la App para operar, mejorar y asegurar el
                    servicio.
                  </li>
                  <li>
                    <span className="font-semibold text-[#0b1c30]">Datos de pago:</span> si utilizas funciones de
                    pago, podemos recibir datos de transacciones a través de nuestros proveedores de pago (por
                    ejemplo, referencia de pago, monto); no almacenamos números completos de tarjetas.
                  </li>
                </ul>
                <p className="mt-3 leading-7">
                  No recopilamos datos personales sensibles (salud, étnicos, etc.) salvo que sea estrictamente
                  necesario para el servicio y con tu consentimiento.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">3. Uso de los datos</h2>
                <p className="leading-7">Utilizamos tus datos para:</p>
                <ul className="mt-2 list-disc space-y-1 pl-6 leading-7">
                  <li>Proporcionar y operar la App (asambleas, votaciones, actas).</li>
                  <li>Autenticarte y gestionar tu cuenta.</li>
                  <li>Cumplir obligaciones legales y normativas aplicables.</li>
                  <li>Mejorar la seguridad, rendimiento y experiencia de usuario.</li>
                  <li>
                    Comunicarnos contigo sobre el servicio (por ejemplo, notificaciones de asambleas o recuperación
                    de contraseña).
                  </li>
                  <li>Gestionar pagos y soporte cuando aplique.</li>
                </ul>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">
                  4. Divulgación y terceros
                </h2>
                <p className="leading-7">No vendemos tus datos personales. Podemos compartir información con:</p>
                <ul className="mt-2 list-disc space-y-1 pl-6 leading-7">
                  <li>
                    <span className="font-semibold text-[#0b1c30]">Proveedores de servicios:</span> infraestructura
                    (por ejemplo, Supabase), autenticación (por ejemplo, Google OAuth), envío de correos y
                    procesamiento de pagos, que actúan según nuestras instrucciones y sus propias políticas de
                    privacidad.
                  </li>
                  <li>
                    <span className="font-semibold text-[#0b1c30]">Autoridades:</span> cuando la ley lo exija o
                    para proteger derechos y seguridad.
                  </li>
                </ul>
                <p className="mt-3 leading-7">
                  Si la App utiliza servicios de Meta (por ejemplo, Facebook Login o SDKs de Meta), la información
                  que Meta reciba está sujeta a la política de privacidad de Meta. Te recomendamos revisar las
                  políticas de los terceros con los que interactúes a través de la App.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">
                  5. Administración y retención
                </h2>
                <p className="leading-7">
                  Conservamos los datos el tiempo necesario para prestar el servicio, cumplir obligaciones legales y
                  resolver disputas. Los datos de asambleas y actas pueden conservarse más tiempo cuando la normativa
                  (por ejemplo, Ley 675) lo requiera. Puedes solicitar la eliminación de tu cuenta y, cuando la ley
                  lo permita, de los datos asociados contactándonos.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">6. Seguridad</h2>
                <p className="leading-7">
                  Aplicamos medidas técnicas y organizativas para proteger tus datos (acceso restringido, cifrado en
                  tránsito, buenas prácticas de desarrollo). Ningún sistema es infalible; en caso de incidente que
                  afecte tus datos, actuaremos conforme a la ley aplicable.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">7. Tus derechos</h2>
                <p className="leading-7">
                  Según la ley aplicable (por ejemplo, Ley 1581 de 2012 en Colombia), puedes ejercer derechos de
                  acceso, corrección, supresión y oposición al tratamiento. Para ejercerlos o para consultas sobre
                  esta política, escríbenos al correo de contacto que indiquemos en la App o en la web oficial del
                  producto.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">8. Cambios</h2>
                <p className="leading-7">
                  Podemos actualizar esta política ocasionalmente. La versión vigente estará publicada en esta
                  página con la fecha de “Última actualización”. El uso continuado de la App tras cambios
                  importantes constituye aceptación de la política actualizada.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight text-[#0b1c30]">9. Contacto</h2>
                <p className="leading-7">
                  Para preguntas sobre esta Política de Privacidad o sobre el tratamiento de tus datos, contacta al
                  responsable a través del canal indicado en la página principal de la App (por ejemplo, WhatsApp o
                  correo de contacto).
                </p>
              </section>
            </div>

            <div className="mt-12 border-t border-slate-200 pt-8">
              <Link
                href="/"
                className={cn(
                  'inline-flex text-sm font-medium text-[#4338ca] transition-colors hover:text-indigo-800',
                  landingLegalFocusRing,
                  'rounded-md'
                )}
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </main>

        <div className="border-t border-slate-200 bg-slate-50 py-6 text-center">
          <Link
            href="/login"
            className={cn('text-sm font-medium text-[#4338ca] hover:underline', landingLegalFocusRing)}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
