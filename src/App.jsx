import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { esPersonal, useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import { Logo, useApariencia } from './lib/apariencia'
import { dinero } from './lib/format'
import { vibrar } from './lib/tema'
import { Aviso, Cargando } from './components/ui'
import Login from './pages/Login'
import Menu from './pages/Menu'
import MiCuenta from './pages/MiCuenta'
// El panel de administración se descarga solo cuando se abre
const Admin = lazy(() => import('./pages/admin/Admin'))

const VISTAS = ['menu', 'cuenta', 'admin']

function vistaInicial() {
  const v = new URLSearchParams(window.location.search).get('vista')
  if (v) window.history.replaceState(null, '', window.location.pathname)
  return VISTAS.includes(v) ? v : 'menu'
}

export default function App() {
  const { session, perfil, cargando, salir } = useAuth()
  const { apariencia } = useApariencia()
  const [vista, setVista] = useState(vistaInicial)
  const [aviso, setAviso] = useState(null)
  const [saldo, setSaldo] = useState(0)

  const avisar = useCallback((tipo, texto) => setAviso({ tipo, texto }), [])
  const cerrarAviso = useCallback(() => setAviso(null), [])

  const refrescarSaldo = useCallback(async () => {
    const { data } = await supabase.rpc('mi_saldo')
    setSaldo(Number(data ?? 0))
  }, [])

  useEffect(() => {
    if (perfil?.activo) refrescarSaldo()
  }, [perfil?.activo, refrescarSaldo])

  if (cargando) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <div className="esqueleto mb-6 h-8 w-48" />
        <Cargando filas={5} />
      </div>
    )
  }
  if (!session) return <Login />

  if (!perfil || !perfil.activo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-600">
          {perfil ? 'Tu cuenta está desactivada. Habla con la encargada de la tienda.' : 'No encontramos tu perfil.'}
        </p>
        <button onClick={salir} className="btn-secundario">Cerrar sesión</button>
      </div>
    )
  }

  const pestanas = [
    { id: 'menu', titulo: 'Menú', icono: '🛒' },
    { id: 'cuenta', titulo: 'Mi cuenta', icono: '👤', insignia: saldo > 0 ? dinero(saldo) : null },
    ...(esPersonal(perfil) ? [{ id: 'admin', titulo: 'Admin', icono: '⚙️' }] : []),
  ]
  const indice = Math.max(0, pestanas.findIndex((p) => p.id === vista))

  const cambiarVista = (id) => {
    if (id === vista) return
    vibrar(8)
    setVista(id)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />

      <header className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="flex items-center gap-2 text-xl font-bold text-marca-texto">
          <Logo className="h-8 w-8 text-2xl" />
          <span className="truncate">{apariencia.nombre_tienda}</span>
        </h1>
        <button onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && salir()}
          className="text-sm font-medium text-slate-500">
          Salir
        </button>
      </header>

      <main key={vista} className="animar-entrada px-4">
        {vista === 'menu' && <Menu avisar={avisar} onCompra={refrescarSaldo} />}
        {vista === 'cuenta' && <MiCuenta avisar={avisar} onCambio={refrescarSaldo} />}
        {vista === 'admin' && esPersonal(perfil) && (
          <Suspense fallback={<Cargando />}><Admin avisar={avisar} /></Suspense>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="relative mx-auto flex max-w-3xl">
          {/* Barra que se desliza bajo la pestaña activa */}
          <span
            aria-hidden="true"
            className="absolute top-0 h-[3px] rounded-b-full bg-marca transition-transform duration-300 ease-out"
            style={{ width: `${100 / pestanas.length}%`, transform: `translateX(${indice * 100}%)` }}
          />
          {pestanas.map((p) => {
            const activa = vista === p.id
            return (
              <button key={p.id} onClick={() => cambiarVista(p.id)} aria-current={activa ? 'page' : undefined}
                className={`relative flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-xs transition-colors ${
                  activa ? 'font-bold text-marca-texto' : 'font-medium text-slate-400'
                }`}>
                <span className={`relative flex h-8 w-14 items-center justify-center rounded-full text-xl transition-all duration-300 ${
                  activa ? 'scale-110 bg-marca-claro' : 'scale-100 grayscale-[60%]'
                }`}>
                  {p.icono}
                  {p.insignia && (
                    <span className="absolute -right-3 -top-1.5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow">
                      {p.insignia}
                    </span>
                  )}
                </span>
                {p.titulo}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
