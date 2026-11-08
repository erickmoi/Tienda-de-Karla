import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dinero, mensajeError } from '../../lib/format'
import { etiquetaPromo } from '../../lib/promos'
import { Cargando, Hoja, Interruptor, Vacio } from '../../components/ui'
import Icono from '../../components/Icono'

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const hoySV = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(new Date())

export default function Promociones({ avisar }) {
  const [promos, setPromos] = useState(null)
  const [productos, setProductos] = useState([])
  const [editando, setEditando] = useState(null)

  const cargar = useCallback(async () => {
    const [pr, p] = await Promise.all([
      supabase.from('promociones').select('*, promocion_productos(producto_id, cantidad)').order('orden').order('id'),
      supabase.from('productos').select('id, nombre, precio, categoria_id, activo').order('nombre'),
    ])
    if (pr.error || p.error) return avisar('error', mensajeError(pr.error || p.error))
    setPromos(pr.data)
    setProductos(p.data)
  }, [avisar])

  useEffect(() => { cargar() }, [cargar])

  if (!promos) return <Cargando />
  const porId = Object.fromEntries(productos.map((p) => [p.id, p]))
  const hoy = hoySV()
  const estado = (pr) =>
    !pr.activo ? ['Pausada', 'bg-slate-200 text-slate-600']
      : pr.hasta && pr.hasta < hoy ? ['Vencida', 'bg-slate-200 text-slate-600']
      : pr.desde && pr.desde > hoy ? ['Programada', 'bg-blue-100 text-blue-700']
      : ['Activa', 'bg-emerald-100 text-emerald-700']

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-orange-50 p-3 text-sm text-orange-800 ring-1 ring-orange-200">
        Las promociones activas aparecen en el botón de <b>fuego (Promos)</b> del menú y con una etiqueta en cada producto.
        El descuento se calcula solo en el carrito.
      </div>
      <button onClick={() => setEditando({ nombre: '', tipo: 'cantidad', cantidad: 2, precio: '', activo: true, desde: '', hasta: '', productos: {} })}
        className="btn-primario w-full">+ Nueva promoción</button>

      {promos.length === 0 ? <Vacio>Aún no hay promociones.</Vacio> : (
        <ul className="escalonado space-y-2">
          {promos.map((pr) => {
            const [txt, cls] = estado(pr)
            return (
              <li key={pr.id}>
                <button onClick={() => setEditando({
                  ...pr, desde: pr.desde ?? '', hasta: pr.hasta ?? '',
                  productos: Object.fromEntries(pr.promocion_productos.map((pp) => [pp.producto_id, pp.cantidad])),
                })} className="tarjeta w-full p-3 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900"><Icono n="promo" size={16} className="mr-1 -mt-0.5 align-middle text-orange-500" />{pr.nombre}</p>
                      <p className="truncate text-xs text-slate-500">
                        {pr.promocion_productos.map((pp) => porId[pp.producto_id]?.nombre).filter(Boolean).join(', ') || 'Sin productos'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-orange-600">{etiquetaPromo(pr)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{txt}</span>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editando && (
        <EditarPromo promo={editando} productos={productos} avisar={avisar}
          onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar() }} />
      )}
    </div>
  )
}

function EditarPromo({ promo, productos, avisar, onCerrar, onGuardado }) {
  const nueva = !promo.id
  const [f, setF] = useState(promo)
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const elegidos = Object.keys(f.productos).map(Number)

  const lista = useMemo(() => {
    const q = sinAcentos(busqueda.trim())
    return productos
      .filter((p) => p.activo && (!q || sinAcentos(p.nombre).includes(q)))
      .sort((a, b) => Number(!(a.id in f.productos)) - Number(!(b.id in f.productos)) || a.nombre.localeCompare(b.nombre))
  }, [productos, busqueda, f.productos])

  const alternar = (id) => setF((x) => {
    const p = { ...x.productos }
    if (id in p) delete p[id]
    else p[id] = 1
    return { ...x, productos: p }
  })

  // Precio normal, para mostrar el ahorro
  const normal = f.tipo === 'combo'
    ? elegidos.reduce((s, id) => s + Number(productos.find((p) => p.id === id)?.precio ?? 0) * (f.productos[id] || 1), 0)
    : Math.max(0, ...elegidos.map((id) => Number(productos.find((p) => p.id === id)?.precio ?? 0))) * Number(f.cantidad || 0)
  const ahorro = normal - Number(f.precio || 0)

  async function guardar(e) {
    e.preventDefault()
    if (!f.nombre.trim()) return avisar('error', 'Ponle un nombre a la promoción.')
    if (!(Number(f.precio) > 0)) return avisar('error', 'Escribe el precio de la promoción.')
    if (!elegidos.length) return avisar('error', 'Elige al menos un producto.')
    if (f.tipo === 'combo' && elegidos.length < 2 && (f.productos[elegidos[0]] ?? 1) < 2)
      return avisar('error', 'Un combo necesita al menos 2 productos (o 2 unidades).')
    if (f.tipo === 'cantidad' && !(Number(f.cantidad) >= 2)) return avisar('error', 'La cantidad debe ser 2 o más.')
    if (ahorro <= 0) return avisar('error', 'El precio de la promoción debe ser menor que el precio normal.')

    setGuardando(true)
    try {
      const fila = {
        nombre: f.nombre.trim(),
        tipo: f.tipo,
        cantidad: f.tipo === 'cantidad' ? Number(f.cantidad) : null,
        precio: Number(f.precio),
        activo: f.activo,
        desde: f.desde || null,
        hasta: f.hasta || null,
      }
      let id = promo.id
      if (nueva) {
        const { data, error } = await supabase.from('promociones').insert(fila).select('id').single()
        if (error) throw error
        id = data.id
      } else {
        const { error } = await supabase.from('promociones').update(fila).eq('id', id)
        if (error) throw error
        const { error: e2 } = await supabase.from('promocion_productos').delete().eq('promocion_id', id)
        if (e2) throw e2
      }
      const { error: e3 } = await supabase.from('promocion_productos').insert(
        elegidos.map((pid) => ({ promocion_id: id, producto_id: pid, cantidad: f.tipo === 'combo' ? f.productos[pid] || 1 : 1 })),
      )
      if (e3) throw e3
      avisar('ok', nueva ? 'Promoción creada.' : 'Promoción actualizada.')
      onGuardado()
    } catch (err) {
      avisar('error', mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!confirm(`¿Borrar la promoción “${promo.nombre}”? Las compras pasadas conservan su descuento.`)) return
    const { error } = await supabase.from('promociones').update({ activo: false }).eq('id', promo.id)
    if (error) return avisar('error', mensajeError(error))
    const { error: e2 } = await supabase.from('promociones').delete().eq('id', promo.id)
    // Si ya se usó en compras no se puede borrar del todo: queda pausada
    avisar('ok', e2 ? 'La promoción ya se usó en compras, así que quedó pausada.' : 'Promoción borrada.')
    onGuardado()
  }

  return (
    <Hoja titulo={nueva ? 'Nueva promoción' : 'Editar promoción'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label className="etiqueta" htmlFor="pnom">Nombre</label>
          <input id="pnom" className="input" maxLength={60} placeholder="ej. Hojitas 2 por $0.25" value={f.nombre}
            onChange={(e) => set('nombre', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
          {[['cantidad', 'Varios por $', 'ej. 2 por $0.25'], ['combo', 'Combo', 'ej. Coca + Diana']].map(([k, t, d]) => (
            <button key={k} type="button" onClick={() => set('tipo', k)}
              className={`rounded-xl p-2.5 text-left transition ${f.tipo === k ? 'bg-marca text-sobre-marca shadow' : 'bg-slate-100 text-slate-700'}`}>
              {t}<span className="block text-xs font-normal opacity-80">{d}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {f.tipo === 'cantidad' && (
            <div>
              <label className="etiqueta" htmlFor="pcant">Lleva (unidades)</label>
              <input id="pcant" className="input" type="number" min="2" max="50" value={f.cantidad}
                onChange={(e) => set('cantidad', e.target.value)} />
            </div>
          )}
          <div className={f.tipo === 'combo' ? 'col-span-2' : ''}>
            <label className="etiqueta" htmlFor="pprecio">Por ($)</label>
            <input id="pprecio" className="input" type="number" inputMode="decimal" step="0.01" min="0.01" value={f.precio}
              onChange={(e) => set('precio', e.target.value)} />
          </div>
        </div>
        {elegidos.length > 0 && Number(f.precio) > 0 && (
          <p className={`text-sm ${ahorro > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {ahorro > 0 ? `Precio normal ${dinero(normal)} → ahorran ${dinero(ahorro)}` : 'El precio de la promoción no es menor que el normal.'}
          </p>
        )}

        <div>
          <p className="etiqueta">
            Productos {f.tipo === 'cantidad' ? '(pueden combinarse entre sí)' : 'del combo'} · {elegidos.length} elegidos
          </p>
          <input className="input mb-2" type="search" placeholder="Buscar producto" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} />
          <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-slate-200">
            {lista.map((p) => {
              const marcado = p.id in f.productos
              return (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <input type="checkbox" checked={marcado} onChange={() => alternar(p.id)} />
                    <span className="truncate text-slate-800">{p.nombre}</span>
                    <span className="shrink-0 text-xs text-slate-500">{dinero(p.precio)}</span>
                  </label>
                  {f.tipo === 'combo' && marcado && (
                    <input type="number" min="1" max="20" aria-label="Unidades en el combo"
                      className="w-14 rounded-lg border border-slate-300 bg-superficie px-2 py-1 text-sm text-slate-900"
                      value={f.productos[p.id]}
                      onChange={(e) => setF((x) => ({ ...x, productos: { ...x.productos, [p.id]: Math.max(1, Number(e.target.value) || 1) } }))} />
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="etiqueta" htmlFor="pdesde">Desde (opcional)</label>
            <input id="pdesde" className="input" type="date" value={f.desde} onChange={(e) => set('desde', e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="phasta">Hasta (opcional)</label>
            <input id="phasta" className="input" type="date" value={f.hasta} onChange={(e) => set('hasta', e.target.value)} />
          </div>
        </div>
        <Interruptor activo={f.activo} onCambio={(v) => set('activo', v)} etiqueta="Promoción activa" />

        <button disabled={guardando} className="btn-primario w-full">{guardando ? 'Guardando…' : 'Guardar promoción'}</button>
        {!nueva && <button type="button" onClick={borrar} className="w-full py-2 text-sm font-semibold text-red-600">Borrar promoción</button>}
      </form>
    </Hoja>
  )
}
