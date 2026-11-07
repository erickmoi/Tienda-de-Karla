import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

function llaveSecreta(): string {
  const nuevas = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (nuevas) {
    try {
      const k = JSON.parse(nuevas)?.default
      if (k) return k
    } catch { /* usa la llave antigua */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
}

// Cliente con privilegios de servidor (salta RLS). Nunca sale de la función.
export const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, llaveSecreta(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type Perfil = {
  id: string
  usuario: string
  nombre: string
  rol: 'superadmin' | 'admin' | 'colaborador' | 'cliente'
  permisos: string[]
  activo: boolean
}

// Identifica al usuario a partir de su sesión (Authorization: Bearer <jwt>)
export async function quienLlama(req: Request): Promise<Perfil | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: perfil } = await admin
    .from('perfiles')
    .select('id, usuario, nombre, rol, permisos, activo')
    .eq('id', data.user.id)
    .maybeSingle()
  return perfil?.activo ? (perfil as Perfil) : null
}

// Mismo criterio que private.tiene_permiso() en la base de datos
export function puede(p: Perfil, permiso: string) {
  if (!p.activo) return false
  if (p.rol === 'superadmin' || p.rol === 'admin') return true
  return p.rol === 'colaborador' && p.permisos?.includes(permiso)
}

export async function bitacora(usuarioId: string, accion: string, detalle: Record<string, unknown>) {
  await admin.from('bitacora').insert({ usuario_id: usuarioId, accion, detalle })
}
