import { supabase } from './supabase'

// Compras guardadas en este dispositivo cuando no había internet.
// Se envían solas al volver la conexión (el precio y el stock se validan en ese momento).
const CLAVE = 'tienda.cola'

const leer = () => {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') } catch { return [] }
}
const escribir = (lista) => {
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)) } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event('cola-cambio'))
}

export const pendientes = () => leer()

export function encolar(pedido) {
  escribir([...leer(), { ...pedido, id: crypto.randomUUID(), guardado: Date.now() }])
}

export const esErrorDeRed = (error) =>
  !navigator.onLine || /failed to fetch|network|load failed|fetch/i.test(error?.message ?? '')

// Intenta enviar todo; devuelve { enviados, fallidos: [{pedido, mensaje}] }
let enviando = false
export async function enviarPendientes() {
  if (enviando || !navigator.onLine) return { enviados: 0, fallidos: [] }
  enviando = true
  const lista = leer()
  const quedan = []
  const fallidos = []
  let enviados = 0
  for (const p of lista) {
    const { error } = await supabase.rpc('registrar_compra', {
      p_items: p.items, p_pagado: p.pagado, p_metodo: p.metodo, p_referencia: p.referencia,
    })
    if (!error) enviados++
    else if (esErrorDeRed(error)) quedan.push(p)
    else fallidos.push({ pedido: p, mensaje: error.message })
  }
  escribir(quedan)
  enviando = false
  return { enviados, fallidos }
}
