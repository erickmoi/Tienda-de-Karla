import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { puede, useAuth } from '../../lib/auth'
import { dinero, mensajeError } from '../../lib/format'
import { Cargando, Hoja, Vacio } from '../../components/ui'

const VACIO = { nombre: '', categoria_id: '', precio: '', costo: '', agotado_manual: false, activo: true }

export default function Productos({ avisar }) {
  const { perfil } = useAuth()
  const puedeEditar = puede(perfil, 'productos')
  const puedeInventario = puede(perfil, 'inventario')
  const [productos, setProductos] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [editando, setEditando] = useState(null) // objeto producto o VACIO
  const [stockDe, setStockDe] = useState(null)
  const [verCategorias, setVerCategorias] = useState(false)

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

  if (!productos) return <Cargando />

  const nombreCat = (id) => categorias.find((c) => c.id === id)?.nombre ?? 'Sin categoría'

  return (
    <div className="space-y-4">
      {puedeEditar && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEditando(VACIO)} className="btn-primario">+ Producto</button>
          <button onClick={() => setVerCategorias(true)} className="btn-secundario">Categorías</button>
        </div>
      )}

      {productos.length === 0 ? (
        <Vacio>Aún no hay productos. Crea el primero.</Vacio>
      ) : (
        <ul className="space-y-2">
          {productos.map((p) => (
            <li key={p.id} className={`tarjeta p-3 ${p.activo ? '' : 'opacity-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{p.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {nombreCat(p.categoria_id)} · {dinero(p.precio)}
                    {Number(p.costo) > 0 && ` (costo ${dinero(p.costo)})`}
                    {!p.activo && ' · Oculto'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-bold ${p.agotado ? 'text-rose-600' : 'text-slate-800'}`}>{p.stock} u.</p>
                  {p.agotado && <p className="text-xs font-semibold text-rose-600">
                    {p.agotado_manual ? 'Agotado (manual)' : 'Agotado'}
                  </p>}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                {puedeInventario && (
                  <button onClick={() => setStockDe(p)} className="btn-secundario flex-1 py-1.5 text-sm">Inventario</button>
                )}
                {puedeEditar && (
                  <button onClick={() => setEditando(p)} className="btn-secundario flex-1 py-1.5 text-sm">Editar</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <FormProducto
          producto={editando}
          categorias={categorias}
          avisar={avisar}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargar() }}
        />
      )}
      {stockDe && (
        <FormInventario
          producto={stockDe}
          avisar={avisar}
          onCerrar={() => setStockDe(null)}
          onGuardado={() => { setStockDe(null); cargar() }}
        />
      )}
      {verCategorias && (
        <Categorias categorias={categorias} avisar={avisar} onCerrar={() => setVerCategorias(false)} onCambio={cargar} />
      )}
    </div>
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
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

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
    const { error } = nuevo
      ? await supabase.from('productos').insert(fila)
      : await supabase.from('productos').update(fila).eq('id', producto.id)
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', nuevo ? 'Producto creado. Recuerda cargarle inventario.' : 'Producto actualizado.')
    onGuardado()
  }

  return (
    <Hoja titulo={nuevo ? 'Nuevo producto' : 'Editar producto'} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="space-y-3">
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
              className={`rounded-lg py-2 ${tipo === k ? 'bg-marca text-white' : 'bg-white ring-1 ring-slate-200'}`}>
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
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <span className={c.activo ? '' : 'text-slate-400 line-through'}>{c.nombre}</span>
              <div className="flex gap-2">
                <button onClick={() => renombrar(c)} className="text-sm font-semibold text-marca">Renombrar</button>
                <button onClick={() => alternar(c)} className="text-sm font-semibold text-slate-500">
                  {c.activo ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Hoja>
  )
}
