import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dinero, mensajeError } from '../lib/format'
import { Cargando, Contador, Hoja, Vacio } from '../components/ui'

export default function Menu({ avisar }) {
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState(null)
  const [catActiva, setCatActiva] = useState('todas')
  const [carrito, setCarrito] = useState({}) // { productoId: cantidad }
  const [verCarrito, setVerCarrito] = useState(false)
  const [registrando, setRegistrando] = useState(false)

  const cargar = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('categorias').select('id, nombre, orden').eq('activo', true).order('orden').order('nombre'),
      supabase.from('productos').select('id, nombre, precio, foto_url, stock, agotado, categoria_id').eq('activo', true),
    ])
    if (c.error || p.error) return avisar('error', mensajeError(c.error || p.error))
    setCategorias(c.data)
    setProductos(p.data)
  }, [avisar])

  useEffect(() => { cargar() }, [cargar])

  const visibles = useMemo(() => {
    if (!productos) return []
    return productos
      .filter((p) => catActiva === 'todas' || p.categoria_id === catActiva)
      .sort((a, b) => Number(a.agotado) - Number(b.agotado) || a.nombre.localeCompare(b.nombre))
  }, [productos, catActiva])

  const items = Object.entries(carrito)
    .filter(([, n]) => n > 0)
    .map(([id, cantidad]) => ({ producto: productos?.find((p) => p.id === Number(id)), cantidad }))
    .filter((i) => i.producto)
  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0)
  const total = items.reduce((s, i) => s + i.cantidad * Number(i.producto.precio), 0)

  const cambiar = (id, delta) =>
    setCarrito((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }))

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
    avisar('ok', `Registrado: ${dinero(total)}. ¡Buen provecho!`)
    setCarrito({})
    setVerCarrito(false)
    cargar()
  }

  if (!productos) return <Cargando />

  return (
    <div className="pb-28">
      {/* Categorías */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-slate-50/95 px-4 py-2 backdrop-blur">
        {[{ id: 'todas', nombre: 'Todo' }, ...categorias].map((c) => (
          <button
            key={c.id}
            onClick={() => setCatActiva(c.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${
              catActiva === c.id ? 'bg-marca text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <Vacio>No hay productos aquí todavía.</Vacio>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibles.map((p) => {
            const enCarrito = carrito[p.id] || 0
            return (
              <div key={p.id} className={`tarjeta flex flex-col p-3 ${p.agotado ? 'opacity-50 grayscale' : ''}`}>
                <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-marca-claro text-4xl">
                  {p.foto_url ? <img src={p.foto_url} alt="" className="h-full w-full object-cover" /> : '🍬'}
                </div>
                <p className="line-clamp-2 min-h-10 text-sm font-semibold text-slate-800">{p.nombre}</p>
                <p className="mb-2 font-bold text-marca">{dinero(p.precio)}</p>
                {p.agotado ? (
                  <span className="mt-auto rounded-lg bg-slate-200 py-2 text-center text-xs font-bold uppercase text-slate-600">
                    Agotado
                  </span>
                ) : (
                  <div className="mt-auto flex justify-center">
                    <Contador
                      valor={enCarrito}
                      onMenos={() => cambiar(p.id, -1)}
                      onMas={() => cambiar(p.id, 1)}
                      maxAlcanzado={enCarrito >= p.stock}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Barra del carrito */}
      {totalUnidades > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-20 flex justify-center px-4">
          <button onClick={() => setVerCarrito(true)} className="btn-primario flex w-full max-w-lg items-center justify-between shadow-lg">
            <span>Ver carrito ({totalUnidades})</span>
            <span>{dinero(total)}</span>
          </button>
        </div>
      )}

      {verCarrito && (
        <Hoja titulo="Tu carrito" onCerrar={() => setVerCarrito(false)}>
          <ul className="divide-y divide-slate-100">
            {items.map(({ producto, cantidad }) => (
              <li key={producto.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{producto.nombre}</p>
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
          <div className="mt-4 flex items-center justify-between border-t pt-4 text-lg font-bold">
            <span>Total</span>
            <span>{dinero(total)}</span>
          </div>
          <button onClick={registrar} disabled={registrando || totalUnidades === 0} className="btn-primario mt-4 w-full">
            {registrando ? 'Registrando…' : 'Registrar compra'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">Se suma a tu cuenta. Podrás borrarla por unos minutos si te equivocas.</p>
        </Hoja>
      )}
    </div>
  )
}
