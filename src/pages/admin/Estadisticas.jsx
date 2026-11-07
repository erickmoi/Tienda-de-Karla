import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dinero, mensajeError } from '../../lib/format'
import { Cargando, Vacio } from '../../components/ui'

// Fecha de hoy en El Salvador, como YYYY-MM-DD
const hoySV = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(new Date())
const restarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const inicioMes = (iso) => `${iso.slice(0, 8)}01`
const fmtDia = new Intl.DateTimeFormat('es-SV', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const RANGOS = [
  { id: 'hoy', titulo: 'Hoy', calc: (h) => [h, h] },
  { id: '7d', titulo: '7 días', calc: (h) => [restarDias(h, 6), h] },
  { id: 'mes', titulo: 'Este mes', calc: (h) => [inicioMes(h), h] },
  { id: '30d', titulo: '30 días', calc: (h) => [restarDias(h, 29), h] },
]

export default function Estadisticas({ avisar }) {
  const [rango, setRango] = useState('7d')
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)

  const [desde, hasta] = useMemo(() => RANGOS.find((r) => r.id === rango).calc(hoySV()), [rango])

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase.rpc('estadisticas', { p_desde: desde, p_hasta: hasta })
    setCargando(false)
    if (error) return avisar('error', mensajeError(error))
    setDatos(data)
  }, [desde, hasta, avisar])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {RANGOS.map((r) => (
          <button key={r.id} onClick={() => setRango(r.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
              rango === r.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}>
            {r.titulo}
          </button>
        ))}
      </div>

      {cargando && !datos ? <Cargando /> : datos && (
        <div className={`space-y-4 ${cargando ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 gap-3">
            <Dato titulo="Ventas" valor={dinero(datos.ventas)} sub={`${datos.compras} compras · ${datos.unidades} u.`} />
            <Dato titulo="Ganancia" valor={dinero(datos.ganancia)}
              sub={Number(datos.ventas) > 0 ? `${Math.round((datos.ganancia / datos.ventas) * 100)}% de margen` : 'Sin ventas'} />
            <Dato titulo="Cobrado" valor={dinero(datos.cobrado)} sub="Pagos menos devoluciones" />
            <Dato titulo="Por cobrar hoy" valor={dinero(datos.por_cobrar)} sub={`${dinero(datos.a_favor)} en saldos a favor`} />
          </div>

          {rango !== 'hoy' && <VentasPorDia dias={datos.por_dia} desde={desde} hasta={hasta} />}

          <section className="tarjeta">
            <h3 className="mb-2 font-semibold text-slate-800">Más vendidos</h3>
            {datos.top.length === 0 ? <Vacio>Sin ventas en este período.</Vacio> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="pb-1 font-medium">Producto</th>
                    <th className="pb-1 text-right font-medium">Unid.</th>
                    <th className="pb-1 text-right font-medium">Ventas</th>
                    <th className="pb-1 text-right font-medium">Ganancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {datos.top.map((t) => (
                    <tr key={t.nombre}>
                      <td className="py-1.5 pr-2">{t.nombre}</td>
                      <td className="py-1.5 text-right tabular-nums">{t.unidades}</td>
                      <td className="py-1.5 text-right tabular-nums">{dinero(t.ventas)}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-600">{dinero(t.ganancia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="tarjeta">
            <h3 className="mb-2 font-semibold text-slate-800">Por acabarse</h3>
            {datos.stock_bajo.length === 0 ? <Vacio>Todo con buen stock.</Vacio> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {datos.stock_bajo.map((s) => (
                  <li key={s.nombre} className="flex justify-between py-1.5">
                    <span>{s.nombre}</span>
                    <span className={`font-semibold ${s.agotado ? 'text-rose-600' : 'text-amber-700'}`}>
                      {s.agotado ? '⛔ Agotado' : `⚠️ Quedan ${s.stock}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function Dato({ titulo, valor, sub }) {
  return (
    <div className="tarjeta">
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
    </div>
  )
}

// Barras de ventas por día (una sola serie; los días sin ventas cuentan como 0)
function VentasPorDia({ dias, desde, hasta }) {
  const [activo, setActivo] = useState(null)
  const serie = useMemo(() => {
    const mapa = Object.fromEntries(dias.map((d) => [d.dia, d]))
    const res = []
    for (let d = desde; d <= hasta; d = restarDias(d, -1)) {
      res.push({ dia: d, ventas: Number(mapa[d]?.ventas ?? 0), ganancia: Number(mapa[d]?.ganancia ?? 0) })
    }
    return res
  }, [dias, desde, hasta])

  const max = Math.max(...serie.map((s) => s.ventas), 0)
  const sel = activo != null ? serie[activo] : null

  return (
    <section className="tarjeta">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-800">Ventas por día</h3>
        <p className="text-xs text-slate-500">
          {sel ? <>{fmtDia.format(new Date(`${sel.dia}T00:00:00Z`))}: <b className="text-slate-800">{dinero(sel.ventas)}</b> · ganancia {dinero(sel.ganancia)}</>
            : `Máximo ${dinero(max)}`}
        </p>
      </div>
      {max === 0 ? <Vacio>Sin ventas en este período.</Vacio> : (
        <>
          <div className="flex h-36 items-end gap-0.5 border-b border-slate-200" onMouseLeave={() => setActivo(null)}>
            {serie.map((s, i) => (
              <button
                key={s.dia}
                type="button"
                aria-label={`${s.dia}: ${dinero(s.ventas)}`}
                onMouseEnter={() => setActivo(i)}
                onClick={() => setActivo(i === activo ? null : i)}
                className="flex h-full min-w-0 flex-1 items-end"
              >
                <span
                  className={`block w-full rounded-t ${activo === i ? 'bg-marca' : 'bg-marca/70'}`}
                  style={{ height: `${s.ventas > 0 ? Math.max(3, (s.ventas / max) * 100) : 0}%` }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>{fmtDia.format(new Date(`${desde}T00:00:00Z`))}</span>
            <span>{fmtDia.format(new Date(`${hasta}T00:00:00Z`))}</span>
          </div>
        </>
      )}
    </section>
  )
}
