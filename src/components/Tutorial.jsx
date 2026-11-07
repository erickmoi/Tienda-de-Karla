import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { vibrar } from '../lib/tema'
import { estaInstalada, plataforma } from '../lib/instalar'

// Recorrido guiado: resalta elementos reales de la pantalla (data-tour="...")
// Cada paso puede pedir cambiar de vista antes de mostrarse.
export default function Tutorial({ nombre, encargada, esPersonal, pagosClientes, pagosAuto, setVista, onFin }) {
  const pasos = useMemo(() => {
    const p = [
      { titulo: `¡Hola, ${nombre}! 👋`, texto: 'Te muestro cómo usar la tienda en menos de un minuto.', vista: 'menu' },
      { objetivo: 'categorias', vista: 'menu', titulo: 'Categorías', texto: 'Toca una categoría para ver solo esos productos. Con 🔎 buscas, y en 🔥 Promos están las ofertas.' },
      { objetivo: 'producto', vista: 'menu', titulo: 'Agrega lo que tomes', texto: 'Toca + para agregar; aparecen − y la cantidad para ajustar. Los agotados salen en gris al final.' },
      {
        titulo: '🛒 Registra tu compra',
        texto: pagosClientes
          ? `Abajo aparecerá “Ver carrito”. Ahí eliges “A mi cuenta” o “Ya pagué”.${pagosAuto ? '' : ` Si ya pagaste, ${encargada} lo aprueba.`}`
          : 'Abajo aparecerá “Ver carrito”. Ahí registras la compra y se suma a tu cuenta.',
        vista: 'menu',
      },
      { objetivo: 'nav-cuenta', vista: 'menu', titulo: 'Mi cuenta', texto: 'Aquí ves cuánto debes o tu crédito, y tu historial. Si te equivocas, puedes borrar una compra durante unos minutos.' },
    ]
    if (pagosClientes) {
      p.push({ objetivo: 'agregar-credito', vista: 'cuenta', titulo: 'Pagos y crédito', texto: `Cuando le pagues a ${encargada} o le transfieras, avísale aquí.${pagosAuto ? ' Se aplica al instante.' : ` Se aplica cuando ${encargada} lo apruebe.`}` })
    }
    p.push({ objetivo: 'mi-perfil', vista: 'cuenta', titulo: 'Tu perfil', texto: 'Cambia tu nombre, tu PIN, el modo oscuro y activa las notificaciones.' })
    if (esPersonal) {
      p.push({ objetivo: 'nav-admin', vista: 'cuenta', titulo: 'Administración', texto: 'Aquí apruebas pagos, cobras, manejas productos e inventario, y ves estadísticas.' })
    }
    if (!estaInstalada()) {
      p.push({
        titulo: '📲 Instálala en tu celular',
        texto: plataforma() === 'ios'
          ? 'En Safari toca Compartir (el cuadro con flecha ↑) → “Agregar a pantalla de inicio” → “Agregar”. Luego ábrela desde el ícono.'
          : 'En Chrome toca ⋮ (arriba a la derecha) → “Instalar app”. También está el aviso morado arriba del menú.',
        vista: 'menu',
      })
    }
    p.push({ titulo: '¡Listo! 🎉', texto: 'Puedes volver a ver esto en Mi cuenta → Mi perfil.', vista: 'menu' })
    return p
  }, [nombre, encargada, esPersonal, pagosClientes, pagosAuto])

  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const paso = pasos[i]
  const ultimo = i === pasos.length - 1

  // Cambia de pantalla si el paso lo pide
  useEffect(() => { if (paso.vista) setVista(paso.vista) }, [paso, setVista])

  // Busca el elemento a resaltar (espera a que la pantalla lo dibuje)
  const medir = useCallback(() => {
    if (!paso.objetivo) return setRect(null)
    const el = document.querySelector(`[data-tour="${paso.objetivo}"]`)
    if (!el) return setRect(null)
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [paso])

  useLayoutEffect(() => {
    let intentos = 0
    let t
    const buscar = () => {
      const el = paso.objetivo && document.querySelector(`[data-tour="${paso.objetivo}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        t = setTimeout(medir, 350)
      } else if (paso.objetivo && intentos++ < 20) {
        t = setTimeout(buscar, 100)
      } else {
        setRect(null)
      }
    }
    buscar()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, { passive: true })
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir)
    }
  }, [paso, medir])

  const siguiente = () => {
    vibrar(8)
    if (ultimo) onFin()
    else setI(i + 1)
  }
  const anterior = () => i > 0 && setI(i - 1)

  // Coloca la tarjeta debajo del elemento, o arriba si no cabe
  const margen = 10
  const abajo = rect && rect.top + rect.height + 220 < window.innerHeight
  const tarjetaEstilo = rect
    ? abajo
      ? { top: rect.top + rect.height + margen + 6 }
      : { bottom: window.innerHeight - rect.top + margen + 6 }
    : {}

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Tutorial">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-2xl ring-4 ring-white/90 transition-all duration-300 ease-out"
          style={{
            top: rect.top - margen,
            left: rect.left - margen,
            width: rect.width + margen * 2,
            height: rect.height + margen * 2,
            boxShadow: '0 0 0 9999px rgba(10, 15, 28, 0.72)',
          }}
        />
      ) : (
        <div className="animar-fondo absolute inset-0 bg-[rgba(10,15,28,0.72)]" />
      )}

      <div
        key={i}
        className={`animar-entrada absolute inset-x-4 mx-auto max-w-sm rounded-2xl bg-superficie p-4 shadow-2xl ${rect ? '' : 'top-1/2 -translate-y-1/2'}`}
        style={tarjetaEstilo}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{paso.titulo}</h3>
          <span className="text-xs font-semibold text-slate-400">{i + 1}/{pasos.length}</span>
        </div>
        <p className="text-sm text-slate-600">{paso.texto}</p>
        <div className="mt-3 flex gap-1">
          {pasos.map((_, k) => (
            <span key={k} className={`h-1.5 flex-1 rounded-full transition-colors ${k <= i ? 'bg-marca' : 'bg-slate-200'}`} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {ultimo ? <span /> : (
            <button onClick={onFin} className="text-sm font-semibold text-slate-500">Saltar</button>
          )}
          <div className="flex gap-2">
            {i > 0 && <button onClick={anterior} className="btn-secundario py-2 text-sm">Atrás</button>}
            <button onClick={siguiente} className="btn-primario py-2 text-sm">{ultimo ? '¡Empezar!' : 'Siguiente'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
