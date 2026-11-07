import { useCallback, useEffect, useState } from 'react'
import { esPersonal, useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import { Aviso, Cargando } from './components/ui'
import Login from './pages/Login'
import Menu from './pages/Menu'
import MiCuenta from './pages/MiCuenta'
import Admin from './pages/admin/Admin'

export default function App() {
  const { session, perfil, cargando, salir } = useAuth()
  const [vista, setVista] = useState('menu')
  const [aviso, setAviso] = useState(null)
  const [nombreTienda, setNombreTienda] = useState('Tienda de Karla')

  const avisar = useCallback((tipo, texto) => setAviso({ tipo, texto }), [])
  const cerrarAviso = useCallback(() => setAviso(null), [])

  useEffect(() => {
    if (!perfil?.activo) return
    supabase.from('ajustes').select('nombre_tienda').maybeSingle()
      .then(({ data }) => data && setNombreTienda(data.nombre_tienda))
  }, [perfil?.activo])

  if (cargando) return <Cargando />
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
    { id: 'cuenta', titulo: 'Mi cuenta', icono: '👤' },
    ...(esPersonal(perfil) ? [{ id: 'admin', titulo: 'Admin', icono: '⚙️' }] : []),
  ]

  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <Aviso aviso={aviso} onCerrar={cerrarAviso} />

      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-xl font-bold text-marca">🍿 {nombreTienda}</h1>
        <button onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && salir()}
          className="text-sm font-medium text-slate-500">
          Salir
        </button>
      </header>

      <main className="px-4">
        {vista === 'menu' && <Menu avisar={avisar} />}
        {vista === 'cuenta' && <MiCuenta avisar={avisar} />}
        {vista === 'admin' && esPersonal(perfil) && <Admin avisar={avisar} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl">
          {pestanas.map((p) => (
            <button key={p.id} onClick={() => setVista(p.id)}
              className={`flex flex-1 flex-col items-center py-2.5 text-xs font-semibold ${
                vista === p.id ? 'text-marca' : 'text-slate-400'
              }`}>
              <span className="text-xl">{p.icono}</span>
              {p.titulo}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
