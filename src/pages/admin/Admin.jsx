import { useState } from 'react'
import { puede, useAuth } from '../../lib/auth'
import Deudores from './Deudores'
import Productos from './Productos'
import Ajustes from './Ajustes'

export default function Admin({ avisar }) {
  const { perfil } = useAuth()
  const secciones = [
    { id: 'deudores', titulo: 'Deudores', ver: puede(perfil, 'deudores') || puede(perfil, 'pagos'), C: Deudores },
    { id: 'productos', titulo: 'Productos', ver: puede(perfil, 'productos') || puede(perfil, 'inventario'), C: Productos },
    { id: 'ajustes', titulo: 'Ajustes', ver: puede(perfil, 'ajustes'), C: Ajustes },
  ].filter((s) => s.ver)
  const [activa, setActiva] = useState(secciones[0]?.id)

  if (!secciones.length) return <p className="py-10 text-center text-slate-500">No tienes permisos de administración.</p>
  const Actual = secciones.find((s) => s.id === activa)?.C ?? secciones[0].C

  return (
    <div className="space-y-4 pb-24">
      <div className="flex gap-2 overflow-x-auto">
        {secciones.map((s) => (
          <button key={s.id} onClick={() => setActiva(s.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${
              activa === s.id ? 'bg-marca text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}>
            {s.titulo}
          </button>
        ))}
      </div>
      <Actual avisar={avisar} />
    </div>
  )
}
