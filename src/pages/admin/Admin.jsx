import { useEffect, useState } from 'react'
import { esJefatura, puede, useAuth } from '../../lib/auth'
import { vibrar } from '../../lib/tema'
import FilaDeslizable from '../../components/FilaDeslizable'
import Deudores from './Deudores'
import Productos from './Productos'
import Estadisticas from './Estadisticas'
import Usuarios from './Usuarios'
import Ajustes from './Ajustes'
import Bitacora from './Bitacora'
import Promociones from './Promociones'
import Caja from './Caja'
import CampoClave from '../../components/CampoClave'
import { adminVencido, entrarConClave, marcarActividadAdmin, MINUTOS_BLOQUEO } from '../../lib/acceso'
import { mensajeError } from '../../lib/format'

export default function Admin({ avisar, pendientes = 0, onPendientes }) {
  const { perfil } = useAuth()
  const secciones = [
    { id: 'deudores', icono: '💵', titulo: 'Deudores', insignia: pendientes, ver: puede(perfil, 'deudores') || puede(perfil, 'pagos'), C: Deudores },
    { id: 'caja', icono: '💰', titulo: 'Caja', ver: puede(perfil, 'pagos') || puede(perfil, 'estadisticas'), C: Caja },
    { id: 'productos', icono: '🏷️', titulo: 'Productos', ver: puede(perfil, 'productos') || puede(perfil, 'inventario'), C: Productos },
    { id: 'promos', icono: '🔥', titulo: 'Promos', ver: puede(perfil, 'productos'), C: Promociones },
    { id: 'estadisticas', icono: '📊', titulo: 'Estadísticas', ver: puede(perfil, 'estadisticas'), C: Estadisticas },
    { id: 'usuarios', icono: '👥', titulo: 'Usuarios', ver: puede(perfil, 'usuarios'), C: Usuarios },
    { id: 'ajustes', icono: '⚙️', titulo: 'Ajustes', ver: puede(perfil, 'ajustes'), C: Ajustes },
    { id: 'bitacora', icono: '📜', titulo: 'Bitácora', ver: esJefatura(perfil), C: Bitacora },
  ].filter((s) => s.ver)
  const [activa, setActiva] = useState(null) // null = cuadrícula de secciones

  const [bloqueado, setBloqueado] = useState(adminVencido)

  // Cada toque dentro del panel cuenta como actividad; si pasan 10 min sin usarlo, se bloquea
  useEffect(() => {
    if (bloqueado) return
    marcarActividadAdmin()
    const marcar = () => marcarActividadAdmin()
    const revisar = () => adminVencido() && setBloqueado(true)
    window.addEventListener('pointerdown', marcar, { passive: true })
    window.addEventListener('keydown', marcar)
    document.addEventListener('visibilitychange', revisar)
    const t = setInterval(revisar, 20_000)
    return () => {
      window.removeEventListener('pointerdown', marcar)
      window.removeEventListener('keydown', marcar)
      document.removeEventListener('visibilitychange', revisar)
      clearInterval(t)
    }
  }, [bloqueado])

  if (bloqueado) return <Desbloquear usuario={perfil.usuario} onListo={() => setBloqueado(false)} />

  if (!secciones.length) return <p className="py-10 text-center text-slate-500">No tienes permisos de administración.</p>
  const actual = secciones.find((s) => s.id === activa)
  const abrir = (id) => { vibrar(6); setActiva(id); window.scrollTo({ top: 0, behavior: 'instant' }) }

  // ---- Cuadrícula de secciones ----
  if (!actual) {
    return (
      <div className="animar-entrada grid grid-cols-4 gap-2 pb-28">
        {secciones.map((s) => (
          <button key={s.id} onClick={() => abrir(s.id)}
            className="relative flex flex-col items-center gap-1 rounded-2xl bg-superficie px-1 py-3 shadow-sm ring-1 ring-slate-200 transition active:scale-95">
            <span className="text-2xl">{s.icono}</span>
            <span className="w-full truncate text-center text-[11px] font-semibold text-slate-700">{s.titulo}</span>
            {s.insignia > 0 && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{s.insignia}</span>
            )}
          </button>
        ))}
      </div>
    )
  }
  const Actual = actual.C

  return (
    <div className="space-y-4 pb-28">
      {/* Atajos: volver a la cuadrícula o saltar a otra sección */}
      <div className="flex items-center gap-1">
        <button onClick={() => setActiva(null)} aria-label="Volver al panel"
          className="shrink-0 rounded-full bg-superficie px-3 py-1.5 text-sm font-semibold text-marca-texto ring-1 ring-slate-200">‹ Panel</button>
        <div className="min-w-0 flex-1">
        <FilaDeslizable>
          {secciones.map((s) => (
            <button key={s.id} onClick={() => abrir(s.id)} aria-label={s.titulo}
              className={`relative shrink-0 rounded-full px-2.5 py-1.5 text-base transition ${
                actual.id === s.id ? 'bg-marca text-sobre-marca shadow' : 'bg-superficie ring-1 ring-slate-200'}`}>
              {s.icono}
              {s.insignia > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500" />}
            </button>
          ))}
        </FilaDeslizable>
        </div>
      </div>
      {actual.id !== 'ajustes' && <h2 className="text-lg font-bold text-slate-900">{actual.icono} {actual.titulo}</h2>}
      <div key={actual.id} className="animar-entrada">
        <Actual avisar={avisar} onPendientes={onPendientes} />
      </div>
    </div>
  )
}

function Desbloquear({ usuario, onListo }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await entrarConClave(usuario, clave)
      onListo()
    } catch (err) {
      setError(mensajeError(err))
      setClave('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="animar-entrada tarjeta mx-auto mt-6 max-w-sm space-y-4 text-center">
      <div className="animar-pop text-5xl">🔒</div>
      <div>
        <h2 className="text-lg font-bold text-slate-900">Panel bloqueado</h2>
        <p className="text-sm text-slate-500">
          Por seguridad se bloquea tras {MINUTOS_BLOQUEO} minutos sin uso. Escribe tu PIN o contraseña para seguir.
        </p>
      </div>
      <CampoClave id="desbloquear" value={clave} onChange={setClave} autoFocus />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={enviando || clave.length < 6} className="btn-primario w-full">{enviando ? 'Revisando…' : 'Desbloquear'}</button>
    </form>
  )
}
