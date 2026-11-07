// Crear cuentas y restablecer PIN. Requiere la llave secreta, por eso vive en el servidor.
import { admin, bitacora, CORS, json, puede, quienLlama } from '../_shared/comun.ts'

const DOMINIO = Deno.env.get('EMAIL_DOMAIN') ?? 'tienda.internal'
const USUARIO_RE = /^[a-z0-9._]{3,30}$/
const PIN_RE = /^\d{6}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const yo = await quienLlama(req)
  if (!yo || !puede(yo, 'usuarios')) return json({ error: 'No autorizado' }, 403)

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return json({ error: 'Solicitud inválida' }, 400)
  }

  try {
    if (cuerpo.accion === 'crear') {
      const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase()
      const nombre = String(cuerpo.nombre ?? '').trim()
      const pin = String(cuerpo.pin ?? '')
      if (!USUARIO_RE.test(usuario))
        return json({ error: 'El usuario debe tener de 3 a 30 letras, números, punto o guion bajo.' }, 400)
      if (!nombre || nombre.length > 60) return json({ error: 'Escribe un nombre válido.' }, 400)
      if (!PIN_RE.test(pin)) return json({ error: 'El PIN debe tener 6 dígitos.' }, 400)

      const { data, error } = await admin.auth.admin.createUser({
        email: `${usuario}@${DOMINIO}`,
        password: pin,
        email_confirm: true,
        user_metadata: { usuario, nombre },
        // app_metadata solo lo puede escribir el servidor: permite crear cuentas aunque el registro esté cerrado
        app_metadata: { creado_por_admin: true },
      })
      if (error) {
        const ya = /already|registered|exists/i.test(error.message)
        return json({ error: ya ? 'Ese usuario ya existe. Elige otro.' : error.message }, 400)
      }
      await bitacora(yo.id, 'crear_usuario', { usuario_id: data.user.id, usuario, nombre })
      return json({ ok: true, id: data.user.id })
    }

    if (cuerpo.accion === 'restablecer_pin') {
      const id = String(cuerpo.usuario_id ?? '')
      const pin = String(cuerpo.pin ?? '')
      if (!PIN_RE.test(pin)) return json({ error: 'El PIN debe tener 6 dígitos.' }, 400)
      if (id === yo.id) return json({ error: 'Cambia tu propio PIN desde Mi cuenta.' }, 400)

      const { data: destino } = await admin.from('perfiles').select('id, nombre, rol').eq('id', id).maybeSingle()
      if (!destino) return json({ error: 'Usuario no encontrado' }, 404)

      // Jerarquía: nadie toca al superadmin; solo el superadmin toca a una admin;
      // un colaborador solo puede restablecer a clientes.
      const permitido =
        destino.rol !== 'superadmin' &&
        (destino.rol !== 'admin' || yo.rol === 'superadmin') &&
        (yo.rol !== 'colaborador' || destino.rol === 'cliente')
      if (!permitido) return json({ error: 'No tienes permiso para cambiar el PIN de esta persona.' }, 403)

      const { error } = await admin.auth.admin.updateUserById(id, { password: pin })
      if (error) return json({ error: error.message }, 400)
      await bitacora(yo.id, 'restablecer_pin', { usuario_id: id, nombre: destino.nombre })
      return json({ ok: true })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: 'Error interno' }, 500)
  }
})
