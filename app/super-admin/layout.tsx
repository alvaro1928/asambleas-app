'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Shield,
  LayoutDashboard,
  Building2,
  Coins,
  Receipt,
  Settings2,
  MessageCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/super-admin', label: 'Inicio', icon: LayoutDashboard },
  { href: '/super-admin/conjuntos', label: 'Conjuntos', icon: Building2 },
  { href: '/super-admin/creditos', label: 'Créditos', icon: Coins },
  { href: '/super-admin/transacciones', label: 'Transacciones', icon: Receipt },
  { href: '/super-admin/ajustes', label: 'Ajustes', icon: Settings2 },
  { href: '/super-admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
]

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row">
      {/* Mobile: header con menú */}
      <header className="md:hidden flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-6 h-6 text-amber-500 shrink-0" />
          <span className="font-semibold text-gray-900 dark:text-white truncate">Super Admin</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Sidebar: desktop siempre visible; mobile solo cuando sidebarOpen */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          flex flex-col transform transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          pt-14 md:pt-0
        `}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 hidden md:flex items-center gap-3 shrink-0">
            <Shield className="w-8 h-8 text-amber-500" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">Super Administración</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Resúmenes y configuración</p>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/super-admin' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              )
            })}
          </nav>
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <Link href="/dashboard" onClick={() => setSidebarOpen(false)}>
              <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                <LogOut className="w-4 h-4" />
                Ir al Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </aside>

      {/* Overlay en mobile cuando el menú está abierto */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenido principal */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
