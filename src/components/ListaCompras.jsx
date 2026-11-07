import { dinero, fecha } from '../lib/format'
import { Vacio } from './ui'

// Estado de pago de una compra según su reporte (si lo tiene)
const ESTADO_COMPRA = {
  aprobado: { texto: '✅ Pagada', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  pendiente: { texto: '⏳ Pago en revisión', clase: 'bg-amber-50 text-amber-800 ring-amber-200' },
  rechazado: { texto: '📒 A cuenta (pago no aprobado)', clase: 'bg-red-50 text-red-700 ring-red-200' },
}

function estadoDe(c) {
  const vigente = c.reportes_pago?.find((r) => r.estado === 'aprobado' || r.estado === 'pendiente')
  return vigente?.estado ?? c.reportes_pago?.find((r) => r.estado === 'rechazado')?.estado ?? null
}

// Lista de compras con su detalle. `accion(compra)` devuelve un botón opcional por compra.
export default function ListaCompras({ compras, accion }) {
  if (!compras.length) return <Vacio>Sin compras registradas.</Vacio>
  return (
    <ul className="escalonado space-y-2">
      {compras.map((c) => {
        const estado = !c.anulada && ESTADO_COMPRA[estadoDe(c)]
        return (
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
                <p className={`font-bold text-slate-900 ${c.anulada ? 'line-through' : ''}`}>{dinero(c.total)}</p>
                {c.anulada && <p className="text-xs font-semibold text-slate-500">Anulada</p>}
                {!c.anulada && Number(c.descuento) > 0 && (
                  <p className="text-xs font-semibold text-orange-600">🔥 −{dinero(c.descuento)}</p>
                )}
              </div>
            </div>
            {estado && (
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${estado.clase}`}>
                {estado.texto}
              </span>
            )}
            {!c.anulada && accion?.(c)}
          </li>
        )
      })}
    </ul>
  )
}

export function ListaPagos({ pagos }) {
  if (!pagos.length) return <Vacio>Sin pagos registrados.</Vacio>
  return (
    <ul className="escalonado space-y-2">
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

// Selector reutilizable de forma de pago (efectivo / transferencia + referencia)
export function FormaDePago({ metodo, setMetodo, referencia, setReferencia }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
        {[['efectivo', '💵 Efectivo'], ['transferencia', '🏦 Transferencia']].map(([k, t]) => (
          <button key={k} type="button" onClick={() => setMetodo(k)}
            className={`rounded-xl py-2 transition ${metodo === k ? 'bg-marca text-sobre-marca shadow' : 'bg-slate-100 text-slate-600'}`}>
            {t}
          </button>
        ))}
      </div>
      {metodo === 'transferencia' && (
        <input className="input animar-entrada" placeholder="Referencia o últimos dígitos (opcional)" maxLength={100}
          value={referencia} onChange={(e) => setReferencia(e.target.value)} />
      )}
    </div>
  )
}

export const SELECT_COMPRAS =
  'id, total, descuento, anulada, created_at, compra_items(cantidad, precio_unitario, productos(nombre)), reportes_pago(estado)'
export const SELECT_PAGOS = 'id, tipo, monto, metodo, referencia, created_at'
export const SELECT_REPORTES = 'id, monto, metodo, referencia, estado, compra_id, nota_revision, created_at, revisado_at'
