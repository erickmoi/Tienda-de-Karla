import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/format'
import { Cargando } from '../../components/ui'

export default function Ajustes({ avisar }) {
  const [f, setF] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('ajustes').select('*').maybeSingle().then(({ data, error }) => {
      if (error) avisar('error', mensajeError(error))
      else setF(data)
    })
  }, [avisar])

  if (!f) return <Cargando />

  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('ajustes').update({
      nombre_tienda: f.nombre_tienda.trim() || 'Tienda de Karla',
      permitir_saldo_favor: f.permitir_saldo_favor,
      mostrar_deudas: f.mostrar_deudas,
      minutos_borrar: Math.min(60, Math.max(0, parseInt(f.minutos_borrar, 10) || 0)),
    }).eq('id', 1)
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', 'Ajustes guardados.')
  }

  return (
    <form onSubmit={guardar} className="tarjeta space-y-4">
      <div>
        <label className="etiqueta" htmlFor="anombre">Nombre de la tienda</label>
        <input id="anombre" className="input" maxLength={60} value={f.nombre_tienda} onChange={set('nombre_tienda')} />
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={f.permitir_saldo_favor} onChange={set('permitir_saldo_favor')} />
        <span>
          <span className="block font-medium">Permitir saldo a favor</span>
          <span className="text-sm text-slate-500">Aceptar pagos por adelantado que se descuentan en cada compra.</span>
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1" checked={f.mostrar_deudas} onChange={set('mostrar_deudas')} />
        <span>
          <span className="block font-medium">Mostrar deudas entre clientes</span>
          <span className="text-sm text-slate-500">Si se activa, todos podrán ver cuánto debe cada uno.</span>
        </span>
      </label>
      <div>
        <label className="etiqueta" htmlFor="amin">Minutos para que un cliente borre su compra</label>
        <input id="amin" className="input" type="number" min="0" max="60" value={f.minutos_borrar} onChange={set('minutos_borrar')} />
      </div>
      <button disabled={guardando} className="btn-primario w-full">{guardando ? 'Guardando…' : 'Guardar ajustes'}</button>
    </form>
  )
}
