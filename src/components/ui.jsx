import { useEffect } from 'react'

export function Aviso({ aviso, onCerrar }) {
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(onCerrar, 3500)
    return () => clearTimeout(t)
  }, [aviso, onCerrar])
  if (!aviso) return null
  const color = aviso.tipo === 'error' ? 'bg-red-600' : 'bg-emerald-600'
  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div
        role="status"
        onClick={onCerrar}
        className={`${color} max-w-md rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg`}
      >
        {aviso.texto}
      </div>
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }) {
  return <p className="py-10 text-center text-slate-500">{texto}</p>
}

export function Vacio({ children }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>
}

export function Hoja({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCerrar}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
          <button onClick={onCerrar} className="rounded-full px-3 py-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            ✕
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
        className="h-9 w-9 rounded-full bg-slate-100 text-lg font-bold text-slate-700 disabled:opacity-30"
        aria-label="Quitar uno"
      >
        −
      </button>
      <span className="w-6 text-center font-semibold">{valor}</span>
      <button
        onClick={onMas}
        disabled={maxAlcanzado}
        className="h-9 w-9 rounded-full bg-marca text-lg font-bold text-white disabled:opacity-30"
        aria-label="Agregar uno"
      >
        +
      </button>
    </div>
  )
}
