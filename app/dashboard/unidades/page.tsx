'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useToast } from '@/components/providers/ToastProvider'
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
}

export default function UnidadesPage() {
  const router = useRouter()
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

  useEffect(() => {
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

      // Obtener unidades del conjunto activo
      const { data: unidadesData, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('organization_id', selectedConjuntoId)
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

  const handleEditClick = (unidad: Unidad) => {
    setEditingUnidad(unidad)
    setEditForm({
      nombre_propietario: unidad.nombre_propietario || '',
      email: unidad.email || '',
      telefono: unidad.telefono || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingUnidad) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('unidades')
        .update({
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
    setDeletingUnidad(unidad)
  }

  const handleConfirmDelete = async () => {
    if (!deletingUnidad) return

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
                href="/dashboard"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
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
            <Link href="/dashboard/unidades/importar">
              <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <Upload className="w-4 h-4 mr-2" />
                Importar Unidades
              </Button>
            </Link>
          </div>
        </div>
      </header>

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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(unidad)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(unidad)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Unidad</DialogTitle>
            <DialogDescription>
              {editingUnidad && `Torre ${editingUnidad.torre || 'N/A'} - Unidad ${editingUnidad.numero}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
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
        <DialogContent>
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
    </div>
  )
}
