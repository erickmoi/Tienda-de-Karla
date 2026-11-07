import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { puede, useAuth } from '../../lib/auth'
import { dinero, mensajeError } from '../../lib/format'
import { Cargando, Hoja, Vacio } from '../../components/ui'
import ListaCompras, { ListaPagos, SELECT_COMPRAS, SELECT_PAGOS } from '../../components/ListaCompras'
import { useApariencia } from '../../lib/apariencia'
import { invocar } from '../../lib/funciones'

// wa.me con el número (se asume El Salvador, 503, si tiene 8 dígitos) o sin número para elegir contacto
function enlaceWhatsApp(cliente, telefono, tienda) {
  const texto = `Hola ${cliente.nombre.split(' ')[0]} 👋, tu saldo pendiente en ${tienda} es de ${dinero(cliente.saldo)}. ¡Gracias!`
  const numero = telefono ? (telefono.length === 8 ? `503${telefono}` : telefono) : ''
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

export default function Deudores({ avisar }) {
  const [saldos, setSaldos] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [soloDeudores, setSoloDeudores] = useState(true)
  const [abierto, setAbierto] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('obtener_saldos')
    if (error) return avisar('error', mensajeError(error))
    setSaldos(data.map((s) => ({ ...s, saldo: Number(s.saldo) })))
  }, [avisar])

  useEffect(() => { cargar() }, [cargar])

  const lista = useMemo(() => {
    if (!saldos) return []
    const q = busqueda.trim().toLowerCase()
    return saldos
      .filter((s) => !soloDeudores || s.saldo !== 0)
      .filter((s) => !q || s.nombre.toLowerCase().includes(q) || s.usuario.includes(q))
  }, [saldos, busqueda, soloDeudores])

  if (!saldos) return <Cargando />

  const totalPorCobrar = saldos.reduce((s, x) => s + Math.max(0, x.saldo), 0)
  const totalAFavor = saldos.reduce((s, x) => s + Math.max(0, -x.saldo), 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="tarjeta">
          <p className="text-xs text-slate-500">Por cobrar</p>
          <p className="text-2xl font-bold text-rose-600">{dinero(totalPorCobrar)}</p>
        </div>
        <div className="tarjeta">
          <p className="text-xs text-slate-500">Saldos a favor</p>
          <p className="text-2xl font-bold text-emerald-600">{dinero(totalAFavor)}</p>
        </div>
      </div>

      <input className="input" placeholder="Buscar por nombre o usuario" value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={soloDeudores} onChange={(e) => setSoloDeudores(e.target.checked)} />
        Ocultar a quienes están al día
      </label>

      {lista.length === 0 ? (
        <Vacio>Nadie por aquí.</Vacio>
      ) : (
        <ul className="escalonado space-y-2">
          {lista.map((s) => (
            <li key={s.usuario_id}>
              <button onClick={() => setAbierto(s)} className="tarjeta flex w-full items-center justify-between p-3 text-left">
                <div>
                  <p className="font-semibold">{s.nombre}</p>
                  <p className="text-xs text-slate-500">@{s.usuario}</p>
                </div>
                <p className={`font-bold ${s.saldo > 0 ? 'text-rose-600' : s.saldo < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {s.saldo < 0 ? 'A favor ' : ''}{dinero(Math.abs(s.saldo))}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <DetalleCliente
          cliente={abierto}
          avisar={avisar}
          onCerrar={() => setAbierto(null)}
          onCambio={async () => {
            await cargar()
            setAbierto(null)
          }}
        />
      )}
    </div>
  )
}

function DetalleCliente({ cliente, avisar, onCerrar, onCambio }) {
  const { perfil } = useAuth()
  const puedePagar = puede(perfil, 'pagos')
  const puedeCorregir = puede(perfil, 'compras')
  const [datos, setDatos] = useState(null)
  const [pestana, setPestana] = useState('compras')
  const [monto, setMonto] = useState(cliente.saldo > 0 ? cliente.saldo.toFixed(2) : '')
  const [metodo, setMetodo] = useState('efectivo')
  const [referencia, setReferencia] = useState('')
  const [tipo, setTipo] = useState('pago')
  const [guardando, setGuardando] = useState(false)
  const [telefono, setTelefono] = useState(null)
  const [recordando, setRecordando] = useState(false)
  const { apariencia: { nombre_tienda: nombreTienda } } = useApariencia()

  const cargar = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('compras').select(SELECT_COMPRAS).eq('usuario_id', cliente.usuario_id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('pagos').select(SELECT_PAGOS).eq('usuario_id', cliente.usuario_id)
        .order('created_at', { ascending: false }).limit(50),
    ])
    if (c.error || p.error) return avisar('error', mensajeError(c.error || p.error))
    setDatos({ compras: c.data, pagos: p.data })
  }, [cliente.usuario_id, avisar])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    supabase.from('perfiles').select('telefono').eq('id', cliente.usuario_id).maybeSingle()
      .then(({ data }) => setTelefono(data?.telefono ?? null))
  }, [cliente.usuario_id])

  async function recordar() {
    setRecordando(true)
    try {
      await invocar('notificar', { accion: 'recordar', usuario_id: cliente.usuario_id })
      avisar('ok', `Aviso enviado a ${cliente.nombre.split(' ')[0]}.`)
    } catch (err) {
      avisar('error', err.message)
    } finally {
      setRecordando(false)
    }
  }

  async function registrarPago(e) {
    e.preventDefault()
    const valor = Number(monto)
    if (!(valor > 0)) return avisar('error', 'Escribe un monto mayor que cero.')
    setGuardando(true)
    const { error } = await supabase.rpc('registrar_pago', {
      p_usuario_id: cliente.usuario_id,
      p_monto: valor,
      p_metodo: metodo,
      p_referencia: referencia || null,
      p_tipo: tipo,
    })
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', `${tipo === 'pago' ? 'Pago' : 'Devolución'} de ${dinero(valor)} registrado.`)
    onCambio()
  }

  async function anular(compra) {
    if (!confirm(`¿Anular la compra de ${dinero(compra.total)}? El stock se devuelve.`)) return
    const { error } = await supabase.rpc('anular_compra', { p_compra_id: compra.id })
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', 'Compra anulada.')
    onCambio()
  }

  return (
    <Hoja titulo={cliente.nombre} onCerrar={onCerrar}>
      <p className="mb-4 text-sm text-slate-600">
        {cliente.saldo > 0 && <>Debe <b className="text-rose-600">{dinero(cliente.saldo)}</b></>}
        {cliente.saldo < 0 && <>Saldo a favor <b className="text-emerald-600">{dinero(-cliente.saldo)}</b></>}
        {cliente.saldo === 0 && 'Está al día.'}
      </p>

      {cliente.saldo > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          <a href={enlaceWhatsApp(cliente, telefono, nombreTienda)} target="_blank" rel="noopener noreferrer"
            className="btn flex items-center justify-center gap-1.5 bg-emerald-600 text-sm text-white">
            💬 WhatsApp
          </a>
          <button type="button" onClick={recordar} disabled={recordando} className="btn-secundario text-sm">
            {recordando ? 'Enviando…' : '🔔 Recordar'}
          </button>
          {!telefono && (
            <p className="col-span-2 text-xs text-slate-500">
              No tiene número guardado: WhatsApp te dejará elegir el contacto.
            </p>
          )}
        </div>
      )}

      {puedePagar && (
        <form onSubmit={registrarPago} className="mb-5 space-y-3 rounded-2xl bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
            {[['pago', 'Recibir pago'], ['devolucion', 'Devolver saldo']].map(([k, t]) => (
              <button type="button" key={k} onClick={() => setTipo(k)}
                className={`rounded-lg py-2 ${tipo === k ? 'bg-marca text-sobre-marca' : 'bg-superficie ring-1 ring-slate-200'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="etiqueta" htmlFor="monto">Monto ($)</label>
              <input id="monto" className="input" type="number" inputMode="decimal" step="0.01" min="0.01"
                value={monto} onChange={(e) => setMonto(e.target.value)} />
            </div>
            {tipo === 'pago' && cliente.saldo > 0 && (
              <button type="button" onClick={() => setMonto(cliente.saldo.toFixed(2))}
                className="btn-secundario self-end text-sm">
                Pagar todo
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
            <input className="input" placeholder="Referencia (opcional)" maxLength={100}
              value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>
          <button disabled={guardando} className="btn-primario w-full">
            {guardando ? 'Guardando…' : tipo === 'pago' ? 'Registrar pago' : 'Registrar devolución'}
          </button>
        </form>
      )}

      <div className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {[['compras', 'Compras'], ['pagos', 'Pagos']].map(([k, t]) => (
          <button key={k} onClick={() => setPestana(k)}
            className={`rounded-lg py-2 ${pestana === k ? 'bg-superficie text-marca-texto shadow' : 'text-slate-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {!datos ? <Cargando /> : pestana === 'compras' ? (
        <ListaCompras
          compras={datos.compras}
          accion={puedeCorregir ? (c) => (
            <button onClick={() => anular(c)} className="btn-peligro mt-2 w-full py-1.5 text-sm">Anular compra</button>
          ) : undefined}
        />
      ) : (
        <ListaPagos pagos={datos.pagos} />
      )}
    </Hoja>
  )
}
