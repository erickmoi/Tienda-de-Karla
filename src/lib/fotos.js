import { supabase } from './supabase'

const LADO_MAX = 600
const CALIDAD = 0.78

// Reduce y comprime la imagen en el navegador antes de subirla (~50–100 KB)
async function comprimir(archivo, ladoMax = LADO_MAX, calidad = CALIDAD) {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close?.()
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/webp', calidad))
  // Safari viejo no genera webp: cae a jpeg
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp', tipo: 'image/webp' }
  const jpg = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', calidad))
  return { blob: jpg, ext: 'jpg', tipo: 'image/jpeg' }
}

// ---- Foto de producto uniforme: cuadrada y con el producto centrado ----
// Si el fondo es parejo (mesa, pared, hoja blanca), recorta lo que sobra y centra el producto
// con un margen, rellenando con el mismo color de fondo. Si el fondo es variado, recorta al centro.
const LADO_PRODUCTO = 700

function colorPromedio(datos, ancho, x0, y0, tam) {
  let r = 0, g = 0, b = 0, n = 0
  for (let y = y0; y < y0 + tam; y++) {
    for (let x = x0; x < x0 + tam; x++) {
      const i = (y * ancho + x) * 4
      r += datos[i]; g += datos[i + 1]; b += datos[i + 2]; n++
    }
  }
  return [r / n, g / n, b / n]
}
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

async function cuadrarProducto(archivo) {
  const bitmap = await createImageBitmap(archivo)
  // Copia pequeña para analizar rápido
  const esc = Math.min(1, 300 / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * esc))
  const h = Math.max(1, Math.round(bitmap.height * esc))
  const mini = document.createElement('canvas')
  mini.width = w
  mini.height = h
  const mc = mini.getContext('2d', { willReadFrequently: true })
  mc.drawImage(bitmap, 0, 0, w, h)
  const datos = mc.getImageData(0, 0, w, h).data

  const t = Math.max(2, Math.round(Math.min(w, h) * 0.06))
  const esquinas = [
    colorPromedio(datos, w, 0, 0, t), colorPromedio(datos, w, w - t, 0, t),
    colorPromedio(datos, w, 0, h - t, t), colorPromedio(datos, w, w - t, h - t, t),
  ]
  const fondo = [0, 1, 2].map((c) => esquinas.reduce((s, e) => s + e[c], 0) / 4)
  const parejo = esquinas.every((e) => distancia(e, fondo) < 28)

  const lienzo = document.createElement('canvas')
  lienzo.width = LADO_PRODUCTO
  lienzo.height = LADO_PRODUCTO
  const ctx = lienzo.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  if (parejo) {
    // Caja que encierra todo lo que no es fondo
    let x0 = w, y0 = h, x1 = -1, y1 = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (distancia([datos[i], datos[i + 1], datos[i + 2]], fondo) > 40) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
      }
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1 }
    const [sx, sy] = [x0 / esc, y0 / esc]
    const [sw, sh] = [(x1 - x0 + 1) / esc, (y1 - y0 + 1) / esc]
    ctx.fillStyle = `rgb(${fondo.map(Math.round).join(',')})`
    ctx.fillRect(0, 0, LADO_PRODUCTO, LADO_PRODUCTO)
    const cabe = (LADO_PRODUCTO * 0.8) / Math.max(sw, sh)
    const [dw, dh] = [sw * cabe, sh * cabe]
    ctx.drawImage(bitmap, sx, sy, sw, sh, (LADO_PRODUCTO - dw) / 2, (LADO_PRODUCTO - dh) / 2, dw, dh)
  } else {
    // Fondo variado: cuadrado al centro de la foto
    const lado = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, LADO_PRODUCTO, LADO_PRODUCTO)
  }
  bitmap.close?.()
  const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/webp', CALIDAD))
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp', tipo: 'image/webp' }
  const jpg = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', CALIDAD))
  return { blob: jpg, ext: 'jpg', tipo: 'image/jpeg' }
}

// Prepara la foto al elegirla, para mostrar cómo quedará antes de guardar
export async function prepararFoto(archivo) {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo no es una imagen.')
  const r = await cuadrarProducto(archivo).catch(() => comprimir(archivo))
  return { ...r, vista: URL.createObjectURL(r.blob) }
}

// `archivo` puede ser un File o lo que devuelve prepararFoto()
export async function subirFoto(productoId, archivo) {
  const { blob, ext, tipo } = archivo?.blob ? archivo : await prepararFoto(archivo)
  const ruta = `${productoId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('productos').upload(ruta, blob, {
    contentType: tipo,
    cacheControl: '31536000',
  })
  if (error) throw error
  return supabase.storage.from('productos').getPublicUrl(ruta).data.publicUrl
}

// Borra la foto anterior (si es de nuestro bucket); los errores no detienen nada
export async function borrarFoto(url) {
  const marca = '/storage/v1/object/public/productos/'
  const i = url?.indexOf(marca) ?? -1
  if (i < 0) return
  await supabase.storage.from('productos').remove([url.slice(i + marca.length)])
}

// QR de cuentas: carpeta privada y más nitidez para que se pueda escanear
export async function subirQR(archivo) {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo no es una imagen.')
  const { blob, ext, tipo } = await comprimir(archivo, 1000, 0.92)
  const ruta = `cuentas/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('qr').upload(ruta, blob, { contentType: tipo })
  if (error) throw error
  return ruta
}

export async function borrarQR(ruta) {
  if (ruta) await supabase.storage.from('qr').remove([ruta])
}
