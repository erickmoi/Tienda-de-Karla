import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { puede, useAuth } from '../../lib/auth'
import { dinero, mensajeError } from '../../lib/format'
import FilaDeslizable from '../../components/FilaDeslizable'
import { Cargando, Hoja, Vacio } from '../../components/ui'
import { borrarFoto, prepararFoto, subirFoto } from '../../lib/fotos'

const sinAcentos = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const EMOJIS_CAT = ['🍿', '🍬', '🍪', '🥐', '🥤', '🍫', '🍭', '🧃', '☕', '🍞', '🥜', '🧁', '🍦', '🌮', '🛍️']

const VACIO = { nombre: '', categoria_id: '', precio: '', costo: '', foto_url: null, agotado_manual: false, activo: true }

export default function Productos({ avisar }) {
  const { perfil } = useAuth()
  const puedeEditar = puede(perfil, 'productos')
  const puedeInventario = puede(perfil, 'inventario')
  const [productos, setProductos] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [editando, setEditando] = useState(null) // objeto producto o VACIO
  const [stockDe, setStockDe] = useState(null)
  const [verCategorias, setVerCategorias] = useState(false)
  const [verConteo, setVerConteo] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todas') // id de categoría, 'todas', 'agotados', 'sincosto'
  const [lote, setLote] = useState(null) // Set de ids seleccionados, o null si no está en modo lote
  const [verLote, setVerLote] = useState(false)

  const cargar = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from('productos').select('*').order('nombre'),
      supabase.from('categorias').select('*').order('orden').order('nombre'),
    ])
    if (p.error || c.error) return avisar('error', mensajeError(p.error || c.error))
    setProductos(p.data)
    setCategorias(c.data)
  }, [avisar])

  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    if (!productos) return []
    const q = sinAcentos(busqueda.trim())
    return productos.filter((p) =>
      (!q || sinAcentos(p.nombre).includes(q)) &&
      (filtro === 'todas' ? true
        : filtro === 'agotados' ? p.agotado
        : filtro === 'sincosto' ? !(Number(p.costo) > 0)
        : p.categoria_id === filtro))
  }, [productos, busqueda, filtro])

  if (!productos) return <Cargando />

  const cat = (id) => categorias.find((c) => c.id === id)
  const alternarLote = (id) => setLote((l) => {
    const n = new Set(l)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const filtros = [
    { id: 'todas', nombre: `Todos (${productos.length})` },
    ...categorias.map((c) => ({ id: c.id, nombre: `${c.emoji} ${c.nombre}` })),
    { id: 'agotados', nombre: `⛔ Agotados (${productos.filter((p) => p.agotado).length})` },
    { id: 'sincosto', nombre: `❔ Sin costo (${productos.filter((p) => !(Number(p.costo) > 0)).length})` },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {puedeEditar && <button onClick={() => setEditando(VACIO)} className="btn-primario py-2 text-sm">+ Producto</button>}
        {puedeInventario && <button onClick={() => setVerConteo(true)} className="btn-secundario py-2 text-sm">📋 Conteo</button>}
        {puedeEditar && (
          <button onClick={() => (lote ? setLote(null) : setLote(new Set()))}
            className={`${lote ? 'btn-primario' : 'btn-secundario'} py-2 text-sm`}>
            {lote ? '✕ Salir de lote' : '☑️ Editar en lote'}
          </button>
        )}
        {puedeEditar && <button onClick={() => setVerCategorias(true)} className="btn-secundario py-2 text-sm">🗂️ Categorías</button>}
      </div>

      <input className="input" type="search" placeholder="Buscar producto" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <FilaDeslizable sangria>
        {filtros.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              filtro === f.id ? 'bg-slate-800 text-slate-50' : 'bg-superficie text-slate-600 ring-1 ring-slate-200'}`}>
            {f.nombre}
          </button>
        ))}
      </FilaDeslizable>

      {lote && (
        <div className="flex items-center justify-between rounded-xl bg-marca-claro px-3 py-2 text-sm">
          <span className="font-semibold text-marca-texto">{lote.size} seleccionados</span>
          <span className="flex gap-3">
            <button onClick={() => setLote(new Set(visibles.map((p) => p.id)))} className="font-semibold text-marca-texto">Todos</button>
            <button onClick={() => setLote(new Set())} className="font-semibold text-slate-500">Ninguno</button>
          </span>
        </div>
      )}

      {visibles.length === 0 ? (
        <Vacio>{productos.length ? 'Ningún producto coincide.' : 'Aún no hay productos. Crea el primero.'}</Vacio>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-superficie ring-1 ring-slate-200">
          {visibles.map((p) => {
            const c = cat(p.categoria_id)
            const elegido = lote?.has(p.id)
            return (
              <li key={p.id} className={`flex items-center gap-3 px-3 py-2 ${p.activo ? '' : 'opacity-50'} ${elegido ? 'bg-marca-claro' : ''}`}>
                {lote && <input type="checkbox" checked={elegido} onChange={() => alternarLote(p.id)} aria-label={`Elegir ${p.nombre}`} />}
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => (lote ? alternarLote(p.id) : puedeEditar && setEditando(p))}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-marca-claro text-lg">
                    {p.foto_url ? <img src={p.foto_url} alt="" className="h-full w-full object-cover" /> : c?.emoji ?? '🛍️'}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{p.nombre}</span>
                    <span className="block text-xs text-slate-500">
                      {dinero(p.precio)}{Number(p.costo) > 0 ? ` · costo ${dinero(p.costo)}` : ' · sin costo'}{!p.activo && ' · oculto'}
                    </span>
                  </span>
                </button>
                {!lote && (
                  <button onClick={() => puedeInventario && setStockDe(p)} disabled={!puedeInventario}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
                      p.agotado ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                    {p.agotado ? (p.agotado_manual ? '⛔' : '0') : p.stock}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!lote && <p className="text-center text-xs text-slate-500">Toca un producto para editarlo, o el número para ajustar su inventario.</p>}

      {lote && lote.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
          <button onClick={() => setVerLote(true)} className="btn-primario w-full max-w-lg shadow-lg">
            Cambiar {lote.size} productos
          </button>
        </div>
      )}

      {editando && (
        <FormProducto producto={editando} categorias={categorias} avisar={avisar}
          onCerrar={() => setEditando(null)} onGuardado={() => { setEditando(null); cargar() }} />
      )}
      {stockDe && (
        <FormInventario producto={stockDe} avisar={avisar}
          onCerrar={() => setStockDe(null)} onGuardado={() => { setStockDe(null); cargar() }} />
      )}
      {verCategorias && (
        <Categorias categorias={categorias} avisar={avisar} onCerrar={() => setVerCategorias(false)} onCambio={cargar} />
      )}
      {verConteo && (
        <Conteo productos={productos} categorias={categorias} avisar={avisar}
          onCerrar={() => setVerConteo(false)} onGuardado={() => { setVerConteo(false); cargar() }} />
      )}
      {verLote && (
        <EdicionLote ids={[...lote]} categorias={categorias} avisar={avisar} onCerrar={() => setVerLote(false)}
          onGuardado={() => { setVerLote(false); setLote(null); cargar() }} />
      )}
    </div>
  )
}

// Conteo físico: escribe lo que hay y se ajusta todo de una vez
function Conteo({ productos, categorias, avisar, onCerrar, onGuardado }) {
  const [valores, setValores] = useState(() => Object.fromEntries(productos.map((p) => [p.id, String(p.stock)])))
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambios = productos.filter((p) => valores[p.id] !== '' && Number(valores[p.id]) !== p.stock)
  const q = sinAcentos(busqueda.trim())
  const grupos = categorias.map((c) => ({ c, ps: productos.filter((p) => p.categoria_id === c.id && p.activo) }))
  const sinCat = productos.filter((p) => p.activo && !categorias.some((c) => c.id === p.categoria_id))
  if (sinCat.length) grupos.push({ c: { id: 0, nombre: 'Sin categoría', emoji: '🛍️' }, ps: sinCat })

  async function guardar() {
    if (!cambios.length) return onCerrar()
    if (!confirm(`¿Ajustar el inventario de ${cambios.length} productos?`)) return
    setGuardando(true)
    const { data, error } = await supabase.rpc('conteo_inventario', {
      p_conteo: cambios.map((p) => ({ producto_id: p.id, stock: Math.max(0, parseInt(valores[p.id], 10) || 0) })),
    })
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', `Inventario actualizado: ${data} productos.`)
    onGuardado()
  }

  return (
    <Hoja titulo="📋 Conteo de inventario" onCerrar={onCerrar}>
      <p className="mb-2 text-sm text-slate-500">Escribe cuántos hay de cada producto. Solo se guardan los que cambian.</p>
      <input className="input mb-3" type="search" placeholder="Buscar producto" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <div className="space-y-4">
        {grupos.map(({ c, ps }) => {
          const lista = ps.filter((p) => !q || sinAcentos(p.nombre).includes(q))
          if (!lista.length) return null
          return (
            <section key={c.id}>
              <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{c.emoji} {c.nombre}</h4>
              <ul className="divide-y divide-slate-100">
                {lista.map((p) => {
                  const cambio = valores[p.id] !== '' && Number(valores[p.id]) !== p.stock
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate text-sm text-slate-800">{p.nombre}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {cambio && <span className="text-xs text-slate-400 line-through">{p.stock}</span>}
                        <input type="number" inputMode="numeric" min="0" max="9999" aria-label={`Cantidad de ${p.nombre}`}
                          className={`w-16 rounded-lg border px-2 py-1 text-right text-sm font-bold tabular-nums ${
                            cambio ? 'border-marca bg-marca-claro text-marca-texto' : 'border-slate-300 bg-superficie text-slate-900'}`}
                          value={valores[p.id]} onFocus={(e) => e.target.select()}
                          onChange={(e) => setValores((v) => ({ ...v, [p.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
      <div className="sticky bottom-0 -mx-5 mt-4 bg-superficie px-5 pt-3">
        <button onClick={guardar} disabled={guardando} className="btn-primario w-full">
          {guardando ? 'Guardando…' : cambios.length ? `Guardar ${cambios.length} cambios` : 'Sin cambios'}
        </button>
      </div>
    </Hoja>
  )
}

// Cambiar costo, precio, categoría o visibilidad de varios productos a la vez
function EdicionLote({ ids, categorias, avisar, onCerrar, onGuardado }) {
  const [f, setF] = useState({ costo: '', precio: '', categoria_id: '', activo: '' })
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function guardar(e) {
    e.preventDefault()
    const cambios = {}
    if (f.costo !== '') cambios.costo = Number(f.costo)
    if (f.precio !== '') cambios.precio = Number(f.precio)
    if (f.categoria_id !== '') cambios.categoria_id = f.categoria_id === 'ninguna' ? null : Number(f.categoria_id)
    if (f.activo !== '') cambios.activo = f.activo === 'si'
    if (!Object.keys(cambios).length) return avisar('error', 'Elige al menos un cambio.')
    if ((cambios.costo ?? 0) < 0 || (cambios.precio ?? 0) < 0) return avisar('error', 'Los montos no pueden ser negativos.')
    if (!confirm(`¿Aplicar a ${ids.length} productos?`)) return
    setGuardando(true)
    const { error } = await supabase.from('productos').update(cambios).in('id', ids)
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', `${ids.length} productos actualizados.`)
    onGuardado()
  }

  return (
    <Hoja titulo={`Cambiar ${ids.length} productos`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <p className="text-sm text-slate-500">Deja en blanco lo que no quieras cambiar.</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="etiqueta" htmlFor="lcosto">Costo ($)</label>
            <input id="lcosto" className="input" type="number" inputMode="decimal" step="0.01" min="0" value={f.costo} onChange={set('costo')} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="lprecio">Precio ($)</label>
            <input id="lprecio" className="input" type="number" inputMode="decimal" step="0.01" min="0" value={f.precio} onChange={set('precio')} />
          </div>
        </div>
        <div>
          <label className="etiqueta" htmlFor="lcat">Categoría</label>
          <select id="lcat" className="input" value={f.categoria_id} onChange={set('categoria_id')}>
            <option value="">— Sin cambiar —</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
            <option value="ninguna">Sin categoría</option>
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="lact">Visible en el menú</label>
          <select id="lact" className="input" value={f.activo} onChange={set('activo')}>
            <option value="">— Sin cambiar —</option>
            <option value="si">Sí, visible</option>
            <option value="no">No, ocultar</option>
          </select>
        </div>
        <button disabled={guardando} className="btn-primario w-full">{guardando ? 'Guardando…' : 'Aplicar cambios'}</button>
      </form>
    </Hoja>
  )
}

function FormProducto({ producto, categorias, avisar, onCerrar, onGuardado }) {
  const nuevo = !producto.id
  const [f, setF] = useState({
    ...producto,
    categoria_id: producto.categoria_id ?? '',
    precio: producto.precio === '' ? '' : String(producto.precio),
    costo: producto.costo === '' ? '' : String(producto.costo),
  })
  const [guardando, setGuardando] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [vista, setVista] = useState(producto.foto_url)
  const [quitarFoto, setQuitarFoto] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function elegirFoto(e) {
    const a = e.target.files?.[0]
    if (!a) return
    try {
      const lista = await prepararFoto(a)
      setArchivo(lista)
      setQuitarFoto(false)
      setVista(lista.vista)
    } catch (err) {
      avisar('error', mensajeError(err))
    }
  }

  async function guardar(e) {
    e.preventDefault()
    if (!f.nombre.trim()) return avisar('error', 'Escribe el nombre.')
    if (!(Number(f.precio) >= 0) || f.precio === '') return avisar('error', 'Escribe un precio válido.')
    const fila = {
      nombre: f.nombre.trim(),
      categoria_id: f.categoria_id ? Number(f.categoria_id) : null,
      precio: Number(f.precio),
      costo: Number(f.costo || 0),
      agotado_manual: f.agotado_manual,
      activo: f.activo,
    }
    setGuardando(true)
    try {
      let id = producto.id
      if (nuevo) {
        const { data, error } = await supabase.from('productos').insert(fila).select('id').single()
        if (error) throw error
        id = data.id
      } else {
        const { error } = await supabase.from('productos').update(fila).eq('id', id)
        if (error) throw error
      }

      if (archivo) {
        const url = await subirFoto(id, archivo)
        const { error } = await supabase.from('productos').update({ foto_url: url }).eq('id', id)
        if (error) throw error
        if (producto.foto_url) await borrarFoto(producto.foto_url).catch(() => {})
      } else if (quitarFoto && producto.foto_url) {
        const { error } = await supabase.from('productos').update({ foto_url: null }).eq('id', id)
        if (error) throw error
        await borrarFoto(producto.foto_url).catch(() => {})
      }

      avisar('ok', nuevo ? 'Producto creado. Recuerda cargarle inventario.' : 'Producto actualizado.')
      onGuardado()
    } catch (err) {
      avisar('error', mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja titulo={nuevo ? 'Nuevo producto' : 'Editar producto'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-marca-claro text-3xl">
            {vista ? <img src={vista} alt="" className="h-full w-full object-cover" /> : '🍬'}
          </div>
          <div className="flex flex-col gap-2">
            <label className="btn-secundario cursor-pointer py-1.5 text-center text-sm">
              {vista ? 'Cambiar foto' : 'Agregar foto'}
              <input type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
            </label>
            {archivo && <p className="text-xs text-slate-500">✨ Ajustada: cuadrada y centrada</p>}
            {vista && (
              <button type="button" className="text-sm font-semibold text-red-600"
                onClick={() => { setArchivo(null); setVista(null); setQuitarFoto(true) }}>
                Quitar foto
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="etiqueta" htmlFor="pnombre">Nombre</label>
          <input id="pnombre" className="input" maxLength={80} value={f.nombre} onChange={set('nombre')} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="pcat">Categoría</label>
          <select id="pcat" className="input" value={f.categoria_id} onChange={set('categoria_id')}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="etiqueta" htmlFor="pprecio">Precio de venta ($)</label>
            <input id="pprecio" className="input" type="number" inputMode="decimal" step="0.01" min="0"
              value={f.precio} onChange={set('precio')} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="pcosto">Costo ($, opcional)</label>
            <input id="pcosto" className="input" type="number" inputMode="decimal" step="0.01" min="0"
              value={f.costo} onChange={set('costo')} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.agotado_manual} onChange={set('agotado_manual')} />
          Marcar como agotado (aunque tenga stock)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.activo} onChange={set('activo')} />
          Visible en el menú
        </label>
        <button disabled={guardando} className="btn-primario w-full">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Hoja>
  )
}

function FormInventario({ producto, avisar, onCerrar, onGuardado }) {
  const [tipo, setTipo] = useState('entrada')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    const n = parseInt(cantidad, 10)
    if (!n) return avisar('error', 'Escribe una cantidad distinta de cero.')
    setGuardando(true)
    const { data, error } = await supabase.rpc('ajustar_inventario', {
      p_producto_id: producto.id,
      p_cantidad: n,
      p_tipo: tipo,
      p_nota: nota || null,
    })
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', `Listo. Stock de ${producto.nombre}: ${data}.`)
    onGuardado()
  }

  return (
    <Hoja titulo={`Inventario: ${producto.nombre}`} onCerrar={onCerrar}>
      <p className="mb-3 text-sm text-slate-600">Stock actual: <b>{producto.stock}</b></p>
      <form onSubmit={guardar} className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
          {[['entrada', 'Llegó mercadería'], ['ajuste', 'Ajuste (±)']].map(([k, t]) => (
            <button type="button" key={k} onClick={() => setTipo(k)}
              className={`rounded-lg py-2 ${tipo === k ? 'bg-marca text-sobre-marca' : 'bg-superficie ring-1 ring-slate-200'}`}>
              {t}
            </button>
          ))}
        </div>
        <div>
          <label className="etiqueta" htmlFor="icant">
            {tipo === 'entrada' ? 'Unidades que llegaron' : 'Cantidad (negativa para restar, ej. -2)'}
          </label>
          <input id="icant" className="input" type="number" inputMode="numeric" step="1"
            min={tipo === 'entrada' ? 1 : undefined} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </div>
        <input className="input" placeholder="Nota (opcional), ej. se venció" maxLength={200}
          value={nota} onChange={(e) => setNota(e.target.value)} />
        <button disabled={guardando} className="btn-primario w-full">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Hoja>
  )
}

function Categorias({ categorias, avisar, onCerrar, onCambio }) {
  const [nombre, setNombre] = useState('')
  const [eligiendo, setEligiendo] = useState(null)

  async function agregar(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    const { error } = await supabase.from('categorias')
      .insert({ nombre: nombre.trim(), orden: categorias.length })
    if (error) return avisar('error', mensajeError(error))
    setNombre('')
    onCambio()
  }

  async function alternar(c) {
    const { error } = await supabase.from('categorias').update({ activo: !c.activo }).eq('id', c.id)
    if (error) return avisar('error', mensajeError(error))
    onCambio()
  }

  async function cambiarEmoji(c, emoji) {
    const { error } = await supabase.from('categorias').update({ emoji }).eq('id', c.id)
    if (error) return avisar('error', mensajeError(error))
    setEligiendo(null)
    onCambio()
  }

  async function renombrar(c) {
    const nuevo = prompt('Nuevo nombre', c.nombre)?.trim()
    if (!nuevo || nuevo === c.nombre) return
    const { error } = await supabase.from('categorias').update({ nombre: nuevo }).eq('id', c.id)
    if (error) return avisar('error', mensajeError(error))
    onCambio()
  }

  return (
    <Hoja titulo="Categorías" onCerrar={onCerrar}>
      <form onSubmit={agregar} className="mb-4 flex gap-2">
        <input className="input" placeholder="Nueva categoría, ej. Dulcería" maxLength={40}
          value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="btn-primario">Agregar</button>
      </form>
      {categorias.length === 0 ? <Vacio>Sin categorías todavía.</Vacio> : (
        <ul className="divide-y divide-slate-100">
          {categorias.map((c) => (
            <li key={c.id} className="py-2">
              <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <button onClick={() => setEligiendo(eligiendo === c.id ? null : c.id)} aria-label="Cambiar emoji"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xl">{c.emoji}</button>
                <span className={c.activo ? 'text-slate-900' : 'text-slate-400 line-through'}>{c.nombre}</span>
              </span>
              <div className="flex gap-2">
                <button onClick={() => renombrar(c)} className="text-sm font-semibold text-marca-texto">Renombrar</button>
                <button onClick={() => alternar(c)} className="text-sm font-semibold text-slate-500">
                  {c.activo ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              </div>
              {eligiendo === c.id && (
                <div className="animar-entrada mt-2 grid grid-cols-8 gap-1">
                  {EMOJIS_CAT.map((em) => (
                    <button key={em} onClick={() => cambiarEmoji(c, em)}
                      className={`aspect-square rounded-lg text-xl ${c.emoji === em ? 'bg-marca-claro ring-2 ring-marca' : 'bg-slate-100'}`}>{em}</button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  )
}
