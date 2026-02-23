import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRightOnRectangleIcon, Bars3Icon, UserCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { clearAuth, getUser } from '../lib/auth'

function navClass(isActive) {
  if (isActive) {
    return 'bg-indigo-50 text-indigo-700'
  }
  return 'text-slate-700 hover:bg-slate-100'
}

export default function DashboardLayout({ title, links, children }) {
  const location = useLocation()
  const user = getUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const fullName = user?.ime?.trim() || user?.username || 'Korisnik'
  const email = user?.email || 'Nema email adrese'

  function handleLogout() {
    clearAuth()
    window.location.href = '/'
  }

  function closeSidebar() {
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-72 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col overflow-y-auto">
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-slate-900">BookFast</h1>
          </div>
          <nav className="flex-1 space-y-2">
            {links.map((link) => (
              <Link
                key={link.id || link.to || link.label}
                to={link.to}
                onClick={link.onClick}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${navClass(
                  link.isActive ?? location.pathname === link.to,
                )}`}
              >
                {link.icon ? <link.icon className="size-4" aria-hidden="true" /> : null}
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-indigo-100 p-2 text-indigo-600">
                <UserCircleIcon className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{fullName}</p>
                <p className="truncate text-xs text-slate-600">{email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                title="Odjava"
                aria-label="Odjava"
              >
                <ArrowRightOnRectangleIcon className="size-5" />
              </button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="Zatvori izbornik"
              onClick={closeSidebar}
              onKeyDown={(e) => e.key === 'Escape' && closeSidebar()}
              className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white p-5 shadow-xl lg:hidden">
              <div className="mb-6 flex items-center justify-between">
                <h1 className="text-xl font-semibold text-slate-900">BookFast</h1>
                <button
                  type="button"
                  onClick={closeSidebar}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Zatvori izbornik"
                >
                  <XMarkIcon className="size-6" />
                </button>
              </div>
              <nav className="space-y-2">
                {links.map((link) => (
                  <Link
                    key={link.id || link.to || link.label}
                    to={link.to}
                    onClick={() => {
                      closeSidebar()
                      link.onClick?.()
                    }}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${navClass(
                      link.isActive ?? location.pathname === link.to,
                    )}`}
                  >
                    {link.icon ? <link.icon className="size-4" aria-hidden="true" /> : null}
                    {link.label}
                  </Link>
                ))}
              </nav>
            </aside>
          </>
        )}

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Otvori izbornik"
            >
              <Bars3Icon className="size-6" />
            </button>
            <h2 className="hidden text-xl font-semibold text-slate-900 lg:block">{title}</h2>
            <div className="flex items-center gap-2 lg:hidden">
              <span className="text-sm font-medium text-slate-700">{fullName}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Odjava"
              >
                <ArrowRightOnRectangleIcon className="size-5" />
              </button>
            </div>
          </header>
          <main className="bg-slate-50 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
