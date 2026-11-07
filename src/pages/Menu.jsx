import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useApariencia, useEncargada } from '../lib/apariencia'
import { dinero, mensajeError } from '../lib/format'
import { vibrar } from '../lib/tema'
import { calcularDescuentos, cargarPromos, etiquetaPromo, faltaParaPromo } from '../lib/promos'
import { encolar, enviarPendientes, esErrorDeRed, pendientes } from '../lib/cola'
import { Contador, Exito, Hoja, Vacio } from '../components/ui'
import { FormaDePago } from '../components/ListaCompras'
import FilaDeslizable from '../components/FilaDeslizable'
import GuiaInstalar from '../components/GuiaInstalar'
import { avisoDescartado, descartarAviso, estaInstalada } from '../lib/instalar'

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const GRID = {
  1: 'grid-cols-1 gap-2',
  2: 'grid-cols-2 gap-2.5 sm:grid-cols-3',
  3: 'grid-cols-3 gap-2 sm:grid-cols-4',
}

// Color suave por categoría cuando el producto no tiene foto
const TINTES = ['#fde68a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#ddd6fe', '#fed7aa', '#a5f3fc', '#fecaca']

export default function Menu({ avisar, onCompra, saldo = 0 }) {
  const { perfil } = useAuth()
  const { apariencia, recargar } = useApariencia()
  const encargada = useEncargada()
  const columnas = apariencia.columnas_menu ?? 2
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState(null)
  const [promos, setPromos] = useState([])
  const [ultima, setUltima] = useState([])
  const [catActiva, setCatActiva] = useState('todas')
  const [buscando, setBuscando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState({})
  const [verCarrito, setVerCarrito] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [exito, setExito] = useState(null)
  const [pop, setPop] = useState({ id: null, n: 0 })
  const [pagado, setPagado] = useState(false)
  const [metodo, setMetodo] = useState('efectivo')
  const [referencia, setReferencia] = useState('')
  const [cuentaId, setCuentaId] = useState(null)
  const [enCola, setEnCola] = useState(pendientes().length)
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const inputBusqueda = useRef(null)
  const [avisoInstalar, setAvisoInstalar] = useState(() => !estaInstalada() && !avisoDescartado())
  const [verGuia, setVerGuia] = useState(false)

  const cargar = useCallback(async () => {
    const [c, p, u, pr] = await Promise.all([
      supabase.from('categorias').select('id, nombre, orden, emoji').eq('activo', true).order('orden').order('nombre'),
      supabase.from('productos').select('id, nombre, precio, foto_url, stock, agotado, categoria_id').eq('activo', true),
      supabase.from('compras').select('compra_items(producto_id, cantidad)').eq('usuario_id', perfil.id)
        .eq('anulada', false).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      cargarPromos().catch(() => []),
    ])
    if (c.error || p.error) return avisar('error', mensajeError(c.error || p.error))
    setCategorias(c.data)
    setProductos(p.data)
    setUltima(u.data?.compra_items ?? [])
    setPromos(pr)
  }, [avisar, perfil.id])

  useEffect(() => { cargar() }, [cargar])

  // Stock en vivo: si alguien compra, se actualiza aquí sin recargar
  useEffect(() => {
    const canal = supabase
      .channel('productos-en-vivo')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos' }, ({ new: n }) => {
        setProductos((ps) => ps?.map((p) => (p.id === n.id ? { ...p, stock: n.stock, agotado: n.agotado, precio: n.precio } : p)))
      })
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [])

  // Al volver a la app: refresca datos, horario y envía compras guardadas sin conexión
  const sincronizar = useCallback(async () => {
    setEnLinea(navigator.onLine)
    if (!navigator.onLine) return
    if (pendientes().length) {
      const r = await enviarPendientes()
      if (r.enviados) {
        avisar('ok', r.enviados === 1 ? 'Se envió tu compra guardada.' : `Se enviaron ${r.enviados} compras guardadas.`)
        onCompra?.()
      }
      if (r.fallidos.length) avisar('error', `Una compra guardada no se pudo registrar: ${r.fallidos[0].mensaje}`)
    }
    cargar()
    recargar()
  }, [avisar, cargar, onCompra, recargar])

  useEffect(() => {
    const visible = () => document.visibilityState === 'visible' && sincronizar()
    const cola = () => setEnCola(pendientes().length)
    const offline = () => setEnLinea(false)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('online', sincronizar)
    window.addEventListener('offline', offline)
    window.addEventListener('cola-cambio', cola)
    if (pendientes().length) sincronizar()
    return () => {
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('online', sincronizar)
      window.removeEventListener('offline', offline)
      window.removeEventListener('cola-cambio', cola)
    }
  }, [sincronizar])

  useEffect(() => { if (buscando) inputBusqueda.current?.focus() }, [buscando])

  const porId = useMemo(() => Object.fromEntries((productos ?? []).map((p) => [p.id, p])), [productos])
  const emojiCat = useMemo(() => Object.fromEntries(categorias.map((c, i) => [c.id, { emoji: c.emoji, tinte: TINTES[i % TINTES.length] }])), [categorias])

  // Promociones por producto (para la etiqueta en la tarjeta)
  const promoDe = useMemo(() => {
    const m = {}
    for (const pr of promos) for (const pp of pr.promocion_productos ?? []) m[pp.producto_id] ??= pr
    return m
  }, [promos])
  const idsEnPromo = useMemo(() => new Set(Object.keys(promoDe).map(Number)), [promoDe])

  const visibles = useMemo(() => {
    if (!productos) return []
    const q = sinAcentos(busqueda.trim())
    return productos
      .filter((p) =>
        q ? sinAcentos(p.nombre).includes(q)
          : catActiva === 'todas' ? true
          : catActiva === 'promos' ? idsEnPromo.has(p.id)
          : p.categoria_id === catActiva)
      .sort((a, b) => Number(a.agotado) - Number(b.agotado) || a.nombre.localeCompare(b.nombre))
  }, [productos, catActiva, busqueda, idsEnPromo])

  const items = Object.entries(carrito)
    .filter(([, n]) => n > 0)
    .map(([id, cantidad]) => ({ producto: porId[id], cantidad }))
    .filter((i) => i.producto)
  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0)
  const subtotal = items.reduce((s, i) => s + i.cantidad * Number(i.producto.precio), 0)
  const descuentos = useMemo(
    () => calcularDescuentos(items.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad, precio: i.producto.precio })), promos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carrito, promos, porId],
  )
  const ahorro = descuentos.reduce((s, d) => s + d.descuento, 0)
  const total = Math.max(0, subtotal - ahorro)

  const loDeSiempre = ultima
    .map((i) => ({ producto: porId[i.producto_id], cantidad: i.cantidad }))
    .filter((i) => i.producto && !i.producto.agotado)

  // Límite de deuda (aviso o bloqueo)
  const limite = perfil.limite_deuda ?? apariencia.limite_deuda
  const conLimite = limite != null && Number(limite) > 0
  const quedaria = saldo + (pagado ? 0 : total)
  const pasaLimite = conLimite && quedaria > Number(limite)
  const cerrada = apariencia.abierta === false

  const cambiar = (id, delta) => {
    if (delta > 0) {
      vibrar(10)
      setPop((p) => ({ id, n: p.n + 1 }))
    }
    setCarrito((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + delta) }))
  }

  function repetir() {
    vibrar(15)
    const nuevo = {}
    for (const { producto, cantidad } of loDeSiempre) nuevo[producto.id] = Math.min(cantidad, producto.stock)
    setCarrito(nuevo)
    setVerCarrito(true)
  }

  async function registrar() {
    const conPago = pagado && apariencia.pagos_clientes
    const pedido = {
      items: items.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
      pagado: conPago,
      metodo,
      referencia: conPago && metodo === 'transferencia' ? referencia || null : null,
      cuentaId: conPago && metodo === 'transferencia' ? cuentaId : null,
    }
    const terminar = (texto, sub) => {
      vibrar([20, 40, 20])
      setExito({ texto, sub })
      setCarrito({})
      setPagado(false)
      setReferencia('')
      setVerCarrito(false)
    }

    if (!navigator.onLine) {
      encolar(pedido)
      return terminar('Guardada 📶', 'Sin internet: se enviará sola cuando vuelva la conexión.')
    }

    setRegistrando(true)
    const { error } = await supabase.rpc('registrar_compra', {
      p_items: pedido.items, p_pagado: pedido.pagado, p_metodo: pedido.metodo, p_referencia: pedido.referencia,
      p_metodo_pago_id: pedido.cuentaId,
    })
    setRegistrando(false)
    if (error) {
      if (esErrorDeRed(error)) {
        encolar(pedido)
        return terminar('Guardada 📶', 'La conexión falló: se enviará sola cuando vuelva.')
      }
      avisar('error', mensajeError(error))
      cargar()
      return
    }
    terminar('¡Registrado!', conPago
      ? apariencia.pagos_auto ? `Compra pagada: ${dinero(total)}. ¡Buen provecho!` : `Pago de ${dinero(total)} enviado a ${encargada} para aprobar.`
      : `${dinero(total)} a tu cuenta.${ahorro > 0 ? ` Ahorraste ${dinero(ahorro)} 🎉` : ' ¡Buen provecho!'}`)
    cargar()
    onCompra?.()
  }

  if (!productos) return <EsqueletoMenu columnas={columnas} />

  const chips = [
    ...(promos.length ? [{ id: 'promos', nombre: 'Promos', emoji: '🔥', promo: true }] : []),
    { id: 'todas', nombre: 'Todo', emoji: '✨' },
    ...categorias,
  ]

  return (
    <div className="pb-28">
      {/* Avisos de estado */}
      {!enLinea && (
        <p className="mb-2 rounded-xl bg-slate-800 px-3 py-2 text-center text-sm font-medium text-slate-50">
          📶 Sin conexión. Puedes registrar y se enviará cuando vuelva.
        </p>
      )}
      {enCola > 0 && enLinea && (
        <button onClick={sincronizar} className="mb-2 w-full rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
          ⏳ {enCola === 1 ? '1 compra guardada' : `${enCola} compras guardadas`} por enviar · Enviar ahora
        </button>
      )}
      {avisoInstalar && (
        <div className="animar-entrada mb-2 flex items-center gap-3 rounded-2xl bg-marca-claro p-3">
          <span className="text-2xl">📲</span>
          <button onClick={() => setVerGuia(true)} className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-bold text-marca-texto">Instala la app en tu celular</span>
            <span className="block text-xs text-slate-600">Abre más rápido y te llegan los avisos. Toca para ver cómo.</span>
          </button>
          <button onClick={() => { descartarAviso(); setAvisoInstalar(false) }} aria-label="Ocultar aviso"
            className="shrink-0 px-1 text-slate-400">✕</button>
        </div>
      )}
      {verGuia && (
        <Hoja titulo="📲 Instalar la app" onCerrar={() => setVerGuia(false)}>
          <GuiaInstalar onInstalada={() => { setVerGuia(false); setAvisoInstalar(false) }} />
        </Hoja>
      )}
      {cerrada && (
        <p className="mb-2 rounded-xl bg-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700">
          🔒 {apariencia.mensaje_cerrado}
        </p>
      )}

      {/* Fila fija: lupa + "Lo de siempre" + promos + categorías */}
      <div data-tour="categorias"
        className="sticky top-[calc(env(safe-area-inset-top)+var(--espacio-arriba))] z-20 -mx-4 mb-3 bg-slate-50 px-4 py-1.5 shadow-[0_6px_8px_-8px_rgba(0,0,0,0.25)]">
        {buscando ? (
          <div className="animar-entrada flex items-center gap-2">
            <input ref={inputBusqueda} className="input py-2" type="search" placeholder="Buscar producto" value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)} />
            <button onClick={() => { setBuscando(false); setBusqueda('') }}
              className="shrink-0 px-2 text-sm font-semibold text-slate-500">Cerrar</button>
          </div>
        ) : (
          <FilaDeslizable>
            <button onClick={() => setBuscando(true)} aria-label="Buscar"
              className="shrink-0 rounded-full bg-superficie px-3 py-1.5 ring-1 ring-slate-200">🔎</button>
            {loDeSiempre.length > 0 && totalUnidades === 0 && (
              <button onClick={repetir} title={loDeSiempre.map((i) => `${i.cantidad} × ${i.producto.nombre}`).join(', ')}
                className="shrink-0 rounded-full bg-marca-claro px-3 py-1.5 text-sm font-semibold text-marca-texto">
                🔁 Lo de siempre
              </button>
            )}
            {chips.map((c) => (
              <button key={c.id} onClick={() => { vibrar(6); setCatActiva(c.id) }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-200 ${
                  catActiva === c.id
                    ? c.promo ? 'bg-orange-500 text-white shadow' : 'bg-marca text-sobre-marca shadow'
                    : c.promo ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' : 'bg-superficie text-slate-600 ring-1 ring-slate-200'
                }`}>
                {c.emoji} {c.nombre}
              </button>
            ))}
          </FilaDeslizable>
        )}
      </div>

      {/* Tarjetas de promociones (en la vista Promos) */}
      {catActiva === 'promos' && !busqueda && (
        <div className="escalonado mb-3 space-y-2">
          {promos.map((pr) => <TarjetaPromo key={pr.id} pr={pr} porId={porId} carrito={carrito} />)}
        </div>
      )}

      {visibles.length === 0 ? (
        <Vacio>{busqueda ? 'No encontramos ese producto.' : 'No hay productos aquí todavía.'}</Vacio>
      ) : (
        <div key={`${catActiva}-${busqueda ? 'b' : ''}`} className={`escalonado grid ${GRID[columnas] ?? GRID[2]}`}>
          {visibles.map((p, i) => (
            <TarjetaProducto
              key={p.id}
              p={p}
              modo={columnas}
              tour={i === 0}
              cat={emojiCat[p.categoria_id]}
              promo={promoDe[p.id]}
              mostrarStock={apariencia.mostrar_stock}
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
            <span className="tabular-nums">
              {ahorro > 0 && <span className="mr-2 text-sm line-through opacity-70">{dinero(subtotal)}</span>}
              {dinero(total)}
            </span>
          </button>
        </div>
      )}

      {verCarrito && (
        <Hoja titulo="Tu carrito" onCerrar={() => setVerCarrito(false)}>
          {items.length === 0 ? <Vacio>El carrito está vacío.</Vacio> : (
            <ul className="divide-y divide-slate-100">
              {items.map(({ producto, cantidad }) => (
                <li key={producto.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{producto.nombre}</p>
                    <p className="text-sm text-slate-500">{dinero(producto.precio)} × {cantidad} = {dinero(producto.precio * cantidad)}</p>
                  </div>
                  <Contador valor={cantidad} onMenos={() => cambiar(producto.id, -1)} onMas={() => cambiar(producto.id, 1)}
                    maxAlcanzado={cantidad >= producto.stock} />
                </li>
              ))}
            </ul>
          )}

          {/* Promos que faltan poco para activarse */}
          {promos.map((pr) => {
            const falta = faltaParaPromo(pr, carrito)
            return falta ? (
              <p key={pr.id} className="mt-2 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700">
                🔥 Agrega {falta} más de “{pr.nombre}” y activas {etiquetaPromo(pr)}
              </p>
            ) : null
          })}

          <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
            {ahorro > 0 && (
              <>
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums">{dinero(subtotal)}</span></div>
                {descuentos.map((d) => (
                  <div key={d.promo.id} className="flex justify-between font-medium text-orange-600">
                    <span>🔥 {d.promo.nombre}{d.veces > 1 ? ` ×${d.veces}` : ''}</span>
                    <span className="tabular-nums">−{dinero(d.descuento)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex items-center justify-between text-lg font-bold text-slate-900">
              <span>Total</span><span className="tabular-nums">{dinero(total)}</span>
            </div>
          </div>

          {apariencia.pagos_clientes && (
            <div className="mt-4 space-y-3">
              <p className="etiqueta">¿Cómo queda?</p>
              <div className="relative grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
                <span aria-hidden="true"
                  className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-superficie shadow transition-transform duration-300"
                  style={{ transform: pagado ? 'translateX(100%)' : 'none' }} />
                <button type="button" onClick={() => setPagado(false)}
                  className={`relative py-2.5 ${!pagado ? 'text-marca-texto' : 'text-slate-500'}`}>📒 A mi cuenta</button>
                <button type="button" onClick={() => setPagado(true)}
                  className={`relative py-2.5 ${pagado ? 'text-marca-texto' : 'text-slate-500'}`}>💵 Ya pagué</button>
              </div>
              {pagado && (
                <div className="animar-entrada">
                  <FormaDePago metodo={metodo} setMetodo={setMetodo} referencia={referencia} setReferencia={setReferencia}
                    cuentaId={cuentaId} setCuentaId={setCuentaId} />
                </div>
              )}
            </div>
          )}

          {pasaLimite && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${apariencia.limite_bloquea ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
              {apariencia.limite_bloquea
                ? `⛔ Con esta compra pasarías tu límite de ${dinero(limite)}. Paga lo pendiente o marca “Ya pagué”.`
                : `⚠️ Con esta compra quedarías debiendo ${dinero(quedaria)} (tu límite es ${dinero(limite)}).`}
            </p>
          )}

          <button onClick={registrar}
            disabled={registrando || totalUnidades === 0 || cerrada || (pasaLimite && apariencia.limite_bloquea)}
            className="btn-primario mt-4 w-full">
            {cerrada ? '🔒 Tienda cerrada'
              : registrando ? 'Registrando…'
              : pagado && apariencia.pagos_clientes ? (apariencia.pagos_auto ? 'Registrar como pagada' : 'Registrar y avisar pago')
              : 'Registrar compra'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">
            {pagado && apariencia.pagos_clientes
              ? apariencia.pagos_auto ? 'El pago se aplica al instante.' : `El pago se aplica cuando ${encargada} lo apruebe.`
              : 'Se suma a tu cuenta. Podrás borrarla por unos minutos si te equivocas.'}
          </p>
        </Hoja>
      )}

      {exito && <Exito texto={exito.texto} sub={exito.sub} onFin={() => setExito(null)} />}
    </div>
  )
}

function TarjetaPromo({ pr, porId, carrito }) {
  const productos = (pr.promocion_productos ?? []).map((pp) => ({ ...pp, p: porId[pp.producto_id] })).filter((x) => x.p)
  const falta = faltaParaPromo(pr, carrito)
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 p-3 text-white shadow">
      <span aria-hidden="true" className="absolute -right-4 -top-6 text-7xl opacity-20">🔥</span>
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{pr.nombre}</p>
          <p className="text-xs opacity-90">
            {pr.tipo === 'cantidad'
              ? `Lleva ${pr.cantidad} ${productos.length > 1 ? '(puedes combinar)' : ''} por ${dinero(pr.precio)}`
              : productos.map((x) => `${x.cantidad > 1 ? `${x.cantidad} × ` : ''}${x.p.nombre}`).join(' + ')}
          </p>
          {pr.hasta && <p className="mt-0.5 text-[11px] opacity-80">Hasta el {new Date(`${pr.hasta}T12:00:00`).toLocaleDateString('es-SV', { day: 'numeric', month: 'short' })}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-sm font-bold text-orange-600">{etiquetaPromo(pr)}</span>
      </div>
      {falta && <p className="relative mt-1.5 text-xs font-semibold">¡{falta === 1 ? 'Te falta 1' : `Te faltan ${falta}`} para activarla!</p>}
    </div>
  )
}

function TarjetaProducto({ p, modo, enCarrito, pop, onCambiar, tour, cat, promo, mostrarStock }) {
  const lista = modo === 1
  const compacta = modo === 3
  const quedan = p.stock - enCarrito
  const tourAttr = tour ? { 'data-tour': 'producto' } : {}
  const marcado = enCarrito > 0 ? 'ring-2 ring-marca' : ''
  const apagado = p.agotado ? 'opacity-50 grayscale' : ''

  const stockTxt = mostrarStock && !p.agotado ? (
    <span className={`text-[11px] font-medium ${quedan <= 3 ? 'text-amber-700' : 'text-slate-500'}`}>
      {quedan > 0 ? `Quedan ${quedan}` : 'No quedan más'}
    </span>
  ) : null
  const promoTag = promo && !p.agotado ? (
    <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">🔥 {etiquetaPromo(promo)}</span>
  ) : null

  const imagen = (tam) => (
    <span key={pop} className={`relative flex items-center justify-center overflow-hidden ${pop ? 'animar-pop' : ''} ${tam}`}
      style={p.foto_url ? undefined : { background: `color-mix(in oklab, ${cat?.tinte ?? '#e2e8f0'} 55%, var(--color-superficie))` }}>
      {p.foto_url
        ? <img src={p.foto_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        : <span className={lista ? 'text-2xl' : compacta ? '-mt-6 text-2xl' : '-mt-8 text-4xl'}>{cat?.emoji ?? '🛍️'}</span>}
    </span>
  )

  const botonMas = (
    <button onClick={() => onCambiar(p.id, 1)} disabled={enCarrito >= p.stock} aria-label={`Agregar ${p.nombre}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-marca text-xl font-bold text-sobre-marca shadow-md transition active:scale-90 disabled:opacity-40">
      +
    </button>
  )
  const control = p.agotado ? (
    <span className="rounded-md bg-slate-700/80 px-2 py-1 text-[10px] font-bold uppercase text-white">Agotado</span>
  ) : enCarrito > 0 ? (
    <div className="flex items-center gap-1 rounded-full bg-superficie/95 p-0.5 shadow-md ring-1 ring-slate-200">
      <button onClick={() => onCambiar(p.id, -1)} aria-label="Quitar uno"
        className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-slate-700 active:scale-90">−</button>
      <span key={enCarrito} className="animar-pop w-5 text-center text-sm font-bold tabular-nums text-slate-900">{enCarrito}</span>
      <button onClick={() => onCambiar(p.id, 1)} disabled={enCarrito >= p.stock} aria-label="Agregar uno"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-marca text-lg font-bold text-sobre-marca active:scale-90 disabled:opacity-40">+</button>
    </div>
  ) : botonMas

  // ---- Vista de lista: una fila delgada ----
  if (lista) {
    return (
      <div {...tourAttr} className={`tarjeta relative isolate flex items-center gap-3 p-2 transition ${marcado} ${apagado}`}>
        {imagen('h-12 w-12 shrink-0 rounded-xl')}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{p.nombre}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-marca-texto">{dinero(p.precio)}</span>
            {promoTag}{stockTxt}
          </div>
        </div>
        {control}
      </div>
    )
  }

  // ---- Vista en cuadrícula: la foto llena la tarjeta y el texto va en una franja translúcida ----
  return (
    <div {...tourAttr} className={`relative isolate overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200 transition ${
      compacta ? 'aspect-[4/5]' : 'aspect-[5/4]'} ${marcado} ${apagado}`}>
      {imagen('absolute inset-0 h-full w-full')}
      <span className={`absolute right-1.5 top-1.5 z-10 ${compacta ? 'origin-top-right scale-90' : ''}`}>{control}</span>
      <div className={`absolute inset-x-0 bottom-0 bg-superficie/55 backdrop-blur-md ${compacta ? 'px-2 py-1' : 'px-2.5 py-1.5'}`}>
        {promoTag && <div className="mb-0.5 leading-none">{promoTag}</div>}
        <p className={`line-clamp-2 font-semibold leading-tight text-slate-900 ${compacta ? 'text-[11px]' : 'text-sm'}`}>{p.nombre}</p>
        <div className="flex items-center justify-between gap-1">
          <span className={`font-bold text-marca-texto ${compacta ? 'text-xs' : 'text-sm'}`}>{dinero(p.precio)}</span>
          {stockTxt}
        </div>
      </div>
    </div>
  )
}

function EsqueletoMenu({ columnas }) {
  return (
    <div aria-busy="true" aria-label="Cargando menú">
      <div className="mb-4 flex gap-2">
        {[40, 90, 64, 80, 70].map((w, i) => <div key={i} className="esqueleto h-8" style={{ width: w }} />)}
      </div>
      <div className={`grid ${GRID[columnas] ?? GRID[2]}`}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`esqueleto ${columnas === 1 ? 'h-16' : columnas === 3 ? 'aspect-[4/5]' : 'aspect-[5/4]'}`} />
        ))}
      </div>
    </div>
  )
}
