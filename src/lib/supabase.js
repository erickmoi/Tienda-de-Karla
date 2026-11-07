import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } },
)

const DOMINIO = import.meta.env.VITE_EMAIL_DOMAIN || 'tienda.internal'

export const normalizarUsuario = (u) => u.trim().toLowerCase()
export const emailDe = (usuario) => `${normalizarUsuario(usuario)}@${DOMINIO}`
