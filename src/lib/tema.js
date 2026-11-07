// Paletas listas para elegir en Ajustes → Apariencia
export const PALETAS = [
  { nombre: 'Índigo', color: '#312e81' },
  { nombre: 'Azul', color: '#1d4ed8' },
  { nombre: 'Turquesa', color: '#0f766e' },
  { nombre: 'Verde', color: '#15803d' },
  { nombre: 'Naranja', color: '#c2410c' },
  { nombre: 'Rojo', color: '#b91c1c' },
  { nombre: 'Rosa', color: '#be185d' },
  { nombre: 'Morado', color: '#6d28d9' },
  { nombre: 'Café', color: '#78350f' },
  { nombre: 'Grafito', color: '#334155' },
]

const HEX = /^#[0-9a-f]{6}$/i

// Luminancia relativa (WCAG) para decidir si el texto encima va blanco o negro
function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function aplicarColor(hex) {
  if (!HEX.test(hex || '')) return
  const raiz = document.documentElement
  raiz.style.setProperty('--color-marca', hex)
  // Contraste: blanco si el color es oscuro, casi negro si es claro
  const L = luminancia(hex)
  const conBlanco = 1.05 / (L + 0.05)
  const conNegro = (L + 0.05) / 0.05
  raiz.style.setProperty('--color-sobre-marca', conBlanco >= conNegro ? '#ffffff' : '#111827')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex)
  try { localStorage.setItem('tienda.color', hex) } catch { /* sin almacenamiento */ }
}

// Modo claro / oscuro / automático (según el celular)
let quitarEscucha = null
export function aplicarModo(modo = 'auto') {
  const raiz = document.documentElement
  quitarEscucha?.()
  quitarEscucha = null
  const poner = (oscuro) => raiz.classList.toggle('dark', oscuro)
  if (modo === 'auto') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    poner(mq.matches)
    const fn = (e) => poner(e.matches)
    mq.addEventListener('change', fn)
    quitarEscucha = () => mq.removeEventListener('change', fn)
  } else {
    poner(modo === 'oscuro')
  }
  try { localStorage.setItem('tienda.modo', modo) } catch { /* sin almacenamiento */ }
}

// Al arrancar, usa lo último guardado en este dispositivo para no "parpadear"
export function temaInicial() {
  try {
    aplicarColor(localStorage.getItem('tienda.color'))
    aplicarModo(localStorage.getItem('tienda.modo') || 'auto')
  } catch {
    aplicarModo('auto')
  }
}

export const vibrar = (ms = 12) => {
  try { navigator.vibrate?.(ms) } catch { /* no disponible */ }
}
