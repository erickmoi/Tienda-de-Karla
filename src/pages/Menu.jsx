import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useApariencia } from '../lib/apariencia'
import { dinero, mensajeError } from '../lib/format'
import { vibrar } from '../lib/tema'
import { Contador, Exito, Hoja, Vacio } from '../components/ui'

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const GRID = {
  1: 'grid-cols-1',
  2: 'grid-cols-2 sm:grid-cols-3',
  3: 'grid-cols-3 sm:grid-cols-4',
}

export default function Menu({ avisar, onCompra }) {
  const { perfil } = useAuth()
  const { apariencia } = useApariencia()
  const columnas = apariencia.columnas_menu ?? 2
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState(null)
  const [ultima, setUltima] = useState([]) // [{producto_id, cantidad}]
  const [catActiva, setCatActiva] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState({}) // { productoId: cantidad }
  const [verCarrito, setVerCarrito] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [exito, setExito] = useState(null)
  const [pop, setPop] = useState({ id: null, n: 0 })

  const cargar = useCallback(async () => {
    const [c, p, u] = await Promise.all([
      supabase.from('categorias').select('id, nombre, orden').eq('activo', true).order('orden').order('nombre'),
      supabase.from('productos').select('id, nombre, precio, foto_url, stock, agotado, categoria_id').eq('activo', true),
      supabase.from('compras').select('compra_items(producto_id, cantidad)').eq('usuario_id', perfil.id)
        .eq('anulada', false).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (c.error || p.error) return avisar('error', mensajeError(c.error || p.error))
    setCategorias(c.data)
    setProductos(p.data)
    setUltima(u.data?.compra_items ?? [])
  }, [avisar, perfil.id])

  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    if (!productos) return []
    const q = sinAcentos(busqueda.trim())
    return productos
      .filter((p) => (q ? sinAcentos(p.nombre).includes(q) : catActiva === 'todas' || p.categoria_id === catActiva))
      .sort((a, b) => Number(a.agotado) - Number(b.agotado) || a.nombre.localeCompare(b.nombre))
  }, [productos, catActiva, busqueda])

  const porId = useMemo(() => Object.fromEntries((productos ?? []).map((p) => [p.id, p])), [productos])
  const items = Object.entries(carrito)
    .filter(([, n]) => n > 0)
    .map(([id, cantidad]) => ({ producto: porId[id], cantidad }))
    .filter((i) => i.producto)
  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0)
  const total = items.reduce((s, i) => s + i.cantidad * Number(i.producto.precio), 0)

  // "Lo de siempre": solo lo que sigue disponible
  const loDeSiempre = ultima
    .map((i) => ({ producto: porId[i.producto_id], cantidad: i.cantidad }))
    .filter((i) => i.producto && !i.producto.agotado)

  const cambiar = (id, delta) => {
    if (delta > 0) {
      vibrar(10)
      setPop((p) => ({ id, n: p.n + 1 }))
    }
    setCarrito((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }))
  }

  function repetir() {
    vibrar(15)
    setCarrito(() => {
      const nuevo = {}
      for (const { producto, cantidad } of loDeSiempre) nuevo[producto.id] = Math.min(cantidad, producto.stock)
      return nuevo
    })
    setVerCarrito(true)
  }

  async function registrar() {
    setRegistrando(true)
    const { error } = await supabase.rpc('registrar_compra', {
      p_items: items.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
    })
    setRegistrando(false)
    if (error) {
      avisar('error', mensajeError(error))
      cargar() // por si algo se agotó mientras tanto
      return
    }
    vibrar([20, 40, 20])
    setExito({ texto: '¡Registrado!', sub: `${dinero(total)} a tu cuenta. ¡Buen provecho!` })
    setCarrito({})
    setVerCarrito(false)
    cargar()
    onCompra?.()
  }

  if (!productos) return <EsqueletoMenu columnas={columnas} />

  return (
    <div className="pb-28">
      {/* Buscador */}
      <div className="relative mb-2">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
        <input className="input pl-10" type="search" placeholder="Buscar producto" value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {/* Categorías */}
      {!busqueda && (
        <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 mb-3 flex gap-2 overflow-x-auto bg-slate-50 px-4 py-2 shadow-[0_6px_8px_-8px_rgba(0,0,0,0.25)]">
          {[{ id: 'todas', nombre: 'Todo' }, ...categorias].map((c) => (
            <button
              key={c.id}
              onClick={() => { vibrar(6); setCatActiva(c.id) }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                catActiva === c.id ? 'scale-105 bg-marca text-sobre-marca shadow' : 'bg-superficie text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Lo de siempre */}
      {!busqueda && loDeSiempre.length > 0 && totalUnidades === 0 && (
        <button onClick={repetir}
          className="animar-entrada tarjeta mb-3 flex w-full items-center gap-3 p-3 text-left ring-marca/30 transition active:scale-[0.98]">
          <span className="text-2xl">🔁</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-marca-texto">Lo de siempre</span>
            <span className="block truncate text-xs text-slate-500">
              {loDeSiempre.map((i) => `${i.cantidad} × ${i.producto.nombre}`).join(', ')}
            </span>
          </span>
          <span className="text-sm font-semibold text-slate-400">›</span>
        </button>
      )}

      {visibles.length === 0 ? (
        <Vacio>{busqueda ? 'No encontramos ese producto.' : 'No hay productos aquí todavía.'}</Vacio>
      ) : (
        <div key={`${catActiva}-${busqueda ? 'b' : ''}`} className={`escalonado grid gap-3 ${GRID[columnas] ?? GRID[2]}`}>
          {visibles.map((p) => (
            <TarjetaProducto
              key={p.id}
              p={p}
              lista={columnas === 1}
              compacta={columnas === 3}
              enCarrito={carrito[p.id] || 0}
              pop={pop.id === p.id ? pop.n : 0}
              onCambiar={cambiar}
            />
          ))}
        </div>
      )}

      {/* Barra del carrito */}
      {totalUnidades > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
          <button key={totalUnidades} onClick={() => setVerCarrito(true)}
            className="animar-rebote btn-primario flex w-full max-w-lg items-center justify-between shadow-lg">
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-sobre-marca/20 px-2 py-0.5 text-sm">{totalUnidades}</span>
              Ver carrito
            </span>
            <span className="tabular-nums">{dinero(total)}</span>
          </button>
        </div>
      )}

      {verCarrito && (
        <Hoja titulo="Tu carrito" onCerrar={() => setVerCarrito(false)}>
          {items.length === 0 ? <Vacio>El carrito está vacío.</Vacio> : (
            <ul className="divide-y divide-slate-100">
              {items.map(({ producto, cantidad }) => (
                <li key={producto.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{producto.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {dinero(producto.precio)} × {cantidad} = {dinero(producto.precio * cantidad)}
                    </p>
                  </div>
                  <Contador
                    valor={cantidad}
                    onMenos={() => cambiar(producto.id, -1)}
                    onMas={() => cambiar(producto.id, 1)}
                    maxAlcanzado={cantidad >= producto.stock}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-900">
            <span>Total</span>
            <span className="tabular-nums">{dinero(total)}</span>
          </div>
          <button onClick={registrar} disabled={registrando || totalUnidades === 0} className="btn-primario mt-4 w-full">
            {registrando ? 'Registrando…' : 'Registrar compra'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">Se suma a tu cuenta. Podrás borrarla por unos minutos si te equivocas.</p>
        </Hoja>
      )}

      {exito && <Exito texto={exito.texto} sub={exito.sub} onFin={() => setExito(null)} />}
    </div>
  )
}

function TarjetaProducto({ p, lista, compacta, enCarrito, pop, onCambiar }) {
  const foto = (
    <span key={pop} className={`flex items-center justify-center overflow-hidden rounded-xl bg-marca-claro ${pop ? 'animar-pop' : ''} ${
      lista ? 'h-14 w-14 shrink-0 text-2xl' : `mb-2 aspect-square w-full ${compacta ? 'text-2xl' : 'text-4xl'}`
    }`}>
      {p.foto_url ? <img src={p.foto_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : '🍬'}
    </span>
  )

  const control = p.agotado ? (
    <span className="rounded-lg bg-slate-200 px-2 py-2 text-center text-xs font-bold uppercase text-slate-600">Agotado</span>
  ) : (
    <Contador
      valor={enCarrito}
      onMenos={() => onCambiar(p.id, -1)}
      onMas={() => onCambiar(p.id, 1)}
      maxAlcanzado={enCarrito >= p.stock}
    />
  )

  const marcado = enCarrito > 0 ? 'ring-2 ring-marca' : ''
  const apagado = p.agotado ? 'opacity-50 grayscale' : ''

  if (lista) {
    return (
      <div className={`tarjeta flex items-center gap-3 p-2.5 transition ${marcado} ${apagado}`}>
        {foto}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{p.nombre}</p>
          <p className="font-bold text-marca-texto">{dinero(p.precio)}</p>
        </div>
        {control}
      </div>
    )
  }

  return (
    <div className={`tarjeta flex flex-col p-3 transition ${marcado} ${apagado}`}>
      {foto}
      <p className={`line-clamp-2 font-semibold text-slate-800 ${compacta ? 'min-h-8 text-xs' : 'min-h-10 text-sm'}`}>{p.nombre}</p>
      <p className={`mb-2 font-bold text-marca-texto ${compacta ? 'text-sm' : ''}`}>{dinero(p.precio)}</p>
      <div className={`mt-auto flex justify-center ${compacta ? 'origin-bottom scale-90' : ''}`}>{control}</div>
    </div>
  )
}

function EsqueletoMenu({ columnas }) {
  return (
    <div aria-busy="true" aria-label="Cargando menú">
      <div className="esqueleto mb-3 h-11" />
      <div className="mb-4 flex gap-2">
        {[64, 90, 80, 70].map((w, i) => <div key={i} className="esqueleto h-8" style={{ width: w }} />)}
      </div>
      <div className={`grid gap-3 ${GRID[columnas] ?? GRID[2]}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`esqueleto ${columnas === 1 ? 'h-20' : 'aspect-[3/4]'}`} />
        ))}
      </div>
    </div>
  )
}
