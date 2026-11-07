import { supabase, emailDe, normalizarUsuario } from './supabase'

const minutos = (seg) => Math.max(1, Math.ceil(seg / 60))

// Inicia sesión respetando el bloqueo por intentos fallidos (5 errores => 15 min)
export async function entrarConClave(usuario, clave) {
  const u = normalizarUsuario(usuario)
  const { data: espera } = await supabase.rpc('login_estado', { p_usuario: u })
  if (espera > 0) throw new Error(`Demasiados intentos fallidos. Espera ${minutos(espera)} min e intenta otra vez.`)

  const { error } = await supabase.auth.signInWithPassword({ email: emailDe(u), password: clave })
  if (error) {
    if (error.code === 'invalid_credentials' || /invalid login/i.test(error.message)) {
      const { data: r } = await supabase.rpc('login_fallo', { p_usuario: u })
      if (r?.bloqueado_seg > 0)
        throw new Error(`Demasiados intentos fallidos. Por seguridad, espera ${minutos(r.bloqueado_seg)} min.`)
      if (r?.restantes != null && r.restantes <= 2)
        throw new Error(`Usuario o PIN incorrecto. Te quedan ${r.restantes} intento${r.restantes === 1 ? '' : 's'}.`)
      throw new Error('Usuario o PIN incorrecto.')
    }
    throw error
  }
  supabase.rpc('login_ok').then(() => {}, () => {})
  marcarActividadAdmin()
}

// ---- Bloqueo del panel Admin por inactividad ----
const CLAVE = 'tienda.admin.actividad'
export const MINUTOS_BLOQUEO = 10

export function marcarActividadAdmin() {
  try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* sin almacenamiento */ }
}
export function adminVencido() {
  try {
    const t = Number(localStorage.getItem(CLAVE) || 0)
    return Date.now() - t > MINUTOS_BLOQUEO * 60_000
  } catch {
    return false
  }
}
export function olvidarActividadAdmin() {
  try { localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ }
}
