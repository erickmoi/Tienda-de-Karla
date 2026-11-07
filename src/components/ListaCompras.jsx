import { dinero, fecha } from '../lib/format'
import { Vacio } from './ui'

// Lista de compras con su detalle. `accion(compra)` devuelve un botón opcional por compra.
export default function ListaCompras({ compras, accion }) {
  if (!compras.length) return <Vacio>Sin compras registradas.</Vacio>
  return (
    <ul className="space-y-2">
      {compras.map((c) => (
        <li key={c.id} className={`tarjeta p-3 ${c.anulada ? 'opacity-50' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{fecha(c.created_at)}</p>
              <p className="text-sm text-slate-700">
                {c.compra_items
                  .map((i) => `${i.cantidad} × ${i.productos?.nombre ?? 'Producto'}`)
                  .join(', ')}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`font-bold ${c.anulada ? 'line-through' : ''}`}>{dinero(c.total)}</p>
              {c.anulada && <p className="text-xs font-semibold text-slate-500">Anulada</p>}
            </div>
          </div>
          {!c.anulada && accion?.(c)}
        </li>
      ))}
    </ul>
  )
}

export function ListaPagos({ pagos }) {
  if (!pagos.length) return <Vacio>Sin pagos registrados.</Vacio>
  return (
    <ul className="space-y-2">
      {pagos.map((p) => (
        <li key={p.id} className="tarjeta flex items-center justify-between p-3">
          <div>
            <p className="text-xs text-slate-500">{fecha(p.created_at)}</p>
            <p className="text-sm text-slate-700">
              {p.tipo === 'pago' ? 'Pago' : 'Devolución'} · {p.metodo === 'efectivo' ? 'Efectivo' : 'Transferencia'}
              {p.referencia ? ` · ${p.referencia}` : ''}
            </p>
          </div>
          <p className={`font-bold ${p.tipo === 'pago' ? 'text-emerald-700' : 'text-amber-700'}`}>
            {p.tipo === 'pago' ? '−' : '+'}
            {dinero(p.monto)}
          </p>
        </li>
      ))}
    </ul>
  )
}

export const SELECT_COMPRAS =
  'id, total, anulada, created_at, compra_items(cantidad, precio_unitario, productos(nombre))'
export const SELECT_PAGOS = 'id, tipo, monto, metodo, referencia, created_at'
