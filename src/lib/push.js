import { supabase } from './supabase'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const pushSoportado = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

// En iPhone, los avisos solo funcionan con la app agregada a la pantalla de inicio
export const necesitaInstalar = () => esIOS() && !instalada()

function aBytes(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function registro() {
  if (!pushSoportado()) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function estadoPush() {
  if (!pushSoportado()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await registro()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'activo' : 'inactivo'
}

export async function activarPush() {
  if (!pushSoportado()) throw new Error('Este navegador no permite notificaciones.')
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('No diste permiso para notificaciones.')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(VAPID) }))
  const j = sub.toJSON()
  const { error } = await supabase.rpc('guardar_suscripcion', {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys.p256dh,
    p_auth: j.keys.auth,
  })
  if (error) throw error
}

// Al cerrar sesión o desactivar: este dispositivo deja de recibir avisos de esta cuenta
export async function desactivarPush() {
  const reg = await registro()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  try {
    await supabase.rpc('quitar_suscripcion', { p_endpoint: sub.endpoint })
  } catch { /* sin conexión: se limpia en el servidor al fallar el envío */ }
  await sub.unsubscribe().catch(() => {})
}
