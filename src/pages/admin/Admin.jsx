import { useState } from 'react'
import { esJefatura, puede, useAuth } from '../../lib/auth'
import { vibrar } from '../../lib/tema'
import Deudores from './Deudores'
import Productos from './Productos'
import Estadisticas from './Estadisticas'
import Usuarios from './Usuarios'
import Ajustes from './Ajustes'
import Bitacora from './Bitacora'
import Promociones from './Promociones'
import Caja from './Caja'

export default function Admin({ avisar, pendientes = 0, onPendientes }) {
  const { perfil } = useAuth()
  const secciones = [
    { id: 'deudores', titulo: '💵 Deudores', insignia: pendientes, ver: puede(perfil, 'deudores') || puede(perfil, 'pagos'), C: Deudores },
    { id: 'caja', titulo: '💰 Caja', ver: puede(perfil, 'pagos') || puede(perfil, 'estadisticas'), C: Caja },
    { id: 'productos', titulo: '🏷️ Productos', ver: puede(perfil, 'productos') || puede(perfil, 'inventario'), C: Productos },
    { id: 'promos', titulo: '🔥 Promos', ver: puede(perfil, 'productos'), C: Promociones },
    { id: 'estadisticas', titulo: '📊 Estadísticas', ver: puede(perfil, 'estadisticas'), C: Estadisticas },
    { id: 'usuarios', titulo: '👥 Usuarios', ver: puede(perfil, 'usuarios'), C: Usuarios },
    { id: 'ajustes', titulo: '🎨 Ajustes', ver: puede(perfil, 'ajustes'), C: Ajustes },
    { id: 'bitacora', titulo: '📜 Bitácora', ver: esJefatura(perfil), C: Bitacora },
  ].filter((s) => s.ver)
  const [activa, setActiva] = useState(secciones[0]?.id)

  if (!secciones.length) return <p className="py-10 text-center text-slate-500">No tienes permisos de administración.</p>
  const actual = secciones.find((s) => s.id === activa) ?? secciones[0]
  const Actual = actual.C

  return (
    <div className="space-y-4 pb-28">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {secciones.map((s) => (
          <button key={s.id} onClick={() => { vibrar(6); setActiva(s.id) }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
              actual.id === s.id ? 'scale-105 bg-marca text-sobre-marca shadow' : 'bg-superficie text-slate-600 ring-1 ring-slate-200'
            }`}>
            {s.titulo}
            {s.insignia > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{s.insignia}</span>
            )}
          </button>
        ))}
      </div>
      <div key={actual.id} className="animar-entrada">
        <Actual avisar={avisar} onPendientes={onPendientes} />
      </div>
    </div>
  )
}
