import CampoClave, { claveValida } from '../components/CampoClave'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useApariencia, useEncargada } from '../lib/apariencia'
import { dinero, fecha, mensajeError } from '../lib/format'
import { aplicarModo, vibrar } from '../lib/tema'
import { activarPush, desactivarPush, estadoPush, necesitaInstalar } from '../lib/push'
import { invocar } from '../lib/funciones'
import { Cargando, Exito, Hoja, Interruptor } from '../components/ui'
import GuiaInstalar from '../components/GuiaInstalar'
import { ListaCuentas } from '../components/Cuentas'
import { estaInstalada } from '../lib/instalar'
import ListaCompras, {
  FormaDePago, ListaPagos, SELECT_COMPRAS, SELECT_PAGOS, SELECT_REPORTES,
} from '../components/ListaCompras'

export default function MiCuenta({ avisar, onCambio, onTutorial }) {
  const { perfil } = useAuth()
  const { apariencia } = useApariencia()
  const encargada = useEncargada()
  const [datos, setDatos] = useState(null)
  const [pestana, setPestana] = useState('compras')
  const [ahora, setAhora] = useState(Date.now())
  const [verPerfil, setVerPerfil] = useState(false)
  const [verCredito, setVerCredito] = useState(false)
  const [verCuentas, setVerCuentas] = useState(false)

  const cargar = useCallback(async () => {
    const [saldo, compras, pagos, reportes, ajustes] = await Promise.all([
      supabase.rpc('mi_saldo'),
      supabase.from('compras').select(SELECT_COMPRAS).eq('usuario_id', perfil.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('pagos').select(SELECT_PAGOS).eq('usuario_id', perfil.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('reportes_pago').select(SELECT_REPORTES).eq('usuario_id', perfil.id)
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('ajustes').select('minutos_borrar').maybeSingle(),
    ])
    const err = saldo.error || compras.error || pagos.error || reportes.error || ajustes.error
    if (err) return avisar('error', mensajeError(err))
    setDatos({
      saldo: Number(saldo.data ?? 0),
      compras: compras.data,
      pagos: pagos.data,
      reportes: reportes.data,
      minutos: ajustes.data?.minutos_borrar ?? 5,
    })
  }, [perfil.id, avisar])

  useEffect(() => { cargar() }, [cargar])

  // Refresca el reloj para ocultar el botón "Borrar" cuando vence el plazo
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])

  async function borrar(compra) {
    if (!confirm(`¿Borrar la compra de ${dinero(compra.total)}?`)) return
    const { error } = await supabase.rpc('anular_compra', { p_compra_id: compra.id })
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', 'Compra borrada.')
    cargar()
    onCambio?.()
  }

  if (!datos) return <Cargando />

  const debe = datos.saldo > 0
  const aFavor = datos.saldo < 0
  const enRevision = datos.reportes.filter((r) => r.estado === 'pendiente')
  const totalRevision = enRevision.reduce((s, r) => s + Number(r.monto), 0)
  // Rechazos de los últimos 7 días, para que la persona se entere
  const rechazos = datos.reportes.filter(
    (r) => r.estado === 'rechazado' && Date.now() - new Date(r.revisado_at ?? r.created_at).getTime() < 7 * 864e5,
  )

  return (
    <div className="space-y-5 pb-28">
      <div className={`animar-entrada relative overflow-hidden rounded-3xl p-5 text-white shadow-lg ${
        debe ? 'bg-gradient-to-br from-rose-500 to-rose-700' : aFavor ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 'bg-gradient-to-br from-marca to-marca-oscuro'
      }`}>
        <span aria-hidden="true" className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-sm opacity-90">Hola, {perfil.nombre.split(' ')[0]}</p>
            <p className="mt-1 text-sm opacity-90">{debe ? 'Debes' : aFavor ? 'Crédito a favor' : 'Estás al día'}</p>
            <p className="text-4xl font-bold tabular-nums">{dinero(Math.abs(datos.saldo))}</p>
            {totalRevision > 0 && (
              <p className="mt-1 text-sm opacity-90">⏳ {dinero(totalRevision)} en revisión por {encargada}</p>
            )}
          </div>
          <button data-tour="mi-perfil" onClick={() => setVerPerfil(true)}
            className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold backdrop-blur transition active:scale-95">
            ⚙️ Mi perfil
          </button>
        </div>
        {apariencia.pagos_clientes && (
          <button data-tour="agregar-credito" onClick={() => setVerCredito(true)}
            className="relative mt-4 w-full rounded-xl bg-white py-2.5 text-sm font-bold text-slate-900 shadow transition active:scale-[0.98]">
            {debe ? '💵 Ya pagué / Agregar crédito' : '➕ Agregar crédito'}
          </button>
        )}
      </div>

      <button onClick={() => setVerCuentas(true)}
        className="tarjeta flex w-full items-center gap-3 p-3 text-left transition active:scale-[0.98]">
        <span className="text-2xl">💳</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">Cómo pagarle a {encargada}</span>
          <span className="block text-xs text-slate-500">Cuentas de banco y QR para transferir</span>
        </span>
        <span className="text-slate-400">›</span>
      </button>

      {rechazos.length > 0 && (
        <div className="animar-entrada rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {rechazos.map((r) => (
            <p key={r.id}>
              ❌ {encargada} no aprobó tu pago de {dinero(r.monto)} del {fecha(r.created_at)}
              {r.nota_revision ? `: ${r.nota_revision}` : '.'}
            </p>
          ))}
        </div>
      )}

      <div className="relative grid grid-cols-2 rounded-xl bg-slate-200/60 p-1 text-sm font-semibold">
        <span aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-superficie shadow transition-transform duration-300"
          style={{ transform: pestana === 'pagos' ? 'translateX(100%)' : 'none' }} />
        {[['compras', 'Mis compras'], ['pagos', 'Mis pagos']].map(([k, t]) => (
          <button key={k} onClick={() => setPestana(k)}
            className={`relative rounded-lg py-2 transition-colors ${pestana === k ? 'text-marca-texto' : 'text-slate-500'}`}>
            {t}
          </button>
        ))}
      </div>

      <div key={pestana} className="animar-entrada space-y-2">
        {pestana === 'compras' ? (
          <ListaCompras
            compras={datos.compras}
            accion={(c) => {
              const vence = new Date(c.created_at).getTime() + datos.minutos * 60000
              if (ahora > vence) return null
              const restan = Math.max(1, Math.ceil((vence - ahora) / 60000))
              return (
                <button onClick={() => borrar(c)} className="btn-peligro mt-2 w-full py-1.5 text-sm">
                  Borrar (quedan {restan} min)
                </button>
              )
            }}
          />
        ) : (
          <>
            {enRevision.map((r) => (
              <div key={r.id} className="tarjeta flex items-center justify-between p-3 ring-amber-200">
                <div>
                  <p className="text-xs text-slate-500">{fecha(r.created_at)}</p>
                  <p className="text-sm text-slate-700">
                    ⏳ En revisión · {r.metodo === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                    {r.compra_id ? ' · por una compra' : ''}
                  </p>
                </div>
                <p className="font-bold text-amber-700">{dinero(r.monto)}</p>
              </div>
            ))}
            <ListaPagos pagos={datos.pagos} />
          </>
        )}
      </div>

      {verPerfil && (
        <MiPerfil avisar={avisar} onCerrar={() => setVerPerfil(false)}
          onTutorial={() => { setVerPerfil(false); onTutorial?.() }} />
      )}
      {verCuentas && (
        <Hoja titulo={`💳 Cómo pagarle a ${encargada}`} onCerrar={() => setVerCuentas(false)}>
          <ListaCuentas encargada={encargada} />
          {apariencia.pagos_clientes && (
            <button onClick={() => { setVerCuentas(false); setVerCredito(true) }} className="btn-primario mt-4 w-full">
              Ya pagué: avisar a {encargada}
            </button>
          )}
        </Hoja>
      )}
      {verCredito && (
        <AgregarCredito saldo={datos.saldo} avisar={avisar} onCerrar={() => setVerCredito(false)}
          onListo={() => { setVerCredito(false); cargar() }} />
      )}
    </div>
  )
}

