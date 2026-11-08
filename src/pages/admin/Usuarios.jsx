import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { fecha, mensajeError } from '../../lib/format'
import { Cargando, Hoja, Vacio } from '../../components/ui'
import { invocar, pinAleatorio } from '../../lib/funciones'
import { useApariencia } from '../../lib/apariencia'
import { enlaceInstalar } from '../../lib/instalar'
import Icono from '../../components/Icono'

const ROLES = {
  superadmin: 'Superadmin',
  admin: 'Administración',
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
  const [creando, setCreando] = useState(false)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, usuario, nombre, rol, permisos, activo, aprobado, limite_deuda, created_at')
      .order('nombre')
    if (error) return avisar('error', mensajeError(error))
    setUsuarios(data)
  }, [avisar])

  useEffect(() => { cargar() }, [cargar])

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const orden = { superadmin: 0, admin: 1, colaborador: 2, cliente: 3 }
    return (usuarios ?? [])
      .filter((u) => u.aprobado)
      .filter((u) => !q || u.nombre.toLowerCase().includes(q) || u.usuario.includes(q))
      .sort((a, b) => orden[a.rol] - orden[b.rol] || a.nombre.localeCompare(b.nombre))
  }, [usuarios, busqueda])

  if (!usuarios) return <Cargando />
  const porAprobar = usuarios.filter((u) => !u.aprobado)

  async function aprobar(u, si) {
    if (!si && !confirm(`¿Rechazar la cuenta de ${u.nombre}? No podrá entrar.`)) return
    if (si) {
      const { error } = await supabase.rpc('cambiar_estado_usuario', { p_usuario_id: u.id, p_activo: true })
      if (error) return avisar('error', mensajeError(error))
      avisar('ok', `${u.nombre.split(' ')[0]} ya puede comprar.`)
    } else {
      avisar('ok', 'Cuenta rechazada. Seguirá sin acceso.')
    }
    cargar()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{usuarios.length} cuentas registradas</p>
        <button onClick={() => setCreando(true)} className="btn-primario py-2 text-sm">+ Crear cuenta</button>
      </div>
      <a href={`https://wa.me/?text=${encodeURIComponent(`¡Ya tenemos app para la tienda! Instálala aquí: ${enlaceInstalar()}`)}`}
        target="_blank" rel="noopener noreferrer"
        className="btn flex items-center justify-center gap-2 bg-emerald-600 text-sm text-white">
        <Icono n="whatsapp" size={18} />Invitar por WhatsApp (enlace para instalar)
      </a>
      {porAprobar.length > 0 && (
        <section className="animar-entrada rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <h3 className="mb-2 font-bold text-amber-800"><Icono n="registro" size={18} className="mr-1 -mt-0.5 align-middle" />Cuentas por aprobar ({porAprobar.length})</h3>
          <ul className="space-y-2">
            {porAprobar.map((u) => (
              <li key={u.id} className="tarjeta flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{u.nombre}</p>
                  <p className="text-xs text-slate-500">@{u.usuario} · {fecha(u.created_at)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => aprobar(u, false)} className="btn-peligro px-3 py-1.5 text-sm" aria-label="Rechazar"><Icono n="cerrar" size={16} weight="bold" /></button>
                  <button onClick={() => aprobar(u, true)} className="btn bg-emerald-600 px-3 py-1.5 text-sm text-white"><Icono n="check" size={15} className="mr-1 -mt-0.5 align-middle" />Aprobar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <input className="input" placeholder="Buscar por nombre o usuario" value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)} />
      {lista.length === 0 ? <Vacio>Nadie coincide.</Vacio> : (
        <ul className="escalonado space-y-2">
          {lista.map((u) => (
            <li key={u.id}>
              <button onClick={() => setAbierto(u)} disabled={u.id === yo.id || u.rol === 'superadmin'}
                className={`tarjeta flex w-full items-center justify-between p-3 text-left disabled:cursor-default ${u.activo ? '' : 'opacity-50'}`}>
                <div>
                  <p className="font-semibold">{u.nombre}{u.id === yo.id && ' (tú)'}</p>
                  <p className="text-xs text-slate-500">@{u.usuario}{!u.activo && ' · Desactivado'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  u.rol === 'cliente' ? 'bg-slate-100 text-slate-600' : 'bg-marca-claro text-marca-texto'
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
      {creando && (
        <CrearCuenta avisar={avisar} onCerrar={() => setCreando(false)}
          onCreada={() => { setCreando(false); cargar() }} />
      )}
    </div>
  )
}

function CrearCuenta({ avisar, onCerrar, onCreada }) {
  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState(pinAleatorio)
  const [creada, setCreada] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function crear(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      const u = usuario.trim().toLowerCase()
      await invocar('admin-usuarios', { accion: 'crear', usuario: u, nombre: nombre.trim(), pin })
      setCreada({ usuario: u, nombre: nombre.trim(), pin })
    } catch (err) {
      avisar('error', err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (creada) {
    return (
      <Hoja titulo="Cuenta creada" onCerrar={onCreada}>
        <div className="animar-entrada space-y-3 text-center">
          <Icono n="fiesta" size={56} className="mx-auto text-marca-texto" />
          <p className="text-slate-700">Pásale estos datos a <b>{creada.nombre}</b>:</p>
          <div className="rounded-2xl bg-slate-100 p-4 text-left">
            <p className="text-sm text-slate-500">Usuario</p>
            <p className="font-mono text-lg font-bold text-slate-900">{creada.usuario}</p>
            <p className="mt-2 text-sm text-slate-500">PIN</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em] text-slate-900">{creada.pin}</p>
          </div>
          <p className="text-xs text-slate-500">Puede cambiar su PIN después en Mi cuenta → Mi perfil.</p>
          <button onClick={onCreada} className="btn-primario w-full">Listo</button>
        </div>
      </Hoja>
    )
  }

  return (
    <Hoja titulo="Crear cuenta" onCerrar={onCerrar}>
      <form onSubmit={crear} className="space-y-3">
        <div>
          <label className="etiqueta" htmlFor="cnombre">Nombre</label>
          <input id="cnombre" className="input" maxLength={60} placeholder="ej. María López" value={nombre}
            onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="cusuario">Usuario</label>
          <input id="cusuario" className="input" autoCapitalize="none" autoCorrect="off" placeholder="ej. maria.lopez"
            value={usuario} onChange={(e) => setUsuario(e.target.value.replace(/\s/g, ''))} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="cpin">PIN temporal</label>
          <div className="flex gap-2">
            <input id="cpin" className="input font-mono tracking-[0.3em]" inputMode="numeric" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <button type="button" onClick={() => setPin(pinAleatorio())} className="btn-secundario shrink-0 text-sm"><Icono n="dado" size={17} className="mr-1 -mt-0.5 align-middle" />Otro</button>
          </div>
        </div>
        <button disabled={guardando || !nombre.trim() || usuario.length < 3 || pin.length !== 6} className="btn-primario w-full">
          {guardando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </Hoja>
  )
}

function RestablecerPin({ usuario, avisar }) {
  const [pin, setPin] = useState(pinAleatorio)
  const [listo, setListo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function restablecer() {
    if (!confirm(`¿Cambiar el PIN de ${usuario.nombre} a ${pin}?`)) return
    setGuardando(true)
    try {
      await invocar('admin-usuarios', { accion: 'restablecer_pin', usuario_id: usuario.id, pin })
      setListo(true)
    } catch (err) {
      avisar('error', err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="mb-5 rounded-2xl bg-slate-50 p-3">
      <p className="mb-2 text-sm font-medium text-slate-600"><Icono n="llave" size={16} className="mr-1 -mt-0.5 align-middle" />Restablecer PIN</p>
      {listo ? (
        <p className="animar-entrada text-sm text-slate-700">
          Listo. Nuevo PIN de {usuario.nombre.split(' ')[0]}: <b className="font-mono text-lg tracking-[0.2em]">{pin}</b>
        </p>
      ) : (
        <div className="flex gap-2">
          <input className="input font-mono tracking-[0.3em]" inputMode="numeric" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button type="button" onClick={() => setPin(pinAleatorio())} className="btn-secundario shrink-0 px-3" aria-label="Generar otro"><Icono n="dado" size={18} /></button>
          <button type="button" onClick={restablecer} disabled={guardando || pin.length !== 6} className="btn-primario shrink-0 text-sm">
            Cambiar
          </button>
        </div>
      )}
    </section>
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

  // Misma jerarquía que la función del servidor
  const puedeResetear =
    usuario.rol !== 'superadmin' &&
    (usuario.rol !== 'admin' || soySuper) &&
    (yo.rol !== 'colaborador' || usuario.rol === 'cliente')

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

      {puedeResetear && <RestablecerPin usuario={usuario} avisar={avisar} />}

      <LimiteDeuda usuario={usuario} avisar={avisar} onCambio={onCambio} />

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
            <p className="text-sm text-slate-500">Puede hacer todo en la tienda y nombrar colaboradores.</p>
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

function LimiteDeuda({ usuario, avisar, onCambio }) {
  const { apariencia } = useApariencia()
  const [valor, setValor] = useState(usuario.limite_deuda ?? '')
  const [guardando, setGuardando] = useState(false)
  const general = apariencia.limite_deuda

  async function guardar() {
    setGuardando(true)
    const { error } = await supabase.rpc('asignar_limite', {
      p_usuario_id: usuario.id, p_limite: valor === '' ? null : Number(valor),
    })
    setGuardando(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', valor === '' ? 'Usa el límite general.' : `Límite de ${usuario.nombre.split(' ')[0]}: $${Number(valor).toFixed(2)}.`)
    onCambio()
  }

  return (
    <section className="mb-5 rounded-2xl bg-slate-50 p-3">
      <p className="mb-1 text-sm font-medium text-slate-600"><Icono n="pagos" size={16} className="mr-1 -mt-0.5 align-middle" />Límite de deuda propio</p>
      <p className="mb-2 text-xs text-slate-500">
        Vacío = usa el general ({general ? `$${Number(general).toFixed(2)}` : 'sin límite'}). Escribe 0 para quitarle el límite.
      </p>
      <div className="flex gap-2">
        <input className="input" type="number" inputMode="decimal" step="0.5" min="0" placeholder="General"
          value={valor} onChange={(e) => setValor(e.target.value)} />
        <button onClick={guardar} disabled={guardando} className="btn-primario shrink-0 text-sm">Guardar</button>
      </div>
    </section>
  )
}
