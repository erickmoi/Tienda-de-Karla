import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dinero, fecha, mensajeError } from '../../lib/format'
import { descargarCSV, fechaCSV } from '../../lib/csv'
import FilaDeslizable from '../../components/FilaDeslizable'
import { Cargando, Vacio } from '../../components/ui'
import Icono from '../../components/Icono'

const hoySV = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(new Date())
const restarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const RANGOS = [
  { id: 'hoy', titulo: 'Hoy', calc: (h) => [h, h] },
  { id: 'ayer', titulo: 'Ayer', calc: (h) => [restarDias(h, 1), restarDias(h, 1)] },
  { id: 'semana', titulo: '7 días', calc: (h) => [restarDias(h, 6), h] },
  { id: 'mes', titulo: 'Este mes', calc: (h) => [`${h.slice(0, 8)}01`, h] },
]

export default function Caja({ avisar }) {
  const [rango, setRango] = useState('hoy')
  const [datos, setDatos] = useState(null)
  const [contado, setContado] = useState('')
  const [desde, hasta] = useMemo(() => RANGOS.find((r) => r.id === rango).calc(hoySV()), [rango])

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('cuadre_caja', { p_desde: desde, p_hasta: hasta })
    if (error) return avisar('error', mensajeError(error))
    setDatos(data)
  }, [desde, hasta, avisar])

  useEffect(() => { setDatos(null); cargar() }, [cargar])

  const diferencia = contado === '' || !datos ? null : Number(contado) - Number(datos.efectivo)

  return (
    <div className="space-y-4">
      <FilaDeslizable>
        {RANGOS.map((r) => (
          <button key={r.id} onClick={() => setRango(r.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
              rango === r.id ? 'bg-slate-800 text-slate-50' : 'bg-superficie text-slate-600 ring-1 ring-slate-200'}`}>
            {r.titulo}
          </button>
        ))}
      </FilaDeslizable>

      {!datos ? <Cargando /> : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Dato icono="efectivo" titulo="Efectivo recibido" valor={dinero(datos.efectivo)} destacado />
            <Dato icono="banco" titulo="Transferencias" valor={dinero(datos.transferencias)} />
            <Dato icono="carrito" titulo="Ventas" valor={dinero(datos.ventas)}
              sub={`${datos.num_compras} compras${Number(datos.descuentos) > 0 ? ` · ${dinero(datos.descuentos)} en promos` : ''}`} />
            <Dato icono="espera" titulo="Por aprobar" valor={dinero(datos.por_aprobar)} sub="Pagos avisados por clientes" />
          </div>

          <section className="tarjeta space-y-2">
            <h3 className="font-bold text-slate-900">Cuadrar el efectivo</h3>
            <p className="text-sm text-slate-500">Cuenta el dinero que tienes y escríbelo. Si no cuadra, revisa los pagos de abajo.</p>
            <div className="flex items-center gap-3">
              <input className="input text-lg font-bold" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                value={contado} onChange={(e) => setContado(e.target.value)} aria-label="Efectivo contado" />
              {diferencia !== null && (
                <span className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${
                  Math.abs(diferencia) < 0.005 ? 'bg-emerald-50 text-emerald-700'
                    : diferencia > 0 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
                  {Math.abs(diferencia) < 0.005 ? 'Cuadra' : diferencia > 0 ? `Sobran ${dinero(diferencia)}` : `Faltan ${dinero(-diferencia)}`}
                </span>
              )}
            </div>
          </section>

          <section className="tarjeta">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Pagos del período</h3>
              {datos.pagos.length > 0 && (
                <button onClick={() => descargarCSV(`caja_${desde}_${hasta}.csv`,
                  ['Fecha', 'Cliente', 'Tipo', 'Método', 'Monto', 'Referencia'],
                  datos.pagos.map((p) => [fechaCSV(p.fecha), p.nombre, p.tipo, p.metodo, Number(p.monto).toFixed(2), p.referencia ?? '']))}
                  className="text-sm font-semibold text-marca-texto">⬇️ Exportar</button>
              )}
            </div>
            {datos.pagos.length === 0 ? <Vacio>Sin pagos en este período.</Vacio> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {datos.pagos.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{p.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {fecha(p.fecha)} · {p.metodo === 'efectivo' ? 'Efectivo' : 'Transferencia'}{p.referencia ? ` · ${p.referencia}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 font-bold tabular-nums ${p.tipo === 'pago' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {p.tipo === 'pago' ? '+' : '−'}{dinero(p.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-center text-xs text-slate-500">Total por cobrar hoy: <b>{dinero(datos.por_cobrar)}</b></p>
        </>
      )}
    </div>
  )
}

function Dato({ icono, titulo, valor, sub, destacado }) {
  return (
    <div className={`tarjeta ${destacado ? 'ring-2 ring-emerald-300' : ''}`}>
      <p className="text-xs text-slate-500">{icono && <Icono n={icono} size={15} className="mr-1 -mt-0.5 align-middle text-marca-texto" />}{titulo}</p>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}
