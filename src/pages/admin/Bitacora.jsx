import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dinero, fecha, mensajeError } from '../../lib/format'
import { Cargando, Vacio } from '../../components/ui'
import { useEncargada } from '../../lib/apariencia'

const PAGINA = 50

const ICONOS = {
  editar_producto: '🏷️',
  registrar_pago: '💵',
  registrar_devolucion: '↩️',
  anular_compra: '🗑️',
  asignar_rol: '🎖️',
  activar_usuario: '✅',
  desactivar_usuario: '🚫',
  crear_usuario: '🆕',
  restablecer_pin: '🔑',
  recordar_cobro: '🔔',
  rechazar_pago: '❌',
  pago_automatico: '⚡',
  asignar_limite: '💳',
  conteo_inventario: '📋',
  cuenta_banco: '🏦',
}

const ROLES = { superadmin: 'superadmin', admin: 'administración', colaborador: 'colaborador', cliente: 'cliente' }

function describir(e, nombres) {
  const d = e.detalle ?? {}
  const quien = (id) => nombres[id] ?? 'alguien'
  const cambio = (par, fmt = (x) => x) =>
    Array.isArray(par) && String(par[0]) !== String(par[1]) ? `${fmt(par[0])} → ${fmt(par[1])}` : null

  switch (e.accion) {
    case 'editar_producto': {
      const partes = [
        cambio(d.precio, dinero) && `precio ${cambio(d.precio, dinero)}`,
        cambio(d.costo, dinero) && `costo ${cambio(d.costo, dinero)}`,
        cambio(d.activo) && (d.activo[1] ? 'visible' : 'oculto'),
        cambio(d.agotado_manual) && (d.agotado_manual[1] ? 'marcado agotado' : 'quitó agotado'),
      ].filter(Boolean)
      return `Editó ${d.nombre}: ${partes.join(', ') || 'cambios'}`
    }
    case 'registrar_pago':
      return `Registró pago de ${dinero(d.monto)} de ${quien(d.cliente_id)} (${d.metodo})`
    case 'registrar_devolucion':
      return `Devolvió ${dinero(d.monto)} a ${quien(d.cliente_id)} (${d.metodo})`
    case 'anular_compra':
      return `Anuló compra de ${dinero(d.total)} de ${quien(d.cliente_id)}`
    case 'asignar_rol':
      return d.usuario_id
        ? `Cambió a ${quien(d.usuario_id)} de ${ROLES[d.rol_anterior] ?? '—'} a ${ROLES[d.rol_nuevo]}`
        : `Rol asignado: ${ROLES[d.rol_nuevo] ?? d.rol_nuevo}`
    case 'activar_usuario':
      return `Activó la cuenta de ${quien(d.usuario_id)}`
    case 'desactivar_usuario':
      return `Desactivó la cuenta de ${quien(d.usuario_id)}`
    case 'crear_usuario':
      return `Creó la cuenta de ${d.nombre} (@${d.usuario})`
    case 'restablecer_pin':
      return `Restableció el PIN de ${d.nombre ?? quien(d.usuario_id)}`
    case 'asignar_limite':
      return d.limite == null ? `Quitó el límite propio de ${quien(d.usuario_id)}` : `Puso a ${quien(d.usuario_id)} un límite de ${dinero(d.limite)}`
    case 'conteo_inventario':
      return `Hizo conteo de inventario: ${d.productos} productos ajustados`
    case 'pago_automatico':
      return `${quien(d.cliente_id)} registró un pago de ${dinero(d.monto)} (${d.metodo}), aplicado automáticamente`
    case 'rechazar_pago':
      return `Rechazó un pago de ${dinero(d.monto)} de ${quien(d.cliente_id)}${d.nota ? ` (${d.nota})` : ''}`
    case 'cuenta_banco':
      return `${d.cambio?.charAt(0).toUpperCase()}${d.cambio?.slice(1)}`
    case 'recordar_cobro':
      return `Recordó a ${quien(d.usuario_id)} su saldo de ${dinero(d.saldo)}`
    default:
      return e.accion.replace(/_/g, ' ')
  }
}

export default function Bitacora({ avisar }) {
  const encargada = useEncargada()
  const [filas, setFilas] = useState(null)
  const [nombres, setNombres] = useState({})
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)

  const cargar = useCallback(async (desde = 0) => {
    const [b, p] = await Promise.all([
      supabase.from('bitacora').select('id, accion, detalle, created_at, usuario_id')
        .order('created_at', { ascending: false }).range(desde, desde + PAGINA - 1),
      desde === 0 ? supabase.from('perfiles').select('id, nombre') : Promise.resolve({ data: null }),
    ])
    if (b.error) return avisar('error', mensajeError(b.error))
    if (p.data) setNombres(Object.fromEntries(p.data.map((x) => [x.id, x.nombre])))
    setFilas((f) => (desde === 0 ? b.data : [...(f ?? []), ...b.data]))
    setHayMas(b.data.length === PAGINA)
  }, [avisar])

  useEffect(() => { cargar(0) }, [cargar])

  // Agrupa por día
  const grupos = useMemo(() => {
    const fmtDia = new Intl.DateTimeFormat('es-SV', { timeZone: 'America/El_Salvador', weekday: 'long', day: 'numeric', month: 'long' })
    const g = []
    for (const f of filas ?? []) {
      const dia = fmtDia.format(new Date(f.created_at))
      if (!g.length || g.at(-1).dia !== dia) g.push({ dia, filas: [] })
      g.at(-1).filas.push(f)
    }
    return g
  }, [filas])

  if (!filas) return <Cargando />
  if (!filas.length) return <Vacio>Todavía no hay movimientos registrados.</Vacio>

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Quién hizo qué en la administración. Solo lo ven {encargada} y el superadmin.</p>
      {grupos.map((g) => (
        <section key={g.dia}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{g.dia}</h3>
          <ul className="escalonado space-y-2">
            {g.filas.map((e) => (
              <li key={e.id} className="tarjeta flex gap-3 p-3">
                <span className="text-xl">{ICONOS[e.accion] ?? '📝'}</span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{describir(e, nombres)}</p>
                  <p className="text-xs text-slate-500">{nombres[e.usuario_id] ?? 'Sistema'} · {fecha(e.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {hayMas && (
        <button disabled={cargandoMas} className="btn-secundario w-full"
          onClick={async () => { setCargandoMas(true); await cargar(filas.length); setCargandoMas(false) }}>
          {cargandoMas ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
