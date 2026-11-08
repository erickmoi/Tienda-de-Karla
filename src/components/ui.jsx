import { useEffect, useMemo } from 'react'
import Icono from './Icono'

export function Aviso({ aviso, onCerrar }) {
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(onCerrar, 3500)
    return () => clearTimeout(t)
  }, [aviso, onCerrar])
  if (!aviso) return null
  const color = aviso.tipo === 'error' ? 'bg-red-600' : 'bg-emerald-600'
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top)+var(--espacio-arriba))] z-[60] flex justify-center px-4">
      <div
        key={aviso.texto}
        role="status"
        onClick={onCerrar}
        className={`${color} animar-entrada pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg`}
      >
        {aviso.texto}
      </div>
    </div>
  )
}

// Esqueleto de carga genérico (lista de tarjetas)
export function Cargando({ filas = 4 }) {
  return (
    <div className="space-y-3 py-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="esqueleto h-16" />
      ))}
    </div>
  )
}

export function Vacio({ children }) {
  return <p className="animar-entrada py-8 text-center text-sm text-slate-500">{children}</p>
}

export function Hoja({ titulo, icono, onCerrar, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [onCerrar])

  return (
    <div className="animar-fondo fixed inset-0 z-40 flex items-end justify-center bg-black/45 sm:items-center" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        className="animar-hoja max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-superficie p-5 pb-8 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            {icono && <Icono n={icono} size={24} className="text-marca-texto" />}{titulo}
          </h2>
          <button onClick={onCerrar} className="rounded-full px-3 py-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <Icono n="cerrar" size={20} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Contador({ valor, onMenos, onMas, maxAlcanzado }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onMenos}
        disabled={valor === 0}
        className="h-9 w-9 rounded-full bg-slate-100 text-lg font-bold text-slate-700 transition active:scale-90 disabled:opacity-30"
        aria-label="Quitar uno"
      >
        −
      </button>
      <span key={valor} className="animar-pop w-6 text-center font-semibold tabular-nums">{valor}</span>
      <button
        onClick={onMas}
        disabled={maxAlcanzado}
        className="h-9 w-9 rounded-full bg-marca text-lg font-bold text-sobre-marca transition active:scale-90 disabled:opacity-30"
        aria-label="Agregar uno"
      >
        +
      </button>
    </div>
  )
}

// Pantalla de éxito con check animado y confeti
const COLORES_CONFETI = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#ec4899']
export function Exito({ texto, sub, onFin }) {
  useEffect(() => {
    const t = setTimeout(onFin, 1700)
    return () => clearTimeout(t)
  }, [onFin])

  const piezas = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, i) => ({
        left: `${Math.random() * 100}%`,
        background: COLORES_CONFETI[i % COLORES_CONFETI.length],
        animationDelay: `${Math.random() * 0.25}s`,
        '--dx': `${(Math.random() - 0.5) * 120}px`,
        '--rot': `${360 + Math.random() * 540}deg`,
      })),
    [],
  )

  return (
    <div className="animar-fondo fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/30" onClick={onFin}>
      {piezas.map((s, i) => <span key={i} className="confeti" style={s} />)}
      <div className="animar-hoja flex flex-col items-center rounded-3xl bg-superficie px-10 py-8 shadow-2xl">
        <svg viewBox="0 0 52 52" className="h-20 w-20">
          <circle cx="26" cy="26" r="24" fill="var(--color-marca)" />
          <path className="check-trazo" d="M15 27 l7 7 l15 -16" fill="none" stroke="var(--color-sobre-marca)"
            strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mt-4 text-xl font-bold text-slate-900">{texto}</p>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
    </div>
  )
}

export function Interruptor({ activo, onCambio, etiqueta, ayuda, disabled }) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <span>
        <span className="block font-medium text-slate-800">{etiqueta}</span>
        {ayuda && <span className="text-sm text-slate-500">{ayuda}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={disabled}
        onClick={() => onCambio(!activo)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? 'bg-marca' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : ''}`} />
      </button>
    </label>
  )
}
