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

export async function subirFoto(productoId, archivo) {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo no es una imagen.')
  const { blob, ext, tipo } = await comprimir(archivo)
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
