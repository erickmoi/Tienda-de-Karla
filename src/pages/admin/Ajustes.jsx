import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/format'
import { useApariencia } from '../../lib/apariencia'
import { aplicarColor, PALETAS } from '../../lib/tema'
import { borrarFoto, subirFoto } from '../../lib/fotos'
import { Cargando, Interruptor } from '../../components/ui'

const EMOJIS = ['🍿', '🛒', '🍬', '🍫', '🥤', '🍪', '🧁', '🍭', '☕', '🏪', '⭐', '🌙']

export default function Ajustes({ avisar }) {
  const { recargar } = useApariencia()
  const [f, setF] = useState(null)
  const [original, setOriginal] = useState(null)
  const [logo, setLogo] = useState(null) // { archivo, vista } | { quitar: true }
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('ajustes').select('*').maybeSingle().then(({ data, error }) => {
      if (error) return avisar('error', mensajeError(error))
      setF(data)
      setOriginal(data)
    })
  }, [avisar])

  // Si se sale sin guardar, se devuelve el último color guardado
  const colorGuardado = useRef(null)
  useEffect(() => { colorGuardado.current = original?.color_marca }, [original])
  useEffect(() => () => aplicarColor(colorGuardado.current), [])

  if (!f) return <Cargando />

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const elegirColor = (hex) => {
    set('color_marca', hex)
    aplicarColor(hex) // vista previa en vivo
  }

  function elegirLogo(e) {
    const archivo = e.target.files?.[0]
    if (archivo) setLogo({ archivo, vista: URL.createObjectURL(archivo) })
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      let logo_url = f.logo_url
      if (logo?.archivo) logo_url = await subirFoto('tienda', logo.archivo)
      if (logo?.quitar) logo_url = null

      const { error } = await supabase.from('ajustes').update({
        nombre_tienda: f.nombre_tienda.trim() || 'Tienda de Karla',
        nombre_encargada: f.nombre_encargada.trim() || 'Karla',
        pagos_clientes: f.pagos_clientes,
        frase: f.frase.trim(),
        emoji: f.emoji || '🍿',
        logo_url,
        color_marca: f.color_marca,
        columnas_menu: Number(f.columnas_menu),
        permitir_saldo_favor: f.permitir_saldo_favor,
        mostrar_deudas: f.mostrar_deudas,
        minutos_borrar: Math.min(60, Math.max(0, parseInt(f.minutos_borrar, 10) || 0)),
        recordatorio_activo: f.recordatorio_activo,
        recordatorio_minimo: Math.max(0, Number(f.recordatorio_minimo) || 0),
        notificar_stock: f.notificar_stock,
        stock_bajo_umbral: Math.min(50, Math.max(0, parseInt(f.stock_bajo_umbral, 10) || 0)),
      }).eq('id', 1)
      if (error) throw error

      if (logo_url !== original.logo_url && original.logo_url) await borrarFoto(original.logo_url).catch(() => {})
      const nuevo = { ...f, logo_url }
      setF(nuevo)
      setOriginal(nuevo)
      setLogo(null)
      await recargar()
      avisar('ok', 'Ajustes guardados.')
    } catch (err) {
      avisar('error', mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const vistaLogo = logo?.quitar ? null : logo?.vista ?? f.logo_url
  const personalizado = !PALETAS.some((p) => p.color.toLowerCase() === f.color_marca.toLowerCase())

  return (
    <form onSubmit={guardar} className="space-y-4">
      {/* ---------- Apariencia ---------- */}
      <section className="tarjeta space-y-4">
        <h3 className="font-bold text-slate-900">🎨 Apariencia</h3>

        <div>
          <label className="etiqueta" htmlFor="anombre">Nombre de la tienda</label>
          <input id="anombre" className="input" maxLength={60} value={f.nombre_tienda}
            onChange={(e) => set('nombre_tienda', e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="aencargada">Nombre de quien atiende la tienda</label>
          <input id="aencargada" className="input" maxLength={40} value={f.nombre_encargada}
            onChange={(e) => set('nombre_encargada', e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Aparece en la app, por ejemplo: “Pídele a {f.nombre_encargada || 'Karla'} que lo restablezca”.</p>
        </div>
        <div>
          <label className="etiqueta" htmlFor="afrase">Frase de bienvenida</label>
          <input id="afrase" className="input" maxLength={80} value={f.frase}
            onChange={(e) => set('frase', e.target.value)} />
        </div>

        <div>
          <p className="etiqueta">Color principal</p>
          <div className="grid grid-cols-5 gap-2">
            {PALETAS.map((p) => {
              const activo = p.color.toLowerCase() === f.color_marca.toLowerCase()
              return (
                <button key={p.color} type="button" onClick={() => elegirColor(p.color)} title={p.nombre}
                  aria-label={p.nombre} aria-pressed={activo}
                  className={`flex aspect-square items-center justify-center rounded-xl text-lg text-white transition ${
                    activo ? 'scale-110 ring-4 ring-slate-300' : 'active:scale-90'
                  }`}
                  style={{ background: p.color }}>
                  {activo && '✓'}
                </button>
              )
            })}
          </div>
          <label className={`mt-2 flex items-center gap-3 rounded-xl p-2 ring-1 ${personalizado ? 'ring-marca' : 'ring-slate-200'}`}>
            <input type="color" value={f.color_marca} onChange={(e) => elegirColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
            <span className="text-sm text-slate-600">Otro color: <b className="font-mono">{f.color_marca}</b></span>
          </label>
        </div>

        <div>
          <p className="etiqueta">Ícono de la tienda</p>
          <div className="flex items-center gap-3">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-marca-claro text-4xl">
              {vistaLogo ? <img src={vistaLogo} alt="" className="h-full w-full object-cover" /> : f.emoji}
            </span>
            <div className="flex flex-col gap-2">
              <label className="btn-secundario cursor-pointer py-1.5 text-center text-sm">
                {vistaLogo ? 'Cambiar logo' : 'Subir logo'}
                <input type="file" accept="image/*" className="hidden" onChange={elegirLogo} />
              </label>
              {vistaLogo && (
                <button type="button" onClick={() => setLogo({ quitar: true })} className="text-sm font-semibold text-red-600">
                  Usar emoji en vez de logo
                </button>
              )}
            </div>
          </div>
          {!vistaLogo && (
            <div className="mt-3 grid grid-cols-6 gap-2">
              {EMOJIS.map((em) => (
                <button key={em} type="button" onClick={() => set('emoji', em)}
                  className={`aspect-square rounded-xl text-2xl transition ${f.emoji === em ? 'scale-110 bg-marca-claro ring-2 ring-marca' : 'bg-slate-100 active:scale-90'}`}>
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="etiqueta">Vista del menú</p>
          <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
            {[[1, '☰ Lista'], [2, '▦ 2 columnas'], [3, '▩ 3 columnas']].map(([n, t]) => (
              <button key={n} type="button" onClick={() => set('columnas_menu', n)}
                className={`rounded-xl py-2.5 transition ${Number(f.columnas_menu) === n ? 'bg-marca text-sobre-marca shadow' : 'bg-slate-100 text-slate-600'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">El modo claro u oscuro lo elige cada persona en Mi cuenta → Mi perfil.</p>
      </section>

      {/* ---------- Cuentas ---------- */}
      <section className="tarjeta space-y-4">
        <h3 className="font-bold text-slate-900">💵 Cuentas</h3>
        <Interruptor activo={f.pagos_clientes} onCambio={(v) => set('pagos_clientes', v)}
          etiqueta="Clientes pueden avisar sus pagos"
          ayuda={`Al comprar pueden marcar “Ya pagué” y agregar crédito. Nada se aplica hasta que ${f.nombre_encargada || 'Karla'} lo apruebe. Si se apaga, solo ${f.nombre_encargada || 'Karla'} registra pagos.`} />
        <Interruptor activo={f.permitir_saldo_favor} onCambio={(v) => set('permitir_saldo_favor', v)}
          etiqueta="Permitir crédito a favor" ayuda="Aceptar pagos por adelantado que se descuentan en cada compra." />
        <Interruptor activo={f.mostrar_deudas} onCambio={(v) => set('mostrar_deudas', v)}
          etiqueta="Mostrar deudas entre clientes" ayuda="Si se activa, todos podrán ver cuánto debe cada uno." />
        <div>
          <label className="etiqueta" htmlFor="amin">Minutos para que un cliente borre su compra</label>
          <input id="amin" className="input" type="number" min="0" max="60" value={f.minutos_borrar}
            onChange={(e) => set('minutos_borrar', e.target.value)} />
        </div>
      </section>

      {/* ---------- Notificaciones ---------- */}
      <section className="tarjeta space-y-4">
        <h3 className="font-bold text-slate-900">🔔 Notificaciones</h3>
        <Interruptor activo={f.recordatorio_activo} onCambio={(v) => set('recordatorio_activo', v)}
          etiqueta="Recordatorio semanal de saldo"
          ayuda="Los viernes a las 3:00 p. m., a quienes deban y tengan los avisos activados." />
        {f.recordatorio_activo && (
          <div className="animar-entrada">
            <label className="etiqueta" htmlFor="arecmin">Solo si deben al menos ($)</label>
            <input id="arecmin" className="input" type="number" step="0.25" min="0" value={f.recordatorio_minimo}
              onChange={(e) => set('recordatorio_minimo', e.target.value)} />
          </div>
        )}
        <Interruptor activo={f.notificar_stock} onCambio={(v) => set('notificar_stock', v)}
          etiqueta="Avisarme cuando algo se agote" ayuda="Llega a la administración y a quien maneje inventario." />
        {f.notificar_stock && (
          <div className="animar-entrada">
            <label className="etiqueta" htmlFor="aumbral">Avisar también cuando queden</label>
            <input id="aumbral" className="input" type="number" min="0" max="50" value={f.stock_bajo_umbral}
              onChange={(e) => set('stock_bajo_umbral', e.target.value)} />
          </div>
        )}
        <p className="text-xs text-slate-500">Para recibirlas, activa los avisos en Mi cuenta → Mi perfil.</p>
      </section>

      <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10">
        <button disabled={guardando} className="btn-primario w-full shadow-lg">
          {guardando ? 'Guardando…' : 'Guardar ajustes'}
        </button>
      </div>
    </form>
  )
}
