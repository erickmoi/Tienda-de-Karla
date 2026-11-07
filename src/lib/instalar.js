// Detección de plataforma e instalación de la app (PWA)
let eventoInstalar = null
const oyentes = new Set()

// Android/Chrome avisa que la app se puede instalar: guardamos el aviso para usarlo con un botón
export function escucharInstalacion() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    eventoInstalar = e
    oyentes.forEach((f) => f(true))
  })
  window.addEventListener('appinstalled', () => {
    eventoInstalar = null
    oyentes.forEach((f) => f(false))
  })
}

export const puedeInstalarDirecto = () => !!eventoInstalar
export function alCambiarInstalable(f) {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

export async function instalarDirecto() {
  if (!eventoInstalar) return false
  eventoInstalar.prompt()
  const { outcome } = await eventoInstalar.userChoice
  eventoInstalar = null
  return outcome === 'accepted'
}

const ua = () => navigator.userAgent || ''
export const esIOS = () => /iphone|ipad|ipod/i.test(ua()) || (/Macintosh/.test(ua()) && navigator.maxTouchPoints > 1)
export const esAndroid = () => /android/i.test(ua())
export const plataforma = () => (esIOS() ? 'ios' : esAndroid() ? 'android' : 'pc')
export const navegadorIOS = () =>
  /CriOS/.test(ua()) ? 'chrome' : /FxiOS/.test(ua()) ? 'firefox' : /EdgiOS/.test(ua()) ? 'edge' : 'safari'
export const esSamsung = () => /SamsungBrowser/i.test(ua())

export const estaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

// El aviso de "instala la app" se puede descartar por 7 días
const CLAVE = 'tienda.instalar.descartado'
export function avisoDescartado() {
  try { return Date.now() - Number(localStorage.getItem(CLAVE) || 0) < 7 * 864e5 } catch { return false }
}
export function descartarAviso() {
  try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* sin almacenamiento */ }
}

export const enlaceInstalar = () => `${window.location.origin}/instalar`
