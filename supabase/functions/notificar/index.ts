// Notificaciones push (Web Push).
// - Desde la base de datos (cabecera x-notif-token): avisos de stock y recordatorios (semanal y de quincena).
// - Desde la app (sesión de usuario): recordar un cobro a alguien, o una prueba a uno mismo.
import webpush from 'npm:web-push@3.6.7'
import { admin, CORS, json, puede, quienLlama } from '../_shared/comun.ts'

type Mensaje = { title: string; body: string; url?: string; tag?: string }

let config: { vapid_public: string; vapid_private: string; notif_token: string } | null = null

async function cargarConfig() {
  if (config) return config
  const { data, error } = await admin.rpc('notif_config')
  if (error || !data?.vapid_private) throw new Error('Falta la configuración de notificaciones')
  config = data
  webpush.setVapidDetails('mailto:starfieldstudio.app@gmail.com', data.vapid_public, data.vapid_private)
  return config!
}

const dinero = (n: number) => `$${Number(n).toFixed(2)}`

// Envía a todos los dispositivos de esos usuarios y limpia los que ya no existen
async function enviar(usuarioIds: string[], msg: Mensaje) {
  if (!usuarioIds.length) return { enviados: 0, fallidos: 0 }
  const { data: subs } = await admin
    .from('push_suscripciones')
    .select('id, endpoint, p256dh, auth')
    .in('usuario_id', usuarioIds)
  let enviados = 0
  let fallidos = 0
  const vencidas: number[] = []
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(msg),
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        )
        enviados++
      } catch (e) {
        fallidos++
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) vencidas.push(s.id)
        else console.error('push', code, (e as Error).message)
      }
    }),
  )
  if (vencidas.length) await admin.from('push_suscripciones').delete().in('id', vencidas)
  return { enviados, fallidos }
}

async function idsAdministracion(permiso: string) {
  const { data } = await admin.from('perfiles').select('id, rol, permisos').eq('activo', true)
    .in('rol', ['superadmin', 'admin', 'colaborador'])
  return (data ?? [])
    .filter((p) => p.rol !== 'colaborador' || p.permisos?.includes(permiso))
    .map((p) => p.id)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return json({ error: 'Solicitud inválida' }, 400)
  }

  try {
    const cfg = await cargarConfig()
    const tokenBD = req.headers.get('x-notif-token')

    // ---------- Llamadas desde la base de datos ----------
    if (tokenBD) {
      if (tokenBD !== cfg.notif_token) return json({ error: 'No autorizado' }, 403)

      if (cuerpo.accion === 'stock') {
        const ids = await idsAdministracion('inventario')
        const r = await enviar(ids, {
          title: cuerpo.agotado ? '⛔ Producto agotado' : '⚠️ Queda poco',
          body: cuerpo.agotado
            ? `${cuerpo.producto} se agotó.`
            : `Quedan ${cuerpo.stock} de ${cuerpo.producto}.`,
          url: '/?vista=admin',
          tag: `stock-${cuerpo.producto}`,
        })
        return json({ ok: true, ...r })
      }

      // Aviso a quienes administran con cierto permiso (p. ej. pagos por aprobar)
      if (cuerpo.accion === 'admins') {
        const ids = await idsAdministracion(String(cuerpo.permiso ?? 'pagos'))
        const r = await enviar(ids, {
          title: String(cuerpo.titulo ?? 'Tienda'),
          body: String(cuerpo.cuerpo ?? ''),
          url: String(cuerpo.url ?? '/'),
          tag: cuerpo.tag ? String(cuerpo.tag) : undefined,
        })
        return json({ ok: true, ...r })
      }

      // Aviso a una persona (p. ej. su pago fue aprobado)
      if (cuerpo.accion === 'usuario') {
        const r = await enviar([String(cuerpo.usuario_id)], {
          title: String(cuerpo.titulo ?? 'Tienda'),
          body: String(cuerpo.cuerpo ?? ''),
          url: String(cuerpo.url ?? '/'),
          tag: cuerpo.tag ? String(cuerpo.tag) : undefined,
        })
        return json({ ok: true, ...r })
      }

      if (cuerpo.accion === 'recordatorios') {
        const quincena = cuerpo.motivo === 'quincena'
        const { data: aj } = await admin.from('ajustes')
          .select('recordatorio_activo, recordatorio_quincena, recordatorio_minimo, nombre_tienda, nombre_encargada').eq('id', 1).single()
        if (quincena ? !aj?.recordatorio_quincena : !aj?.recordatorio_activo) return json({ ok: true, omitido: 'recordatorios apagados' })
        const { data: saldos } = await admin.rpc('saldos_suscritos')
        let total = 0
        for (const s of saldos ?? []) {
          if (Number(s.saldo) >= Number(aj.recordatorio_minimo) && Number(s.saldo) > 0) {
            const r = await enviar([s.usuario_id], {
              title: quincena ? `💸 ¡Feliz quincena!` : aj.nombre_tienda,
              body: quincena
                ? `Hola ${String(s.nombre).split(' ')[0]}, tu saldo en ${aj.nombre_tienda} es ${dinero(s.saldo)}. Hoy es buen día para pagarle a ${aj.nombre_encargada}. ¡Gracias!`
                : `Hola ${String(s.nombre).split(' ')[0]}, tienes ${dinero(s.saldo)} pendiente. ¡Gracias!`,
              url: '/?vista=cuenta',
              tag: 'saldo',
            })
            total += r.enviados
          }
        }
        return json({ ok: true, enviados: total })
      }

      return json({ error: 'Acción desconocida' }, 400)
    }

    // ---------- Llamadas desde la app ----------
    const yo = await quienLlama(req)
    if (!yo) return json({ error: 'No autorizado' }, 401)

    if (cuerpo.accion === 'prueba') {
      const r = await enviar([yo.id], {
        title: '🔔 Notificaciones activas',
        body: `Listo, ${yo.nombre.split(' ')[0]}. Así te llegarán los avisos.`,
        tag: 'prueba',
      })
      return json({ ok: true, ...r })
    }

    if (cuerpo.accion === 'recordar') {
      if (!puede(yo, 'pagos') && !puede(yo, 'deudores')) return json({ error: 'No autorizado' }, 403)
      const id = String(cuerpo.usuario_id ?? '')
      const { data: s } = await admin.rpc('saldos_suscritos')
      const fila = (s ?? []).find((x: { usuario_id: string }) => x.usuario_id === id)
      if (!fila) return json({ error: 'Esta persona no tiene las notificaciones activadas.' }, 400)
      if (Number(fila.saldo) <= 0) return json({ error: 'Esta persona no tiene saldo pendiente.' }, 400)
      const { data: aj } = await admin.from('ajustes').select('nombre_tienda').eq('id', 1).single()
      const r = await enviar([id], {
        title: aj?.nombre_tienda ?? 'Tienda',
        body: `Hola ${String(fila.nombre).split(' ')[0]}, tienes ${dinero(fila.saldo)} pendiente. ¡Gracias!`,
        url: '/?vista=cuenta',
        tag: 'saldo',
      })
      if (!r.enviados) return json({ error: 'No se pudo entregar el aviso.' }, 400)
      await admin.from('bitacora').insert({
        usuario_id: yo.id, accion: 'recordar_cobro', detalle: { usuario_id: id, saldo: fila.saldo },
      })
      return json({ ok: true, ...r })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: 'Error interno' }, 500)
  }
})
