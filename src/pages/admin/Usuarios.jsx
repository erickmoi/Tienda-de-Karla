import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { fecha, mensajeError } from '../../lib/format'
import { Cargando, Hoja, Vacio } from '../../components/ui'

const ROLES = {
  superadmin: 'Superadmin',
  admin: 'Administradora',
  colaborador: 'Colaborador',
  cliente: 'Cliente',
}

const PERMISOS = [
  ['productos', 'Productos y precios'],
  ['inventario', 'Inventario'],
  ['pagos', 'Registrar pagos'],
  ['deudores', 'Ver deudores'],
  ['compras', 'Anular compras'],
  ['estadisticas', 'Estadísticas'],
  ['usuarios', 'Usuarios'],
  ['ajustes', 'Ajustes'],
]

export default function Usuarios({ avisar }) {
  const { perfil: yo } = useAuth()
  const [usuarios, setUsuarios] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, usuario, nombre, rol, permisos, activo, created_at')
      .order('nombre')
    if (error) return avisar('error', mensajeError(error))
    setUsuarios(data)
  }, [avisar])

  useEffect(() => { cargar() }, [cargar])

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const orden = { superadmin: 0, admin: 1, colaborador: 2, cliente: 3 }
    return (usuarios ?? [])
      .filter((u) => !q || u.nombre.toLowerCase().includes(q) || u.usuario.includes(q))
      .sort((a, b) => orden[a.rol] - orden[b.rol] || a.nombre.localeCompare(b.nombre))
  }, [usuarios, busqueda])

  if (!usuarios) return <Cargando />

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{usuarios.length} cuentas registradas</p>
      <input className="input" placeholder="Buscar por nombre o usuario" value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)} />
      {lista.length === 0 ? <Vacio>Nadie coincide.</Vacio> : (
        <ul className="space-y-2">
          {lista.map((u) => (
            <li key={u.id}>
              <button onClick={() => setAbierto(u)} disabled={u.id === yo.id || u.rol === 'superadmin'}
                className={`tarjeta flex w-full items-center justify-between p-3 text-left disabled:cursor-default ${u.activo ? '' : 'opacity-50'}`}>
                <div>
                  <p className="font-semibold">{u.nombre}{u.id === yo.id && ' (tú)'}</p>
                  <p className="text-xs text-slate-500">@{u.usuario}{!u.activo && ' · Desactivado'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  u.rol === 'cliente' ? 'bg-slate-100 text-slate-600' : 'bg-marca-claro text-marca'
                }`}>
                  {ROLES[u.rol]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <EditarUsuario usuario={abierto} yo={yo} avisar={avisar}
          onCerrar={() => setAbierto(null)}
          onCambio={() => { setAbierto(null); cargar() }} />
      )}
    </div>
  )
}

function EditarUsuario({ usuario, yo, avisar, onCerrar, onCambio }) {
  const soySuper = yo.rol === 'superadmin'
  const soyAdmin = soySuper || yo.rol === 'admin'
  const [rol, setRol] = useState(usuario.rol)
  const [permisos, setPermisos] = useState(usuario.permisos ?? [])
  const [guardando, setGuardando] = useState(false)

  // Roles que este usuario puede asignar
  const rolesPermitidos = soySuper ? ['admin', 'colaborador', 'cliente'] : ['colaborador', 'cliente']
  const puedeCambiarRol = soyAdmin && (soySuper || usuario.rol !== 'admin')
  const cambioRol = rol !== usuario.rol ||
    (rol === 'colaborador' && [...permisos].sort().join() !== [...(usuario.permisos ?? [])].sort().join())

  const alternarPermiso = (p) =>
    setPermisos((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]))

  async function guardarRol() {
    if (rol === 'colaborador' && permisos.length === 0)
      return avisar('error', 'Elige al menos un permiso para el colaborador.')
    setGuardando(true)
    const { error } = await supabase.rpc('asignar_rol', {
      p_usuario_id: usuario.id,
      p_rol: rol,
      p_permisos: rol === 'colaborador' ? permisos : [],
    })
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', `${usuario.nombre} ahora es ${ROLES[rol].toLowerCase()}.`)
    onCambio()
  }

  async function alternarActivo() {
    const accion = usuario.activo ? 'desactivar' : 'activar'
    if (!confirm(`¿Seguro que quieres ${accion} a ${usuario.nombre}?`)) return
    setGuardando(true)
    const { error } = await supabase.rpc('cambiar_estado_usuario', {
      p_usuario_id: usuario.id,
      p_activo: !usuario.activo,
    })
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', `Cuenta ${usuario.activo ? 'desactivada' : 'activada'}.`)
    onCambio()
  }

  return (
    <Hoja titulo={usuario.nombre} onCerrar={onCerrar}>
      <p className="mb-4 text-sm text-slate-500">@{usuario.usuario} · desde {fecha(usuario.created_at)}</p>

      {puedeCambiarRol && (
        <div className="mb-5 space-y-3">
          <label className="etiqueta" htmlFor="urol">Rol</label>
          <select id="urol" className="input" value={rol} onChange={(e) => setRol(e.target.value)}>
            {rolesPermitidos.map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
          </select>

          {rol === 'colaborador' && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-600">Puede…</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PERMISOS.map(([k, t]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={permisos.includes(k)} onChange={() => alternarPermiso(k)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          )}
          {rol === 'admin' && (
            <p className="text-sm text-slate-500">La administradora puede hacer todo en la tienda y nombrar colaboradores.</p>
          )}

          <button onClick={guardarRol} disabled={guardando || !cambioRol} className="btn-primario w-full">
            Guardar rol
          </button>
        </div>
      )}

      <button onClick={alternarActivo} disabled={guardando || (usuario.rol === 'admin' && !soySuper)}
        className={`${usuario.activo ? 'btn-peligro' : 'btn-secundario'} w-full`}>
        {usuario.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">
        Una cuenta desactivada no puede entrar ni registrar compras. Su historial se conserva.
      </p>
    </Hoja>
  )
}
