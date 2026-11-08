import { useEffect, useState } from 'react'
import Icono from './Icono'
import { vibrar } from '../lib/tema'

/* global __VERSION__ */
const MI_VERSION = __VERSION__
const CADA = 10 * 60_000 // revisa cada 10 minutos mientras la app está abierta

async function hayNueva() {
  if (!import.meta.env.PROD || !navigator.onLine) return false
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return false
    const { version } = await r.json()
    return !!version && version !== MI_VERSION
  } catch {
    return false
  }
}

// Botón flotante "Actualizar" cuando se publica una versión nueva de la app
export default function AvisoActualizacion() {
  const [nueva, setNueva] = useState(false)
  const [actualizando, setActualizando] = useState(false)

  useEffect(() => {
    let vivo = true
    const revisar = async () => { if (vivo && (await hayNueva())) setNueva(true) }
    const alVolver = () => document.visibilityState === 'visible' && revisar()
    revisar()
    const t = setInterval(revisar, CADA)
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', revisar)
    return () => {
      vivo = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', revisar)
    }
  }, [])

  if (!nueva) return null

  async function actualizar() {
    vibrar(10)
    setActualizando(true)
    try {
      // Pide al service worker que busque la versión nueva y borra los archivos viejos guardados
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update().catch(() => {})
      const claves = await caches?.keys?.()
      await Promise.all((claves ?? []).map((k) => caches.delete(k)))
    } catch { /* igual se recarga */ }
    window.location.reload()
  }

  return (
    <div className="animar-entrada fixed inset-x-0 top-[calc(env(safe-area-inset-top)+var(--espacio-arriba)+0.5rem)] z-[55] flex justify-center px-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 py-2 pl-3 pr-2 text-white shadow-xl">
        <Icono n="todo" size={22} className="text-amber-300" />
        <span className="min-w-0 flex-1 text-sm">
          <b className="block leading-tight">Hay una versión nueva</b>
          <span className="text-xs text-slate-300">Con mejoras y arreglos</span>
        </span>
        <button onClick={() => setNueva(false)} aria-label="Más tarde" className="px-1 text-slate-400">
          <Icono n="cerrar" size={18} weight="bold" />
        </button>
        <button onClick={actualizar} disabled={actualizando}
          className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-slate-900 active:scale-95">
          {actualizando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
    </div>
  )
}
