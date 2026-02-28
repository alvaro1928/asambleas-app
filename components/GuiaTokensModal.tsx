'use client'

import { HelpCircle, Link2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const COLOR_DEFAULT = '#4f46e5'

interface GuiaTokensModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  colorPrincipalHex?: string
}

export function GuiaTokensModal({ open, onOpenChange, colorPrincipalHex = COLOR_DEFAULT }: GuiaTokensModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-0" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0B0E14' }}>
        <DialogHeader className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <DialogTitle className="flex items-center gap-2 text-xl text-slate-200">
            <HelpCircle className="w-6 h-6 text-violet-400" style={{ color: colorPrincipalHex }} />
            Guía: tokens (créditos) y funcionalidades
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm" style={{ backgroundColor: `${colorPrincipalHex}30`, color: colorPrincipalHex }}>1</span>
              ¿Qué son los tokens (créditos) y cuándo se consumen?
            </h4>
            <p className="text-sm text-slate-400">
              Los tokens (créditos) son créditos de tu billetera. El costo equivale al número de unidades de tu conjunto (1 token (crédito) = 1 unidad). <strong className="text-slate-300">Solo se cobran una vez</strong> al realizar esta acción:
            </p>
            <ul className="list-none space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0" style={{ color: colorPrincipalHex }}>•</span>
                <span><strong className="text-slate-300">Activar la asamblea</strong> — Al pasar la asamblea de borrador a activa. Ese pago habilita compartir el enlace de votación y generar el acta <strong className="text-slate-300">cuantas veces quieras</strong> sin nuevo cobro.</span>
              </li>
            </ul>
            <p className="text-sm text-slate-400">
              <strong className="text-slate-300">No consumen tokens (créditos):</strong> entrar a la asamblea, crear preguntas, importar unidades, registrar votos a nombre de un residente ni generar/descargar el acta (una vez activada).
            </p>
            <p className="text-xs text-slate-500">
              Si tu saldo es menor al costo, no podrás activar la asamblea hasta que compres más tokens (créditos). La compra es desde 20 tokens (créditos) en adelante por la pasarela de pagos.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-200 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">2</span>
              ¿Qué puedes hacer con la aplicación?
            </h4>
            <ul className="list-none space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span><strong className="text-slate-300">Conjuntos y unidades</strong> — Registrar conjuntos residenciales, cargar unidades con coeficientes (Ley 675) y datos de contacto.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span><strong className="text-slate-300">Asambleas</strong> — Crear asambleas, definir preguntas y opciones de votación (Sí/No u otras).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span><strong className="text-slate-300">Votaciones en línea</strong> — Enviar enlace a copropietarios para que voten desde el celular o PC; ver en tiempo real quién ha votado y resultados por coeficiente.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span><strong className="text-slate-300">Actas</strong> — Generar actas con resultados, umbral de aprobación y auditoría. Una vez activada la asamblea, puedes generar e imprimir el acta sin nuevo cobro. <strong className="text-slate-300">Cierra la asamblea</strong> para que el acta quede definitiva.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0" style={{ color: '#10b981' }}>✓</span>
                <span>
                  <strong className="text-slate-300">Certificación blockchain</strong>{' '}
                  <span className="text-xs rounded-full px-1.5 py-0.5 font-medium" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Gratis</span>
                  {' '}— Al <strong className="text-slate-300">cerrar la asamblea</strong>, el acta se sella automáticamente en la blockchain de Bitcoin mediante OpenTimestamps. Garantiza que nadie pueda alterar el contenido del acta después de la votación. Actívalo en <strong className="text-slate-300">Super Admin → Ajustes</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span><strong className="text-slate-300">Billetera de tokens (créditos)</strong> — Comprar tokens (créditos) desde 20 en adelante por pasarela de pagos; los nuevos gestores reciben un bono de bienvenida.</span>
              </li>
            </ul>
          </div>
        </div>
        {/* Callout blockchain */}
        <div className="mx-6 mb-6 p-4 rounded-2xl border flex items-start gap-3" style={{ borderColor: '#10b981', background: 'rgba(16,185,129,0.07)' }}>
          <Link2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-0.5">
              ¿Cómo activar la certificación blockchain?
            </p>
            <p className="text-xs text-slate-400">
              Ve a <strong className="text-slate-300">Super Admin → Ajustes</strong> y activa &quot;Certificación blockchain (OpenTimestamps)&quot;. Desde ese momento, cada vez que <strong className="text-slate-300">cierres una asamblea</strong>, el acta quedará sellada en la blockchain de Bitcoin de forma gratuita. El certificado <strong className="text-slate-300">.ots</strong> se puede descargar desde la página del acta y verificar en{' '}
              <a href="https://opentimestamps.org" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#34d399' }}>opentimestamps.org</a>.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
