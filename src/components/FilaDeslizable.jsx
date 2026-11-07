import { useCallback, useEffect, useRef, useState } from 'react'

// Fila que solo se desliza a los lados: sin barra visible, sin movimiento vertical,
// con flechas a los lados que aparecen cuando hay más contenido en esa dirección.
export default function FilaDeslizable({ children, className = '', sangria = false }) {
  const ref = useRef(null)
  const [izq, setIzq] = useState(false)
  const [der, setDer] = useState(false)

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    setIzq(el.scrollLeft > 4)
    setDer(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    medir()
    const el = ref.current
    const ro = new ResizeObserver(medir)
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [medir, children])

  const mover = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' })

  return (
    <div className={`relative ${sangria ? '-mx-4' : ''} ${className}`}>
      <div ref={ref} onScroll={medir}
        className={`fila-lateral flex gap-2 py-1 ${sangria ? 'px-4' : ''}`}>
        {children}
      </div>
      {izq && (
        <button type="button" onClick={() => mover(-1)} aria-label="Ver anteriores"
          className="absolute inset-y-0 left-0 flex w-10 items-center justify-start bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent pl-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-superficie text-sm font-bold text-slate-600 shadow ring-1 ring-slate-200">‹</span>
        </button>
      )}
      {der && (
        <button type="button" onClick={() => mover(1)} aria-label="Ver más"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent pr-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-superficie text-sm font-bold text-slate-600 shadow ring-1 ring-slate-200">›</span>
        </button>
      )}
    </div>
  )
}
