import { supabase } from './supabase'
import { dinero } from './format'

const hoySV = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador' }).format(new Date())

// Promociones vigentes con sus productos
export async function cargarPromos() {
  const { data, error } = await supabase
    .from('promociones')
    .select('id, nombre, tipo, cantidad, precio, activo, desde, hasta, orden, promocion_productos(producto_id, cantidad)')
    .eq('activo', true)
    .order('orden')
    .order('id')
  if (error) throw error
  const hoy = hoySV()
  return (data ?? []).filter((p) => (!p.desde || p.desde <= hoy) && (!p.hasta || p.hasta >= hoy))
}

// Texto corto para la etiqueta: "2 × $0.25" o "Combo $1.00"
export const etiquetaPromo = (p) =>
  p.tipo === 'cantidad' ? `${p.cantidad} × ${dinero(p.precio)}` : `Combo ${dinero(p.precio)}`

// Mismo cálculo que private.calcular_descuentos() en la base de datos.
// items: [{ producto_id, cantidad, precio }]
export function calcularDescuentos(items, promos) {
  const rem = {}
  const precio = {}
  for (const i of items) {
    rem[i.producto_id] = (rem[i.producto_id] ?? 0) + i.cantidad
    precio[i.producto_id] = Number(i.precio)
  }
  const aplicadas = []
  for (const pr of promos) {
    const pps = pr.promocion_productos ?? []
    if (!pps.length) continue
    if (pr.tipo === 'combo') {
      const veces = Math.min(...pps.map((pp) => Math.floor((rem[pp.producto_id] ?? 0) / pp.cantidad)))
      const normal = pps.reduce((s, pp) => s + pp.cantidad * (precio[pp.producto_id] ?? 0), 0)
      const desc = redondear(normal * veces - Number(pr.precio) * veces)
      if (veces > 0 && desc > 0) {
        for (const pp of pps) rem[pp.producto_id] -= pp.cantidad * veces
        aplicadas.push({ promo: pr, veces, descuento: desc })
      }
    } else {
      const incluidos = pps.filter((pp) => rem[pp.producto_id] !== undefined)
      const total = incluidos.reduce((s, pp) => s + rem[pp.producto_id], 0)
      const veces = Math.floor(total / pr.cantidad)
      if (veces <= 0) continue
      let falta = veces * pr.cantidad
      let normal = 0
      const orden = [...incluidos].sort((a, b) => precio[b.producto_id] - precio[a.producto_id] || a.producto_id - b.producto_id)
      const consumo = {}
      for (const pp of orden) {
        if (!falta) break
        const toma = Math.min(rem[pp.producto_id], falta)
        normal += toma * precio[pp.producto_id]
        falta -= toma
        consumo[pp.producto_id] = toma
      }
      const desc = redondear(normal - Number(pr.precio) * veces)
      if (desc > 0) {
        for (const [id, n] of Object.entries(consumo)) rem[id] -= n
        aplicadas.push({ promo: pr, veces, descuento: desc })
      }
    }
  }
  return aplicadas
}

const redondear = (n) => Math.round(n * 100) / 100

// Texto de cuánto falta para activar una promo, para animar a completar
export function faltaParaPromo(pr, carrito) {
  if (pr.tipo !== 'cantidad') return null
  const enCarrito = (pr.promocion_productos ?? []).reduce((s, pp) => s + (carrito[pp.producto_id] ?? 0), 0)
  if (enCarrito === 0) return null
  const resto = enCarrito % pr.cantidad
  return resto === 0 ? null : pr.cantidad - resto
}
