import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/format'
import { useApariencia } from '../../lib/apariencia'
import { aplicarColor, PALETAS } from '../../lib/tema'
import { borrarFoto, prepararFoto, subirFoto } from '../../lib/fotos'
import { Cargando, Interruptor } from '../../components/ui'
import MetodosPago from './MetodosPago'

const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
const horaTxt = (h) => (h === 24 ? '12:00 a. m. (medianoche)' : `${h % 12 || 12}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`)

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

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

  async function elegirLogo(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    try {
      const lista = await prepararFoto(archivo)
      setLogo({ archivo: lista, vista: lista.vista })
    } catch (err) {
      avisar('error', mensajeError(err))
    }
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      let logo_url = f.logo_url
      if (logo?.archivo) logo_url = await subirFoto('tienda', logo.archivo)
      if (logo?.quitar) logo_url = null

      const fila = {
        nombre_tienda: f.nombre_tienda.trim() || 'Tienda de Karla',
        nombre_encargada: f.nombre_encargada.trim() || 'Karla',
        pagos_clientes: f.pagos_clientes,
        pagos_auto: f.pagos_auto,
        mostrar_stock: f.mostrar_stock,
        frase: f.frase.trim(),
        emoji: f.emoji || '🍿',
        logo_url,
        color_marca: f.color_marca,
        columnas_menu: Number(f.columnas_menu),
        permitir_saldo_favor: f.permitir_saldo_favor,
        mostrar_deudas: f.mostrar_deudas,
        minutos_borrar: Math.min(60, Math.max(0, parseInt(f.minutos_borrar, 10) || 0)),
        recordatorio_activo: f.recordatorio_activo,
        recordatorio_quincena: f.recordatorio_quincena,
        recordatorio_dia: Number(f.recordatorio_dia),
        recordatorio_hora: Number(f.recordatorio_hora),
        registro: f.registro,
        horario_modo: f.horario_modo,
        tienda_abierta: f.tienda_abierta,
        hora_apertura: Number(f.hora_apertura),
        hora_cierre: Number(f.hora_cierre),
        dias_abierta: f.dias_abierta,
        mensaje_cerrado: f.mensaje_cerrado.trim() || 'La tienda está cerrada por ahora.',
        limite_deuda: f.limite_deuda === '' || f.limite_deuda === null ? null : Math.max(0, Number(f.limite_deuda)),
        limite_bloquea: f.limite_bloquea,
        recordatorio_minimo: Math.max(0, Number(f.recordatorio_minimo) || 0),
        notificar_stock: f.notificar_stock,
        stock_bajo_umbral: Math.min(50, Math.max(0, parseInt(f.stock_bajo_umbral, 10) || 0)),
      }
      // Solo se envía lo que cambió: así no se pisan los cambios que otra persona
      // de administración haya guardado mientras esta pantalla estaba abierta.
      const cambios = Object.fromEntries(Object.entries(fila).filter(([k, v]) => !igual(v, original[k])))
      if (!Object.keys(cambios).length) {
        avisar('ok', 'No había cambios por guardar.')
        return
      }
      const { data: guardado, error } = await supabase.from('ajustes').update(cambios).eq('id', 1).select('*').single()
      if (error) throw error

      if (logo_url !== original.logo_url && original.logo_url) await borrarFoto(original.logo_url).catch(() => {})
      setF(guardado)
      setOriginal(guardado)
      setLogo(null)
      await recargar()
      avisar('ok', 'Ajustes guardados.')
    } catch (err) {
      avisar('error', mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const pendientes = !!logo || Object.keys(f).some((k) => !igual(f[k], original[k]))
  const vistaLogo = logo?.quitar ? null : logo?.vista ?? f.logo_url
  const personalizado = !PALETAS.some((p) => p.color.toLowerCase() === f.color_marca.toLowerCase())

  return (
    <div className="space-y-4">
    <MetodosPago avisar={avisar} />
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

        <Interruptor activo={f.mostrar_stock} onCambio={(v) => set('mostrar_stock', v)}
          etiqueta="Mostrar cuántos quedan"
          ayuda="Los clientes ven “Quedan 7” en cada producto y se va descontando con cada compra." />
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
        {f.pagos_clientes && (
          <div className="animar-entrada">
            <Interruptor activo={!f.pagos_auto} onCambio={(v) => set('pagos_auto', !v)}
              etiqueta={`${f.nombre_encargada || 'Karla'} confirma cada pago`}
              ayuda={f.pagos_auto
                ? 'Apagado: los pagos que avisan los clientes se aplican al instante, sin revisión.'
                : `Encendido: los pagos quedan en revisión hasta que ${f.nombre_encargada || 'Karla'} los apruebe.`} />
          </div>
        )}
        <Interruptor activo={f.permitir_saldo_favor} onCambio={(v) => set('permitir_saldo_favor', v)}
          etiqueta="Permitir crédito a favor" ayuda="Aceptar pagos por adelantado que se descuentan en cada compra." />
        <Interruptor activo={f.mostrar_deudas} onCambio={(v) => set('mostrar_deudas', v)}
          etiqueta="Mostrar deudas entre clientes" ayuda="Si se activa, todos podrán ver cuánto debe cada uno." />
        <div>
          <label className="etiqueta" htmlFor="amin">Minutos para que un cliente borre su compra</label>
          <input id="amin" className="input" type="number" min="0" max="60" value={f.minutos_borrar}
            onChange={(e) => set('minutos_borrar', e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="alim">Límite de deuda general ($)</label>
          <input id="alim" className="input" type="number" inputMode="decimal" step="0.5" min="0" placeholder="Sin límite"
            value={f.limite_deuda ?? ''} onChange={(e) => set('limite_deuda', e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Vacío = sin límite. Puedes poner uno distinto a cada persona en Usuarios.</p>
        </div>
        {Number(f.limite_deuda) > 0 && (
          <div className="animar-entrada">
            <Interruptor activo={f.limite_bloquea} onCambio={(v) => set('limite_bloquea', v)}
              etiqueta="Bloquear al pasar el límite"
              ayuda={f.limite_bloquea ? 'No podrán registrar a cuenta hasta pagar (sí pueden marcar “Ya pagué”).' : 'Solo se les muestra un aviso.'} />
          </div>
        )}
      </section>

      {/* ---------- Registro ---------- */}
      <section className="tarjeta space-y-3">
        <h3 className="font-bold text-slate-900">👤 Registro de cuentas</h3>
        <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
          {[['abierto', '🟢 Abierto'], ['aprobacion', '🟡 Con aprobación'], ['cerrado', '🔴 Cerrado']].map(([k, t]) => (
            <button key={k} type="button" onClick={() => set('registro', k)}
              className={`rounded-xl px-1 py-2.5 transition ${f.registro === k ? 'bg-marca text-sobre-marca shadow' : 'bg-slate-100 text-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {f.registro === 'abierto' && 'Cualquiera con el enlace puede crear su cuenta y comprar.'}
          {f.registro === 'aprobacion' && `Pueden crear su cuenta, pero no compran hasta que ${f.nombre_encargada || 'Karla'} la apruebe en Usuarios.`}
          {f.registro === 'cerrado' && `Solo ${f.nombre_encargada || 'Karla'} crea cuentas, desde Usuarios → Crear cuenta.`}
        </p>
      </section>

      {/* ---------- Horario ---------- */}
      <section className="tarjeta space-y-3">
        <h3 className="font-bold text-slate-900">🕐 Horario de la tienda</h3>
        <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
          {[['siempre', 'Siempre abierta'], ['manual', 'Abrir/cerrar a mano'], ['horario', 'Por horario']].map(([k, t]) => (
            <button key={k} type="button" onClick={() => set('horario_modo', k)}
              className={`rounded-xl px-1 py-2.5 transition ${f.horario_modo === k ? 'bg-marca text-sobre-marca shadow' : 'bg-slate-100 text-slate-600'}`}>
              {t}
            </button>
          ))}
        </div>
        {f.horario_modo === 'manual' && (
          <div className="animar-entrada">
            <Interruptor activo={f.tienda_abierta} onCambio={(v) => set('tienda_abierta', v)}
              etiqueta={f.tienda_abierta ? '🟢 Tienda abierta' : '🔴 Tienda cerrada'} />
          </div>
        )}
        {f.horario_modo === 'horario' && (
          <div className="animar-entrada space-y-3">
            <div className="grid grid-cols-7 gap-1">
              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => {
                const activo = f.dias_abierta.includes(i)
                return (
                  <button key={i} type="button" aria-pressed={activo}
                    onClick={() => set('dias_abierta', activo ? f.dias_abierta.filter((x) => x !== i) : [...f.dias_abierta, i].sort())}
                    className={`aspect-square rounded-lg text-sm font-bold ${activo ? 'bg-marca text-sobre-marca' : 'bg-slate-100 text-slate-500'}`}>
                    {d}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="etiqueta" htmlFor="aabre">Abre</label>
                <select id="aabre" className="input" value={f.hora_apertura} onChange={(e) => set('hora_apertura', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{horaTxt(h)}</option>)}
                </select>
              </div>
              <div>
                <label className="etiqueta" htmlFor="acierra">Cierra</label>
                <select id="acierra" className="input" value={f.hora_cierre} onChange={(e) => set('hora_cierre', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{horaTxt(h)}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
        {f.horario_modo !== 'siempre' && (
          <div className="animar-entrada">
            <label className="etiqueta" htmlFor="amsj">Mensaje cuando está cerrada</label>
            <input id="amsj" className="input" maxLength={120} value={f.mensaje_cerrado} onChange={(e) => set('mensaje_cerrado', e.target.value)} />
          </div>
        )}
      </section>

      {/* ---------- Notificaciones ---------- */}
      <section className="tarjeta space-y-4">
        <h3 className="font-bold text-slate-900">🔔 Notificaciones</h3>
        <Interruptor activo={f.recordatorio_activo} onCambio={(v) => set('recordatorio_activo', v)}
          etiqueta="Recordatorio semanal de saldo"
          ayuda={`Los ${DIAS[f.recordatorio_dia]} a las ${horaTxt(f.recordatorio_hora)}, a quienes deban y tengan los avisos activados.`} />
        {f.recordatorio_activo && (
          <div className="animar-entrada grid grid-cols-2 gap-2">
            <div>
              <label className="etiqueta" htmlFor="arecdia">Día</label>
              <select id="arecdia" className="input" value={f.recordatorio_dia} onChange={(e) => set('recordatorio_dia', Number(e.target.value))}>
                {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta" htmlFor="arechora">Hora</label>
              <select id="arechora" className="input" value={f.recordatorio_hora} onChange={(e) => set('recordatorio_hora', Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{horaTxt(h)}</option>)}
              </select>
            </div>
          </div>
        )}
        <Interruptor activo={f.recordatorio_quincena} onCambio={(v) => set('recordatorio_quincena', v)}
          etiqueta="Recordatorio de quincena"
          ayuda="El 15 y el 30 de cada mes a las 4:00 pm (en febrero, el último día), a quienes deban y tengan los avisos activados." />
        {(f.recordatorio_activo || f.recordatorio_quincena) && (
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
        {pendientes && (
          <p className="animar-entrada mb-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-center text-xs font-semibold text-amber-900 shadow">
            Tienes cambios sin guardar. Si sales sin guardar, se pierden.
          </p>
        )}
        <button disabled={guardando || !pendientes} className="btn-primario w-full shadow-lg disabled:opacity-60">
          {guardando ? 'Guardando…' : pendientes ? 'Guardar cambios' : 'Todo guardado ✓'}
        </button>
      </div>
    </form>
    </div>
  )
}
