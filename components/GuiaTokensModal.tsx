'use client'

import { HelpCircle, Link2, Link as LinkIcon, AlertTriangle, Coins, Unlock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const COLOR_DEFAULT = '#4f46e5'

/** Contexto opcional desde el panel de una asamblea (acceso público + LOPD + cobro). */
export type GuiaAccesoPublicoContext = {
  estadoAsamblea: 'borrador' | 'activa' | 'finalizada'
  accesoPublico: boolean
  isDemo: boolean
}

interface GuiaTokensModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  colorPrincipalHex?: string
  /** Si se pasa, el modal incluye bloque Acceso público + reglas de cobro (misma pantalla que la guía). */
  accesoPublicoContext?: GuiaAccesoPublicoContext | null
}

export function GuiaTokensModal({
  open,
  onOpenChange,
  colorPrincipalHex = COLOR_DEFAULT,
  accesoPublicoContext = null,
}: GuiaTokensModalProps) {
  const showAcceso = !!accesoPublicoContext
  const ctx = accesoPublicoContext

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border p-0 gap-0" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0B0E14' }}>
        {/* Cabecera estilo píldora (referencia UI moderna) */}
        <div className="p-4 pb-2 sm:p-5">
          <div
            className="flex items-center gap-3 rounded-full border px-4 py-3 sm:py-3.5"
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              background: 'linear-gradient(135deg, rgba(30,27,46,0.9) 0%, rgba(15,17,22,0.95) 100%)',
            }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-lg"
              style={{ backgroundColor: colorPrincipalHex, boxShadow: `0 0 0 1px rgba(255,255,255,0.08)` }}
            >
              <HelpCircle className="h-5 w-5 text-white" aria-hidden />
            </span>
            <DialogHeader className="text-left space-y-0.5 p-0 flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-lg font-semibold text-slate-100 leading-snug pr-2">
                Guía: tokens (créditos), acceso público y cobro
              </DialogTitle>
              <p className="text-xs text-slate-500 font-normal">
                LOPD, votación en línea y reglas de tu billetera en un solo lugar
              </p>
            </DialogHeader>
          </div>
        </div>

        {showAcceso && ctx && (
          <div className="px-4 sm:px-5 pb-4 space-y-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 shrink-0 opacity-90" style={{ color: colorPrincipalHex }} />
                Acceso público
              </h3>
              {ctx.estadoAsamblea === 'activa' && (
                <p className="text-sm text-slate-400 leading-relaxed">
                  Usa el <strong className="text-emerald-400">botón verde «Activar votación pública»</strong> en el panel para abrir el acceso y la sección{' '}
                  <strong className="text-red-400">Desactivar votación</strong> para cerrarlo. Mientras el acceso esté abierto, la sesión de privacidad (LOPD) es la
                  misma. Al <strong className="text-slate-200">cerrar</strong>, el sistema prepara una nueva sesión; al <strong className="text-slate-200">volver a abrir</strong>, los votantes aceptan LOPD de nuevo y los créditos se cobran{' '}
                  <strong className="text-slate-200">al conectarse y aceptar</strong>, según las reglas de abajo.
                </p>
              )}

              {ctx.estadoAsamblea === 'borrador' && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-100/95">
                    Primero <strong>activa la asamblea</strong> con el botón verde del encabezado. Así podrás generar código y enlace para los residentes.
                  </p>
                </div>
              )}

              {ctx.estadoAsamblea === 'activa' && !ctx.accesoPublico && (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-100/90">
                    La votación pública <strong>no está activada</strong>. Los residentes no podrán acceder hasta que actives el acceso desde el panel.
                  </p>
                </div>
              )}

              {ctx.estadoAsamblea === 'activa' && ctx.accesoPublico && (
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-100/95 font-medium">Votación pública activa — comparte el enlace o el QR desde el panel.</p>
                </div>
              )}

              <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.06)' }}>
                <p className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 shrink-0" style={{ color: colorPrincipalHex }} />
                  Cómo se cobran los créditos (tokens)
                </p>
                {ctx.isDemo ? (
                  <p className="text-sm text-slate-400">En esta asamblea de <strong className="text-slate-300">demostración</strong> no se descuentan créditos por aceptación LOPD.</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-400 mb-2">
                      <strong className="text-slate-300">Activar el acceso no descuenta saldo por sí solo.</strong> Los créditos se consumen cuando un copropietario{' '}
                      <strong className="text-slate-300">acepta el tratamiento de datos (LOPD)</strong> en la sesión pública actual.
                    </p>
                    <ul className="text-sm text-slate-400 space-y-1.5 list-disc list-inside marker:text-slate-600">
                      <li>
                        Primeras <strong className="text-slate-300">5 unidades distintas</strong> que acepten en esa sesión: sin cobro por ese concepto.
                      </li>
                      <li>
                        Desde la <strong className="text-slate-300">6.ª unidad nueva</strong> en la misma sesión: <strong className="text-slate-300">1 crédito por unidad</strong>{' '}
                        (sin cobro retroactivo a las cinco primeras).
                      </li>
                      <li>
                        La <strong className="text-slate-300">misma unidad</strong> no paga dos veces en la misma sesión aunque use varios dispositivos.
                      </li>
                    </ul>
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      Generar o reutilizar el código y el enlace no cobra solo por eso; la confirmación al activar repite el resumen. Cerrar el acceso (Desactivar votación)
                      reinicia la privacidad para la próxima apertura.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-5 pt-2 grid md:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm"
                style={{ backgroundColor: `${colorPrincipalHex}30`, color: colorPrincipalHex }}
              >
                {showAcceso ? 'A' : '1'}
              </span>
              {showAcceso ? 'Más sobre tokens y consumo' : '¿Qué son los tokens (créditos) y cuándo se consumen?'}
            </h4>
            {!showAcceso && (
              <p className="text-sm text-slate-400">
                Los tokens (créditos) son créditos de tu billetera. El costo equivale al número de unidades de tu conjunto (1 token (crédito) = 1 unidad).{' '}
                <strong className="text-slate-300">Activar la asamblea no descuenta tokens.</strong> El consumo principal por votación es cuando los copropietarios{' '}
                <strong className="text-slate-300">aceptan el tratamiento de datos (LOPD)</strong> en la sesión pública: las primeras{' '}
                <strong className="text-slate-300">cinco unidades distintas</strong> en esa sesión no generan cobro; a partir de la sexta unidad nueva en la sesión,{' '}
                <strong className="text-slate-300">1 token por unidad</strong> (sin cobro retroactivo a las cinco primeras).
              </p>
            )}
            {showAcceso && (
              <p className="text-sm text-slate-400">
                El detalle del acceso público y el cobro por LOPD está arriba. Aquí, el resto del uso de la billetera: también pueden consumirse tokens otras operaciones
                según tu plan (por ejemplo envíos masivos por WhatsApp u otras que la interfaz marque como de pago). La descarga del acta con auditoría{' '}
                <strong className="text-slate-300">no</strong> supone un cargo adicional de tokens por ese concepto.
              </p>
            )}
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">También pueden consumir tokens</strong> otras operaciones según tu plan (por ejemplo envíos masivos por WhatsApp o funciones que la interfaz indique como pagas).
              {!showAcceso && (
                <>
                  {' '}
                  Generar o descargar el acta con tabla de auditoría <strong className="text-slate-300">no descuenta tokens extra</strong> por elegir esa versión.
                </>
              )}
            </p>
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">No consumen tokens (créditos):</strong> entrar al panel, crear preguntas, importar unidades, registrar votos a nombre de un residente, ni activar la asamblea en sí.
            </p>
            <p className="text-xs text-slate-500">
              Si tu saldo no alcanza para una operación que sí cobra tokens, compra más desde la pasarela (mínimo 20 tokens (créditos) por compra).
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">{showAcceso ? 'B' : '2'}</span>
              ¿Qué puedes hacer con la aplicación?
            </h4>
            <ul className="list-none space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>
                  <strong className="text-slate-300">Conjuntos y unidades</strong> — Registrar conjuntos residenciales, cargar unidades con coeficientes (Ley 675) y datos de contacto.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>
                  <strong className="text-slate-300">Asambleas</strong> — Crear asambleas y, una vez activadas, definir preguntas y opciones de votación (Sí/No u otras).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>
                  <strong className="text-slate-300">Poderes</strong> — Registrar delegaciones de voto por unidad; búsqueda por torre+número o solo número cuando el conjunto no usa torre; límite configurable por apoderado.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>
                  <strong className="text-slate-300">Votaciones en línea</strong> — Enviar enlace a copropietarios para que voten desde el celular o PC; ver en tiempo real quién ha votado y resultados por coeficiente.{' '}
                  <strong className="text-slate-300">Verificación de quórum</strong>: activar asistencia (popup &quot;Verifico asistencia&quot;), registrar asistencia manual y paneles Ya verificaron / Faltan por verificar.{' '}
                  <strong className="text-slate-300">Acceso delegado</strong>: enlace seguro para un asistente que registre asistencia y votos en tu nombre.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>
                  <strong className="text-slate-300">Actas</strong> — Resultados, umbral y tabla de auditoría. Puedes generar e imprimir el acta; la versión con auditoría completa{' '}
                  <strong className="text-slate-300">no consume tokens adicionales</strong> por ese concepto (el requisito de saldo y plan es el que muestra la interfaz).{' '}
                  <strong className="text-slate-300">Cierra la asamblea</strong> para que el acta quede definitiva.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0" style={{ color: '#10b981' }}>
                  ✓
                </span>
                <span>
                  <strong className="text-slate-300">Certificación blockchain</strong>{' '}
                  <span className="text-xs rounded-full px-1.5 py-0.5 font-medium" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                    Gratis
                  </span>{' '}
                  — Si está activada, al <strong className="text-slate-300">cerrar la asamblea</strong> el acta se sella automáticamente en la blockchain de Bitcoin (OpenTimestamps). Así se garantiza que nadie pueda alterar el contenido del acta después de la votación. El certificado .ots se descarga desde la página del acta y se puede verificar en{' '}
                  <a href="https://opentimestamps.org" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#34d399' }}>
                    opentimestamps.org
                  </a>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>
                  <strong className="text-slate-300">Billetera de tokens (créditos)</strong> — Comprar tokens (créditos) desde 20 en adelante por pasarela de pagos; los nuevos gestores reciben un bono de bienvenida.
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-4 sm:mx-5 mb-5 p-4 rounded-2xl border flex items-start gap-3" style={{ borderColor: '#10b98155', background: 'rgba(16,185,129,0.07)' }}>
          <Link2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-0.5">Acta definitiva y certificación</p>
            <p className="text-xs text-slate-400">
              Para que el acta quede <strong className="text-slate-300">definitiva</strong> (y, si está activada, certificada en blockchain), debes <strong className="text-slate-300">cerrar la asamblea</strong> desde el botón &quot;Finalizar Asamblea&quot; en la asamblea correspondiente. A partir de ahí podrás descargar el acta y el certificado .ots desde la página del acta y verificar en{' '}
              <a href="https://opentimestamps.org" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#34d399' }}>
                opentimestamps.org
              </a>
              .
            </p>
          </div>
        </div>
        <div className="mx-4 sm:mx-5 mb-6 p-4 rounded-2xl border" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(99,102,241,0.08)' }}>
          <p className="text-sm font-semibold text-slate-200 mb-1">Documentos legales y transparencia</p>
          <p className="text-xs text-slate-400">
            Términos, EULA, política de privacidad y política de cookies se pueden administrar desde Super Admin con versionado de actualización. Esto ayuda a mantener la operación alineada con cumplimiento y comunicación clara hacia tus usuarios.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
