'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Save, Loader2, ArrowLeft, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/providers/ToastProvider'

export default function SuperAdminWhatsAppPage() {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [tokensPorMensaje, setTokensPorMensaje] = useState<number | ''>(1)

  const isAllowed = (email: string | undefined) => {
    if (!email) return false
    const admin = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').trim().toLowerCase()
    const superAdmin = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()
    if (!admin && !superAdmin) return false
    const e = email.trim().toLowerCase()
    return e === admin || e === superAdmin
  }

  useEffect(() => {
    const load = async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        router.replace('/login?redirect=/super-admin/whatsapp')
        return
      }
      if (!isAllowed(session.user.email)) {
        router.replace('/login?redirect=/super-admin/whatsapp')
        return
      }
      const res = await fetch('/api/super-admin/configuracion-whatsapp', { credentials: 'include' })
      if (!res.ok) {
        toast.error('Error al cargar configuración WhatsApp')
        setLoading(false)
        return
      }
      const data = await res.json()
      setAccessToken(data.access_token ?? '')
      setPhoneNumberId(data.phone_number_id ?? '')
      setTemplateName(data.template_name ?? '')
      setTokensPorMensaje(data.tokens_por_mensaje_whatsapp != null ? data.tokens_por_mensaje_whatsapp : 1)
      setLoading(false)
    }
    load()
  }, [router, toast])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/configuracion-whatsapp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          access_token: accessToken.trim() || null,
          phone_number_id: phoneNumberId.trim() || null,
          template_name: templateName.trim() || null,
          tokens_por_mensaje_whatsapp: typeof tokensPorMensaje === 'number' ? tokensPorMensaje : (tokensPorMensaje !== '' ? parseInt(String(tokensPorMensaje), 10) : 1),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Error al guardar')
        return
      }
      toast.success('Configuración WhatsApp guardada.')
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
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/super-admin" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <MessageCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">WhatsApp (Meta API)</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Token, Phone Number ID, plantilla y tokens por mensaje</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token de acceso (Meta)</label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="EAAM..."
                className="w-full rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Token de la app de Meta for Developers. No se muestra en la interfaz tras guardar.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number ID</label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="Ej. 123456789012345"
                className="w-full max-w-md rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ID del número de WhatsApp Business en Meta.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la plantilla</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ej. notificacion_votacion"
                className="w-full max-w-md rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Nombre exacto de la plantilla aprobada por Meta. Variables: {'{{1}}'} nombre, {'{{2}}'} conjunto, {'{{3}}'} título asamblea, {'{{4}}'} fecha, {'{{5}}'} o botón = link.</p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tokens por mensaje WhatsApp</label>
              <input
                type="number"
                min={1}
                value={tokensPorMensaje}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') setTokensPorMensaje('')
                  else setTokensPorMensaje(Math.max(1, parseInt(v, 10)))
                }}
                className="w-24 rounded-3xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 max-w-xl">
                <strong>Meta cobra por mensaje tipo marketing</strong> aproximadamente USD 0,025 – 0,14 según el país (Colombia suele estar en el rango bajo). Cada envío masivo descuenta (mensajes enviados × este valor) tokens del gestor. Fija este número para que <strong>(tokens por mensaje × precio por token en COP)</strong> sea un poco mayor que el costo en COP de Meta, así no pierdes dinero.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving} className="rounded-2xl gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar configuración WhatsApp
              </Button>
              <Link href="/super-admin">
                <Button variant="outline" className="rounded-2xl">Volver al Super Admin</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
