import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dinero, mensajeError } from '../lib/format'
import { Cargando } from '../components/ui'
import ListaCompras, { ListaPagos, SELECT_COMPRAS, SELECT_PAGOS } from '../components/ListaCompras'

export default function MiCuenta({ avisar }) {
  const { perfil } = useAuth()
  const [datos, setDatos] = useState(null)
  const [pestana, setPestana] = useState('compras')
  const [ahora, setAhora] = useState(Date.now())

  const cargar = useCallback(async () => {
    const [saldo, compras, pagos, ajustes] = await Promise.all([
      supabase.rpc('mi_saldo'),
      supabase.from('compras').select(SELECT_COMPRAS).eq('usuario_id', perfil.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('pagos').select(SELECT_PAGOS).eq('usuario_id', perfil.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('ajustes').select('minutos_borrar').maybeSingle(),
    ])
    const err = saldo.error || compras.error || pagos.error || ajustes.error
    if (err) return avisar('error', mensajeError(err))
    setDatos({
      saldo: Number(saldo.data ?? 0),
      compras: compras.data,
      pagos: pagos.data,
      minutos: ajustes.data?.minutos_borrar ?? 5,
    })
  }, [perfil.id, avisar])

  useEffect(() => { cargar() }, [cargar])

  // Refresca el reloj para ocultar el botón "Borrar" cuando vence el plazo
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  async function borrar(compra) {
    if (!confirm(`¿Borrar la compra de ${dinero(compra.total)}?`)) return
    const { error } = await supabase.rpc('anular_compra', { p_compra_id: compra.id })
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', 'Compra borrada.')
    cargar()
  }

  if (!datos) return <Cargando />

  const debe = datos.saldo > 0
  const aFavor = datos.saldo < 0

  return (
    <div className="space-y-5 pb-24">
      <div className={`rounded-3xl p-5 text-white shadow ${debe ? 'bg-rose-600' : aFavor ? 'bg-emerald-600' : 'bg-marca'}`}>
        <p className="text-sm opacity-90">Hola, {perfil.nombre}</p>
        <p className="mt-1 text-sm opacity-90">{debe ? 'Debes' : aFavor ? 'Saldo a favor' : 'Estás al día'}</p>
        <p className="text-4xl font-bold">{dinero(Math.abs(datos.saldo))}</p>
      </div>

      <div className="grid grid-cols-2 rounded-xl bg-slate-200/60 p-1 text-sm font-semibold">
        {[['compras', 'Mis compras'], ['pagos', 'Mis pagos']].map(([k, t]) => (
          <button key={k} onClick={() => setPestana(k)}
            className={`rounded-lg py-2 ${pestana === k ? 'bg-white text-marca shadow' : 'text-slate-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {pestana === 'compras' ? (
        <ListaCompras
          compras={datos.compras}
          accion={(c) => {
            const vence = new Date(c.created_at).getTime() + datos.minutos * 60000
            if (ahora > vence) return null
            const restan = Math.max(1, Math.ceil((vence - ahora) / 60000))
            return (
              <button onClick={() => borrar(c)} className="btn-peligro mt-2 w-full py-1.5 text-sm">
                Borrar (quedan {restan} min)
              </button>
            )
          }}
        />
      ) : (
        <ListaPagos pagos={datos.pagos} />
      )}
    </div>
  )
}
