import { svgDe } from '../components/Icono'
// Ícono de la app hecho con el logo (o emoji) y el color de la tienda.
// En iPhone se usa al "Agregar a pantalla de inicio"; en Android viene del manifiesto.

function cargarImagen(url) {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ok(img)
    img.onerror = mal
    img.src = url
  })
}

export async function dibujarIcono({ color_marca, emoji, logo_url }, lado = 180) {
  const c = document.createElement('canvas')
  c.width = lado
  c.height = lado
  const ctx = c.getContext('2d')
  ctx.fillStyle = color_marca || '#312e81'
  ctx.fillRect(0, 0, lado, lado)
  if (logo_url) {
    try {
      const img = await cargarImagen(logo_url)
      const m = lado * 0.16 // margen para que no lo corten las esquinas redondeadas
      const t = lado - m * 2
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(m, m, t, t, t * 0.22)
      ctx.clip()
      ctx.drawImage(img, m, m, t, t)
      ctx.restore()
      return c.toDataURL('image/png')
    } catch { /* si no carga el logo, usa el emoji */ }
  }
  // Ícono de la galería (Phosphor): se dibuja encima del color
  const base = svgDe(emoji)
  if (base) {
    try {
      const tinta = getComputedStyle(document.documentElement).getPropertyValue('--color-sobre-marca').trim() || '#ffffff'
      const svg = base.replace('fill="currentColor"', `fill="${tinta}"`)
      const img = await cargarImagen(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      const t = lado * 0.6
      ctx.drawImage(img, (lado - t) / 2, (lado - t) / 2, t, t)
      return c.toDataURL('image/png')
    } catch { /* si falla, se usa texto */ }
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.round(lado * 0.56)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.fillText(emoji || '', lado / 2, lado * 0.54)
  return c.toDataURL('image/png')
}

let ultimo = ''
export async function actualizarIconoIOS(apariencia) {
  const clave = `${apariencia.color_marca}|${apariencia.emoji}|${apariencia.logo_url}`
  if (clave === ultimo) return
  ultimo = clave
  try {
    const url = await dibujarIcono(apariencia, 180)
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', url)
    document.querySelector('link[rel="icon"]')?.setAttribute('href', url)
  } catch { /* se queda el ícono de siempre */ }
}
