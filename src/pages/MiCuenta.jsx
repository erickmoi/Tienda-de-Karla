import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dinero, mensajeError } from '../lib/format'
import { aplicarModo } from '../lib/tema'
import { activarPush, desactivarPush, estadoPush, necesitaInstalar } from '../lib/push'
import { invocar } from '../lib/funciones'
import { Cargando, Hoja, Interruptor } from '../components/ui'
import ListaCompras, { ListaPagos, SELECT_COMPRAS, SELECT_PAGOS } from '../components/ListaCompras'

export default function MiCuenta({ avisar, onCambio }) {
  const { perfil } = useAuth()
  const [datos, setDatos] = useState(null)
  const [pestana, setPestana] = useState('compras')
  const [ahora, setAhora] = useState(Date.now())
  const [verPerfil, setVerPerfil] = useState(false)

  const cargar = useCallback(async () => {
    const [saldo, compras, pagos, ajustes] = await Promise.all([
      supabase.rpc('mi_saldo'),
      supabase.from('compras').select(SELECT_COMPRAS).eq('usuario_id', perfil.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('pagos').select(SELECT_PAGOS).eq('usuario_id', perfil.id)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('ajustes').select('minutos_borrar').maybeSingle(),
    ])
    const err = saldo.error || compras.error || pagos.error || ajustes.error
    if (err) return avisar('error', mensajeError(err))
    setDatos({
      saldo: Number(saldo.data ?? 0),
      compras: compras.data,
      pagos: pagos.data,
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
            <p className="mt-1 text-sm opacity-90">{debe ? 'Debes' : aFavor ? 'Saldo a favor' : 'Estás al día'}</p>
            <p className="text-4xl font-bold tabular-nums">{dinero(Math.abs(datos.saldo))}</p>
          </div>
          <button onClick={() => setVerPerfil(true)}
            className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold backdrop-blur transition active:scale-95">
            ⚙️ Mi perfil
          </button>
        </div>
      </div>

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

      <div key={pestana} className="animar-entrada">
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
          <ListaPagos pagos={datos.pagos} />
        )}
      </div>

      {verPerfil && <MiPerfil avisar={avisar} onCerrar={() => setVerPerfil(false)} />}
    </div>
  )
}

function MiPerfil({ avisar, onCerrar }) {
  const { perfil, recargarPerfil } = useAuth()
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
    if (!/^\d{6}$/.test(pin)) return avisar('error', 'El PIN debe tener 6 dígitos.')
    if (pin !== pin2) return avisar('error', 'Los PIN no coinciden.')
    setOcupado(true)
    const { error } = await supabase.auth.updateUser({ password: pin })
    setOcupado(false)
    if (error) {
      const igual = /different|same/i.test(error.message)
      return avisar('error', igual ? 'El PIN nuevo debe ser distinto al actual.' : mensajeError(error))
    }
    setPin('')
    setPin2('')
    avisar('ok', 'PIN actualizado.')
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
            <p className="mt-1 text-xs text-slate-500">Para que la encargada pueda enviarte tu saldo por WhatsApp.</p>
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
                ayuda="Recordatorios de saldo y avisos de la tienda."
              />
              {push === 'activo' && (
                <button type="button" onClick={probar} className="btn-secundario w-full text-sm">Enviarme una prueba</button>
              )}
            </>
          )}
        </section>

        <form onSubmit={cambiarPin} className="space-y-3">
          <p className="etiqueta">Cambiar mi PIN</p>
          <div className="grid grid-cols-2 gap-2">
            <input className="input tracking-[0.3em]" type="password" inputMode="numeric" autoComplete="new-password"
              placeholder="Nuevo" value={pin} onChange={(e) => setPin(digitos(e.target.value, 6))} />
            <input className="input tracking-[0.3em]" type="password" inputMode="numeric" autoComplete="new-password"
              placeholder="Repetir" value={pin2} onChange={(e) => setPin2(digitos(e.target.value, 6))} />
          </div>
          <button disabled={ocupado || pin.length < 6} className="btn-secundario w-full">Cambiar PIN</button>
        </form>
      </div>
    </Hoja>
  )
}