function AgregarCredito({ saldo, avisar, onCerrar, onListo }) {
  const encargada = useEncargada()
  const { apariencia: { pagos_auto: auto } } = useApariencia()
  const [monto, setMonto] = useState(saldo > 0 ? saldo.toFixed(2) : '')
  const [metodo, setMetodo] = useState('efectivo')
  const [referencia, setReferencia] = useState('')
  const [cuentaId, setCuentaId] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)

  const atajos = [...new Set([...(saldo > 0 ? [Number(saldo.toFixed(2))] : []), 1, 2, 5, 10])]

  async function enviar(e) {
    e.preventDefault()
    const valor = Number(monto)
    if (!(valor > 0)) return avisar('error', 'Escribe un monto mayor que cero.')
    setEnviando(true)
    const { error } = await supabase.rpc('reportar_pago', {
      p_monto: valor, p_metodo: metodo, p_referencia: referencia || null,
      p_metodo_pago_id: metodo === 'transferencia' ? cuentaId : null,
    })
    setEnviando(false)
    if (error) return avisar('error', mensajeError(error))
    vibrar([20, 40, 20])
    setExito(true)
  }

  if (exito) {
    return auto
      ? <Exito texto="¡Aplicado!" sub="Tu pago ya está en tu cuenta." onFin={onListo} />
      : <Exito texto="¡Enviado!" sub={`${encargada} lo revisará y se aplicará a tu cuenta.`} onFin={onListo} />
  }

  return (
    <Hoja titulo={saldo > 0 ? 'Ya pagué / Agregar crédito' : 'Agregar crédito'} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-slate-600">
          Entrégale el dinero a {encargada} o haz la transferencia, y avísale aquí.{' '}
          {auto ? 'Se aplica a tu cuenta al instante.' : `Se aplica cuando ${encargada} lo apruebe.`}
          {saldo > 0 && <> Lo que pase de tu deuda queda como crédito a favor.</>}
        </p>
        <div>
          <label className="etiqueta" htmlFor="cmonto">Monto ($)</label>
          <input id="cmonto" className="input text-lg font-bold" type="number" inputMode="decimal" step="0.01" min="0.01" max="500"
            value={monto} onChange={(e) => setMonto(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            {atajos.map((v, i) => (
              <button key={v} type="button" onClick={() => setMonto(v.toFixed(2))}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 active:scale-95">
                {i === 0 && saldo > 0 ? `Todo (${dinero(v)})` : dinero(v)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="etiqueta">¿Cómo pagaste?</p>
          <FormaDePago metodo={metodo} setMetodo={setMetodo} referencia={referencia} setReferencia={setReferencia}
            cuentaId={cuentaId} setCuentaId={setCuentaId} />
        </div>
        <button disabled={enviando} className="btn-primario w-full">{enviando ? 'Enviando…' : auto ? 'Registrar pago' : `Avisar a ${encargada}`}</button>
      </form>
    </Hoja>
  )
}

function MiPerfil({ avisar, onCerrar, onTutorial }) {
  const { perfil, recargarPerfil, salir, salirDeTodo } = useAuth()
  const encargada = useEncargada()
  const [nombre, setNombre] = useState(perfil.nombre)
  const [telefono, setTelefono] = useState(perfil.telefono ?? '')
  const [tema, setTema] = useState(perfil.tema ?? 'auto')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [push, setPush] = useState('cargando')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => { estadoPush().then(setPush) }, [])

  const digitos = (v, n) => v.replace(/\D/g, '').slice(0, n)

  async function guardarDatos(e) {
    e.preventDefault()
    if (!nombre.trim()) return avisar('error', 'Escribe tu nombre.')
    if (telefono && !/^\d{8,15}$/.test(telefono)) return avisar('error', 'El teléfono debe tener al menos 8 dígitos.')
    setOcupado(true)
    const { error } = await supabase.from('perfiles')
      .update({ nombre: nombre.trim(), telefono: telefono || null }).eq('id', perfil.id)
    setOcupado(false)
    if (error) return avisar('error', mensajeError(error))
    avisar('ok', 'Datos guardados.')
    recargarPerfil()
  }

  async function cambiarTema(t) {
    setTema(t)
    aplicarModo(t)
    const { error } = await supabase.from('perfiles').update({ tema: t }).eq('id', perfil.id)
    if (error) avisar('error', mensajeError(error))
    else recargarPerfil()
  }

  async function cambiarPin(e) {
    e.preventDefault()
    const problema = claveValida(pin)
    if (problema) return avisar('error', problema)
    if (pin !== pin2) return avisar('error', 'No coinciden. Escríbelo igual las dos veces.')
    setOcupado(true)
    const { error } = await supabase.auth.updateUser({ password: pin })
    setOcupado(false)
    if (error) {
      const igual = /different|same/i.test(error.message)
      return avisar('error', igual ? 'Debe ser distinto al actual.' : mensajeError(error))
    }
    setPin('')
    setPin2('')
    avisar('ok', 'Listo, ya quedó cambiado.')
  }

  async function alternarPush(activar) {
    setOcupado(true)
    try {
      if (activar) {
        await activarPush()
        avisar('ok', 'Notificaciones activadas.')
      } else {
        await desactivarPush()
        avisar('ok', 'Notificaciones desactivadas en este dispositivo.')
      }
    } catch (err) {
      avisar('error', mensajeError(err))
    } finally {
      setPush(await estadoPush())
      setOcupado(false)
    }
  }

  async function probar() {
    try {
      const r = await invocar('notificar', { accion: 'prueba' })
      if (!r.enviados) avisar('error', 'No se pudo entregar. Desactiva y vuelve a activar las notificaciones.')
    } catch (err) {
      avisar('error', err.message)
    }
  }

  return (
    <Hoja titulo="Mi perfil" onCerrar={onCerrar}>
      <div className="space-y-6">
        <form onSubmit={guardarDatos} className="space-y-3">
          <p className="text-sm text-slate-500">Usuario: <b className="text-slate-700">@{perfil.usuario}</b></p>
          <div>
            <label className="etiqueta" htmlFor="mnombre">Nombre</label>
            <input id="mnombre" className="input" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="mtel">WhatsApp (opcional)</label>
            <input id="mtel" className="input" inputMode="tel" placeholder="ej. 70001234" value={telefono}
              onChange={(e) => setTelefono(digitos(e.target.value, 15))} />
            <p className="mt-1 text-xs text-slate-500">Para que {encargada} pueda enviarte tu saldo por WhatsApp.</p>
          </div>
          <button disabled={ocupado} className="btn-primario w-full">Guardar datos</button>
        </form>

        <section>
          <p className="etiqueta">Apariencia</p>
          <div className="relative grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <span aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc(33.333%-2.67px)] rounded-lg bg-superficie shadow transition-transform duration-300"
              style={{ transform: `translateX(${['auto', 'claro', 'oscuro'].indexOf(tema) * 100}%)` }} />
            {[['auto', '📱 Auto'], ['claro', '☀️ Claro'], ['oscuro', '🌙 Oscuro']].map(([k, t]) => (
              <button key={k} type="button" onClick={() => cambiarTema(k)}
                className={`relative py-2 transition-colors ${tema === k ? 'text-marca-texto' : 'text-slate-500'}`}>
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="etiqueta">Notificaciones</p>
          {push === 'no-soportado' ? (
            <p className="text-sm text-slate-500">Este navegador no permite notificaciones.</p>
          ) : necesitaInstalar() ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              En iPhone, primero agrega la app a tu pantalla de inicio: en Safari toca Compartir → “Agregar a pantalla de inicio”. Luego ábrela desde ahí y activa los avisos.
            </p>
          ) : push === 'bloqueado' ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Bloqueaste las notificaciones para esta página. Actívalas en la configuración del navegador y vuelve aquí.
            </p>
          ) : (
            <>
              <Interruptor
                activo={push === 'activo'}
                disabled={ocupado || push === 'cargando'}
                onCambio={alternarPush}
                etiqueta="Recibir avisos en este dispositivo"
                ayuda="Pagos aprobados, recordatorios de saldo y avisos de la tienda."
              />
              {push === 'activo' && (
                <button type="button" onClick={probar} className="btn-secundario w-full text-sm">Enviarme una prueba</button>
              )}
            </>
          )}
        </section>

        {!estaInstalada() && (
          <section className="space-y-2">
            <p className="etiqueta">📲 Instalar la app</p>
            <GuiaInstalar />
          </section>
        )}

        <form onSubmit={cambiarPin} className="space-y-3">
          <p className="etiqueta">Cambiar mi PIN o contraseña</p>
          <CampoClave autoComplete="new-password" placeholder="Nuevo" value={pin} onChange={setPin} />
          <CampoClave autoComplete="new-password" placeholder="Repetir" value={pin2} onChange={setPin2} />
          <p className="text-xs text-slate-500">6 números, o una contraseña con letras (toca <b>ABC</b>). Para administración se recomienda contraseña.</p>
          <button disabled={ocupado || pin.length < 6} className="btn-secundario w-full">Cambiar</button>
        </form>

        <button type="button" onClick={onTutorial} className="w-full py-2 text-sm font-semibold text-marca-texto">
          🎓 Ver el tutorial otra vez
        </button>
        <button type="button" onClick={() => confirm('¿Cerrar sesión en este dispositivo?') && salir()}
          className="btn-secundario w-full text-red-600">
          Cerrar sesión
        </button>
        <button type="button"
          onClick={() => confirm('¿Cerrar sesión en TODOS tus dispositivos? Úsalo si perdiste o cambiaste de celular. Tendrás que volver a entrar en cada uno.') && salirDeTodo()}
          className="w-full py-1 text-xs font-semibold text-red-600">
          🔐 Cerrar sesión en todos mis dispositivos
        </button>
      </div>
    </Hoja>
  )
}
