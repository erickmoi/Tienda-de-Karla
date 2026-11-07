const fmtDinero = new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' })
const fmtFecha = new Intl.DateTimeFormat('es-SV', {
  timeZone: 'America/El_Salvador',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export const dinero = (n) => fmtDinero.format(Number(n || 0))
export const fecha = (d) => fmtFecha.format(new Date(d))

// Traduce errores de Supabase/Postgres a mensajes legibles
export function mensajeError(e) {
  const msg = e?.message || String(e)
  if (msg.includes('Invalid login credentials')) return 'Usuario o PIN incorrecto.'
  if (msg.includes('already registered') || msg.includes('already been registered'))
    return 'Ese usuario ya existe. Elige otro.'
  if (msg.includes('perfiles_usuario_check'))
    return 'El usuario solo puede tener letras, números, punto o guion bajo (3 a 30).'
  if (msg.includes('rate limit')) return 'Demasiados intentos. Espera un momento.'
  if (msg.includes('Database error saving new user') || msg.includes('REGISTRO_CERRADO'))
    return 'El registro de cuentas está cerrado. Pide que te creen la cuenta.'
  return msg
}
