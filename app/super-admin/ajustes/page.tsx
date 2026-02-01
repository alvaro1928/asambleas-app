'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Shield, Save, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

export default function SuperAdminAjustesPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tituloLanding, setTituloLanding] = useState('')
  const [subtituloLanding, setSubtituloLanding] = useState('')
  const [colorPrincipalHex, setColorPrincipalHex] = useState('#4f46e5')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [precioPorTokenCop, setPrecioPorTokenCop] = useState<number | ''>(10000)
  const [bonoBienvenidaTokens, setBonoBienvenidaTokens] = useState<number | ''>(50)

  const isAllowed = (email: string | undefined) => {
    if (!email) return false
    const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
    if (!allowed) return false
    return email.trim().toLowerCase() === allowed
  }

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        router.replace('/login?redirect=/super-admin/ajustes')
        return
      }
      if (!isAllowed(session.user.email)) {
        router.replace('/login?redirect=/super-admin/ajustes')
        return
      }
      const res = await fetch('/api/super-admin/configuracion-landing', { credentials: 'include' })
      if (!res.ok) {
        toast.error('Error al cargar configuración')
        setLoading(false)
        return
      }
      const data = await res.json()
      setTituloLanding(data.titulo ?? '')
      setSubtituloLanding(data.subtitulo ?? '')
      setColorPrincipalHex(data.color_principal_hex && /^#[0-9A-Fa-f]{6}$/.test(data.color_principal_hex) ? data.color_principal_hex : '#4f46e5')
      if (data.precio_por_token_cop != null) setPrecioPorTokenCop(data.precio_por_token_cop)
      if (data.bono_bienvenida_tokens != null) setBonoBienvenidaTokens(data.bono_bienvenida_tokens)
      setLoading(false)
    }
    load()
  }, [router, toast])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/configuracion-landing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          titulo: tituloLanding.trim(),
          subtitulo: subtituloLanding.trim(),
          color_principal_hex: /^#[0-9A-Fa-f]{6}$/.test(colorPrincipalHex) ? colorPrincipalHex : '#4f46e5',
          whatsapp_number: whatsappNumber.trim() || null,
          precio_por_token_cop: typeof precioPorTokenCop === 'number' ? precioPorTokenCop : (typeof precioPorTokenCop === 'string' && precioPorTokenCop !== '' ? parseInt(precioPorTokenCop, 10) : null),
          bono_bienvenida_tokens: typeof bonoBienvenidaTokens === 'number' ? bonoBienvenidaTokens : (typeof bonoBienvenidaTokens === 'string' && bonoBienvenidaTokens !== '' ? parseInt(bonoBienvenidaTokens, 10) : null),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al guardar')
        return
      }
      toast.success('Ajustes guardados. La landing y el color principal se actualizarán al recargar.')
    } catch (e) {
      console.error(e)
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando ajustes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/super-admin"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <Shield className="w-8 h-8 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ajustes globales</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Landing, color principal y configuración de negocio</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título landing (hero)</label>
              <input
                type="text"
                value={tituloLanding}
                onChange={(e) => setTituloLanding(e.target.value)}
                placeholder="Ej. Asambleas digitales para propiedad horizontal"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subtítulo landing (hero)</label>
              <textarea
                value={subtituloLanding}
                onChange={(e) => setSubtituloLanding(e.target.value)}
                placeholder="Ej. Votaciones en tiempo real, actas y auditoría..."
                rows={3}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color principal (hex)</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={colorPrincipalHex}
                  onChange={(e) => setColorPrincipalHex(e.target.value)}
                  className="w-12 h-12 rounded-xl border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={colorPrincipalHex}
                  onChange={(e) => setColorPrincipalHex(e.target.value)}
                  placeholder="#4f46e5"
                  className="w-32 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 font-mono text-gray-900 dark:text-white"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Se aplica como variable CSS --color-primary en la app (landing, botones, acentos).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">WhatsApp de contacto (opcional)</label>
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="Ej. 573001234567"
                className="w-full max-w-xs rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
            </div>
            <hr className="border-gray-200 dark:border-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configuración de Negocio</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Precio por token y bono de bienvenida. La landing y el dashboard muestran estos valores.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio por token (COP)</label>
                <input
                  type="number"
                  min={0}
                  value={precioPorTokenCop}
                  onChange={(e) => setPrecioPorTokenCop(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                  placeholder="10000"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Precio mostrado al comprar créditos (tokens).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bono de bienvenida (tokens)</label>
                <input
                  type="number"
                  min={0}
                  value={bonoBienvenidaTokens}
                  onChange={(e) => setBonoBienvenidaTokens(e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0)}
                  placeholder="50"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tokens gratuitos que recibe cada nuevo gestor.</p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar ajustes
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
