'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSelectedConjuntoId } from '@/lib/conjuntos'
import { 
  ArrowLeft, 
  Search, 
  Edit, 
  Trash2, 
  Building2,
  Home,
  Upload,
  X,
  Save,
  AlertTriangle,
  HelpCircle,
  Plus,
  MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/providers/ToastProvider'
import { GuiaTokensModal } from '@/components/GuiaTokensModal'
import { sumaCoeficientesValida, rangoCoeficientesAceptado } from '@/lib/coeficientes'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Unidad {
  id: string
  torre?: string
  numero: string
  coeficiente: number
  tipo: string
  nombre_propietario?: string
  email?: string
  telefono?: string
  /** Unidad de demostración: no se puede editar ni eliminar */
  is_demo?: boolean
}

function UnidadesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const volverAsambleaId = searchParams.get('volver_asamblea')?.trim() || null
  const conjuntoIdFromUrl = searchParams.get('conjunto_id')?.trim() || null
  const toast = useToast()
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [filteredUnidades, setFilteredUnidades] = useState<Unidad[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTorre, setSelectedTorre] = useState<string>('all')
  const [torres, setTorres] = useState<string[]>([])

  // Estados para edición
  const [editingUnidad, setEditingUnidad] = useState<Unidad | null>(null)
  const [editForm, setEditForm] = useState({
    torre: '',
    numero: '',
    nombre_propietario: '',
    email: '',
    telefono: '',
  })
  const [saving, setSaving] = useState(false)

  // Estados para eliminación
  const [deletingUnidad, setDeletingUnidad] = useState<Unidad | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Estados para conjunto
  const [conjuntoName, setConjuntoName] = useState('')
  const [guiaModalOpen, setGuiaModalOpen] = useState(false)

  // Añadir unidad manual (formulario)
  const [showAddUnidad, setShowAddUnidad] = useState(false)
  const [newUnidad, setNewUnidad] = useState({
    torre: '',
    numero: '',
    coeficiente: 0,
    tipo: 'apartamento',
    nombre_propietario: '',
    email: '',
    telefono: '',
  })
  const [adding, setAdding] = useState(false)

  // Selección para WhatsApp
  const [selectedUnidadIds, setSelectedUnidadIds] = useState<Set<string>>(new Set())
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsappSending, setWhatsappSending] = useState(false)
  const [asambleasOpciones, setAsambleasOpciones] = useState<Array<{ id: string; nombre: string }>>([])
  const [whatsappAsambleaId, setWhatsappAsambleaId] = useState('')
  const [tokensPorMensajeWhatsapp, setTokensPorMensajeWhatsapp] = useState<number>(1)

  const totalCoeficientes = unidades.reduce((sum, u) => sum + u.coeficiente, 0)
  const coeficientesCorrecto = sumaCoeficientesValida(totalCoeficientes)

  useEffect(() => {
    // Si llegamos desde la asamblea con conjunto_id, usar ese conjunto para mostrar sus unidades
    if (typeof window !== 'undefined' && conjuntoIdFromUrl) {
      localStorage.setItem('selectedConjuntoId', conjuntoIdFromUrl)
    }
    loadUnidades()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  useEffect(() => {
    filterUnidades()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filter when list or filters change
  }, [unidades, searchTerm, selectedTorre])

  const loadUnidades = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Obtener el ID del conjunto seleccionado desde localStorage
      const selectedConjuntoId = localStorage.getItem('selectedConjuntoId')
      if (!selectedConjuntoId) {
        router.push('/dashboard')
        return
      }

      // Obtener nombre del conjunto
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', selectedConjuntoId)
        .single()

      if (org) {
        setConjuntoName(org.name)
      }

      // Solo unidades reales: excluir unidades demo (sandbox), que son lógica interna de demostración
      const { data: unidadesData, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('organization_id', selectedConjuntoId)
        .eq('is_demo', false)
        .order('torre', { ascending: true, nullsFirst: false })
        .order('numero', { ascending: true })

      if (error) {
        console.error('Error loading unidades:', error)
        return
      }

      setUnidades(unidadesData || [])

      // Extraer torres únicas
      const uniqueTorres = Array.from(
        new Set(unidadesData?.map(u => u.torre).filter(Boolean))
      ).sort()
      setTorres(uniqueTorres as string[])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterUnidades = () => {
    let filtered = [...unidades]

    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        u =>
          u.numero.toLowerCase().includes(term) ||
          u.nombre_propietario?.toLowerCase().includes(term) ||
          u.torre?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term)
      )
    }

    // Filtrar por torre
    if (selectedTorre !== 'all') {
      filtered = filtered.filter(u => u.torre === selectedTorre)
    }

    setFilteredUnidades(filtered)
  }

  const unidadesConTelefono = filteredUnidades.filter(u => (u.telefono ?? '').trim().length > 0 && !u.is_demo)
  const toggleUnidadSelection = (id: string) => {
    setSelectedUnidadIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAllWhatsApp = () => {
    if (selectedUnidadIds.size >= unidadesConTelefono.length) {
      setSelectedUnidadIds(new Set())
    } else {
      setSelectedUnidadIds(new Set(unidadesConTelefono.map(u => u.id)))
    }
  }

  const openWhatsAppModal = async () => {
    setShowWhatsAppModal(true)
    setWhatsappAsambleaId(volverAsambleaId ?? '')
    const selectedConjuntoId = typeof window !== 'undefined' ? localStorage.getItem('selectedConjuntoId') : null
    if (selectedConjuntoId) {
      const [{ data: asambleasData }, costoRes] = await Promise.all([
        supabase.from('asambleas').select('id, nombre').eq('organization_id', selectedConjuntoId).order('fecha', { ascending: false }).limit(50),
        fetch('/api/dashboard/whatsapp-costo', { credentials: 'include' }),
      ])
      setAsambleasOpciones((asambleasData ?? []) as Array<{ id: string; nombre: string }>)
      if (costoRes.ok) {
        const costoData = await costoRes.json().catch(() => ({}))
        setTokensPorMensajeWhatsapp(Math.max(1, Number(costoData.tokens_por_mensaje_whatsapp ?? 1)))
      }
    } else {
      setAsambleasOpciones([])
    }
  }

  const handleEnviarWhatsApp = async () => {
    const asambleaId = whatsappAsambleaId?.trim()
    if (!asambleaId) {
      toast.error('Elige una asamblea para el enlace de votación.')
      return
    }
    setWhatsappSending(true)
    try {
      const res = await fetch('/api/dashboard/enviar-whatsapp-votacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          asamblea_id: asambleaId,
          unidad_ids: selectedUnidadIds.size > 0 ? Array.from(selectedUnidadIds) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || `Error ${res.status}`)
        if (res.status === 402) {
          setShowWhatsAppModal(false)
        }
        return
      }
      const enviados = data.enviados ?? 0
      const total = data.total ?? 0
      const tokens = data.tokens_descontados ?? 0
      toast.success(`WhatsApp: enviados ${enviados} de ${total} mensajes. Se descontaron ${tokens} tokens.`)
      setShowWhatsAppModal(false)
      setSelectedUnidadIds(new Set())
    } catch (e) {
      console.error(e)
      toast.error('Error al enviar por WhatsApp')
    } finally {
      setWhatsappSending(false)
    }
  }

  const handleEditClick = (unidad: Unidad) => {
    if (unidad.is_demo) {
      toast.error('No se pueden editar las unidades de la asamblea de demostración.')
      return
    }
    setEditingUnidad(unidad)
    setEditForm({
      torre: unidad.torre || '',
      numero: unidad.numero || '',
      nombre_propietario: unidad.nombre_propietario || '',
      email: unidad.email || '',
      telefono: unidad.telefono || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingUnidad) return
    if (editingUnidad.is_demo) {
      toast.error('No se pueden editar las unidades de la asamblea de demostración.')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('unidades')
        .update({
          torre: editForm.torre.trim() || null,
          numero: editForm.numero.trim() || null,
          nombre_propietario: editForm.nombre_propietario || null,
          email: editForm.email || null,
          telefono: editForm.telefono || null,
        })
        .eq('id', editingUnidad.id)

      if (error) throw error

      // Actualizar localmente
      setUnidades(unidades.map(u => 
        u.id === editingUnidad.id 
          ? { ...u, ...editForm }
          : u
      ))

      setEditingUnidad(null)
      toast.success('Unidad actualizada exitosamente')
    } catch (error) {
      console.error('Error updating unidad:', error)
      toast.error('Error al actualizar la unidad')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (unidad: Unidad) => {
    if (unidad.is_demo) {
      toast.error('No se pueden eliminar las unidades de la asamblea de demostración.')
      return
    }
    setDeletingUnidad(unidad)
  }

  const handleConfirmDelete = async () => {
    if (!deletingUnidad) return
    if (deletingUnidad.is_demo) {
      toast.error('No se pueden eliminar las unidades de demostración.')
      setDeletingUnidad(null)
      return
    }

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('unidades')
        .delete()
        .eq('id', deletingUnidad.id)

      if (error) throw error

      // Actualizar localmente
      setUnidades(unidades.filter(u => u.id !== deletingUnidad.id))
      setDeletingUnidad(null)
    } catch (error) {
      console.error('Error deleting unidad:', error)
      toast.error('Error al eliminar la unidad')
    } finally {
      setDeleting(false)
    }
  }

  const handleAddUnidad = async () => {
    const selectedConjuntoId = typeof window !== 'undefined' ? localStorage.getItem('selectedConjuntoId') : null
    if (!selectedConjuntoId) {
      toast.error('Selecciona un conjunto primero')
      return
    }
    if (!newUnidad.numero?.trim()) {
      toast.error('El número de unidad es obligatorio')
      return
    }
    const coef = Number(newUnidad.coeficiente)
    if (isNaN(coef) || coef <= 0) {
      toast.error('Coeficiente debe ser un número mayor que 0')
      return
    }
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('unidades')
        .insert({
          organization_id: selectedConjuntoId,
          torre: newUnidad.torre.trim() || null,
          numero: newUnidad.numero.trim(),
          coeficiente: coef,
          tipo: (newUnidad.tipo || 'apartamento').toLowerCase(),
          nombre_propietario: newUnidad.nombre_propietario.trim() || null,
          email: newUnidad.email.trim() || null,
          telefono: newUnidad.telefono.trim() || null,
        })
        .select('id, torre, numero, coeficiente, tipo, nombre_propietario, email, telefono, is_demo')
        .single()

      if (error) throw error
      if (data) setUnidades((prev) => [...prev, data as Unidad])
      setShowAddUnidad(false)
      setNewUnidad({ torre: '', numero: '', coeficiente: 0, tipo: 'apartamento', nombre_propietario: '', email: '', telefono: '' })
      toast.success('Unidad añadida')
    } catch (error: any) {
      console.error('Error adding unidad:', error)
      toast.error(error?.message || 'Error al añadir la unidad')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando unidades...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={volverAsambleaId ? `/dashboard/asambleas/${volverAsambleaId}` : '/dashboard'}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title={volverAsambleaId ? 'Volver a la asamblea' : 'Volver al dashboard'}
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Gestión de Unidades
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {conjuntoName} • {filteredUnidades.length} de {unidades.length} unidades
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {volverAsambleaId && (
                <Link href={`/dashboard/asambleas/${volverAsambleaId}`}>
                  <Button variant="outline" className="border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver a la asamblea
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                onClick={() => setShowAddUnidad(true)}
                className="border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
              >
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Añadir unidad</span>
              </Button>
              <Button
                variant="outline"
                onClick={openWhatsAppModal}
                className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 gap-2"
                title="Enviar enlace de votación por WhatsApp a las unidades seleccionadas (se descontarán tokens)"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Notificar vía WhatsApp</span>
              </Button>
              <Link href="/dashboard/unidades/importar">
                <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                  <Upload className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Importar Unidades</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky bar: suma de coeficientes (Ley 675 = 100%) */}
      {unidades.length > 0 && (
        <div
          className={`sticky top-0 z-10 px-4 py-3 text-center text-sm font-medium shadow-sm ${
            coeficientesCorrecto
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-b border-green-200 dark:border-green-800'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800'
          }`}
        >
          {coeficientesCorrecto ? (
            <span>Suma de coeficientes: <strong>{totalCoeficientes.toFixed(2)}%</strong> ✓ Dentro del rango ({rangoCoeficientesAceptado()})</span>
          ) : (
            <span>Atención: La suma actual es <strong>{totalCoeficientes.toFixed(2)}%</strong>. Debe ser 100% (rango {rangoCoeficientesAceptado()}) para activar la asamblea.</span>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {unidades.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center border border-gray-200 dark:border-gray-700">
            <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No hay unidades registradas
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Importa tu base de datos de unidades para comenzar
            </p>
            <Link href="/dashboard/unidades/importar">
              <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <Upload className="w-4 h-4 mr-2" />
                Importar Unidades
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Búsqueda */}
                <div className="md:col-span-2">
                  <Label htmlFor="search" className="mb-2 block">
                    Buscar
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="search"
                      type="text"
                      placeholder="Buscar por número, torre o propietario..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Filtro de Torre */}
                <div>
                  <Label htmlFor="torre" className="mb-2 block">
                    Filtrar por Torre
                  </Label>
                  <Select
                    id="torre"
                    value={selectedTorre}
                    onChange={(e) => setSelectedTorre(e.target.value)}
                  >
                    <option value="all">Todas las torres</option>
                    {torres.map(torre => (
                      <option key={torre} value={torre}>
                        Torre {torre}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={unidadesConTelefono.length > 0 && selectedUnidadIds.size >= unidadesConTelefono.length}
                          onChange={toggleSelectAllWhatsApp}
                          title="Seleccionar todas las unidades con teléfono para WhatsApp"
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </TableHead>
                      <TableHead>Torre</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Coeficiente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Propietario</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnidades.map((unidad) => (
                      <TableRow key={unidad.id}>
                        <TableCell className="w-10">
                          {(unidad.telefono ?? '').trim() && !unidad.is_demo ? (
                            <input
                              type="checkbox"
                              checked={selectedUnidadIds.has(unidad.id)}
                              onChange={() => toggleUnidadSelection(unidad.id)}
                              title="Incluir en envío WhatsApp"
                              className="rounded border-gray-300 dark:border-gray-600"
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="font-medium">
                          {unidad.torre || '-'}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {unidad.numero}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {unidad.coeficiente.toFixed(6)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs capitalize">
                            {unidad.tipo}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {unidad.nombre_propietario || 'Sin propietario'}
                            </p>
                            {unidad.email && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                📧 {unidad.email}
                              </p>
                            )}
                            {unidad.telefono && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                📱 {unidad.telefono}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(unidad)}
                              disabled={unidad.is_demo}
                              title={unidad.is_demo ? 'Unidad de demostración: no editable' : 'Editar unidad'}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(unidad)}
                              disabled={unidad.is_demo}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title={unidad.is_demo ? 'Unidad de demostración: no eliminable' : 'Eliminar unidad'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Dialog de Edición */}
      <Dialog open={editingUnidad !== null} onOpenChange={() => setEditingUnidad(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Editar Unidad</DialogTitle>
            <DialogDescription>
              Modifica los datos de la unidad
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-torre">Torre</Label>
                <Input
                  id="edit-torre"
                  value={editForm.torre}
                  onChange={(e) => setEditForm({ ...editForm, torre: e.target.value })}
                  placeholder="1"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-numero">Número</Label>
                <Input
                  id="edit-numero"
                  value={editForm.numero}
                  onChange={(e) => setEditForm({ ...editForm, numero: e.target.value })}
                  placeholder="101"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-propietario">Nombre del Propietario</Label>
              <Input
                id="edit-propietario"
                value={editForm.nombre_propietario}
                onChange={(e) => setEditForm({ ...editForm, nombre_propietario: e.target.value })}
                placeholder="Juan Pérez"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="juan@email.com"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ⚠️ Este email se usará para la votación virtual
              </p>
            </div>

            <div>
              <Label htmlFor="edit-telefono">Teléfono</Label>
              <Input
                id="edit-telefono"
                type="tel"
                value={editForm.telefono}
                onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                placeholder="3001234567"
                className="mt-2"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingUnidad(null)}
                disabled={saving}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmación de Eliminación */}
      <Dialog open={deletingUnidad !== null} onOpenChange={() => setDeletingUnidad(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>¿Eliminar unidad?</DialogTitle>
            <DialogDescription>
              {deletingUnidad && (
                <span>
                  Torre {deletingUnidad.torre || 'N/A'} - Unidad {deletingUnidad.numero}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <Alert variant="warning" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Advertencia</AlertTitle>
            <AlertDescription>
              Esta acción no se puede deshacer. La unidad será eliminada permanentemente.
            </AlertDescription>
          </Alert>

          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingUnidad(null)}
              disabled={deleting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="flex-1"
            >
              {deleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Notificar vía WhatsApp */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Notificar vía WhatsApp
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const numMensajes = selectedUnidadIds.size > 0
                  ? filteredUnidades.filter(u => selectedUnidadIds.has(u.id) && (u.telefono ?? '').trim() && !u.is_demo).length
                  : unidadesConTelefono.length
                const totalTokens = numMensajes * tokensPorMensajeWhatsapp
                return (
                  <>
                    Se enviará el enlace de votación por WhatsApp a {numMensajes} {numMensajes === 1 ? 'unidad' : 'unidades'} {selectedUnidadIds.size > 0 ? 'seleccionada(s)' : 'con teléfono del conjunto'}. Se descontarán <strong>{totalTokens} tokens</strong> de tu saldo ({numMensajes} mensaje{numMensajes !== 1 ? 's' : ''} × {tokensPorMensajeWhatsapp} {tokensPorMensajeWhatsapp === 1 ? 'token' : 'tokens'} por mensaje).
                  </>
                )
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="whatsapp-asamblea">Asamblea para el enlace</Label>
              <Select
                id="whatsapp-asamblea"
                value={whatsappAsambleaId}
                onChange={(e) => setWhatsappAsambleaId(e.target.value)}
                className="mt-2 w-full"
              >
                <option value="">Elige una asamblea</option>
                {asambleasOpciones.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </Select>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedUnidadIds.size > 0
                ? `${filteredUnidades.filter(u => selectedUnidadIds.has(u.id) && (u.telefono ?? '').trim() && !u.is_demo).length} unidad(es) seleccionada(s) con teléfono.`
                : `${unidadesConTelefono.length} unidad(es) con teléfono en el conjunto.`}
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowWhatsAppModal(false)} disabled={whatsappSending} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleEnviarWhatsApp} disabled={whatsappSending || !whatsappAsambleaId} className="flex-1 bg-green-600 hover:bg-green-700 gap-2">
              {whatsappSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Añadir Unidad */}
      <Dialog open={showAddUnidad} onOpenChange={setShowAddUnidad}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir unidad</DialogTitle>
            <DialogDescription>
              Registra una unidad manualmente. Número y coeficiente son obligatorios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-torre">Torre</Label>
                <Input
                  id="new-torre"
                  value={newUnidad.torre}
                  onChange={(e) => setNewUnidad({ ...newUnidad, torre: e.target.value })}
                  placeholder="A, 1..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-numero">Número <span className="text-red-500">*</span></Label>
                <Input
                  id="new-numero"
                  value={newUnidad.numero}
                  onChange={(e) => setNewUnidad({ ...newUnidad, numero: e.target.value })}
                  placeholder="101"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new-coeficiente">Coeficiente (%) <span className="text-red-500">*</span></Label>
              <Input
                id="new-coeficiente"
                type="number"
                min={0}
                step={0.01}
                value={newUnidad.coeficiente || ''}
                onChange={(e) => setNewUnidad({ ...newUnidad, coeficiente: parseFloat(e.target.value) || 0 })}
                placeholder="10.5"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-tipo">Tipo</Label>
              <Select
                id="new-tipo"
                value={newUnidad.tipo}
                onChange={(e) => setNewUnidad({ ...newUnidad, tipo: e.target.value })}
              >
                <option value="apartamento">Apartamento</option>
                <option value="casa">Casa</option>
                <option value="local">Local</option>
                <option value="otro">Otro</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-propietario">Nombre del propietario</Label>
              <Input
                id="new-propietario"
                value={newUnidad.nombre_propietario}
                onChange={(e) => setNewUnidad({ ...newUnidad, nombre_propietario: e.target.value })}
                placeholder="Juan Pérez"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newUnidad.email}
                onChange={(e) => setNewUnidad({ ...newUnidad, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-telefono">Teléfono</Label>
              <Input
                id="new-telefono"
                type="tel"
                value={newUnidad.telefono}
                onChange={(e) => setNewUnidad({ ...newUnidad, telefono: e.target.value })}
                placeholder="3001234567"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddUnidad(false)} disabled={adding} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleAddUnidad} disabled={adding || !newUnidad.numero?.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                {adding ? 'Añadiendo...' : 'Añadir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <GuiaTokensModal open={guiaModalOpen} onOpenChange={setGuiaModalOpen} />
    </div>
  )
}

export default function UnidadesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    }>
      <UnidadesPageContent />
    </Suspense>
  )
}
