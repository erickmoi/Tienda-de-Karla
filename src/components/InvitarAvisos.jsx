import { useEffect, useState } from 'react'
import { activarPush, estadoPush, necesitaInstalar } from '../lib/push'
import { mensajeError } from '../lib/format'
import { vibrar } from '../lib/tema'
import { Hoja } from './ui'
import { PasosIOS } from './GuiaInstalar'

const CLAVE = 'tienda.avisos.pospuesto'
const DIAS_ESPERA = 3

function pospuesto() {
  try { return Date.now() - Number(localStorage.getItem(CLAVE) || 0) < DIAS_ESPERA * 864e5 } catch { return false }
}
function posponer() {
  try { localStorage.setItem(CLAVE, String(Date.now())) } catch { /* sin almacenamiento */ }
}

// Invita a activar las notificaciones (el navegador exige que la persona toque un botón).
// Se muestra sola si están apagadas; "Ahora no" la esconde 3 días.
export default function InvitarAvisos({ encargada, pendiente = false, avisar, listo = true }) {
  const [abierta, setAbierta] = useState(false)
  const [ios, setIos] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!listo || pospuesto()) return
    let vivo = true
    const t = setTimeout(async () => {
      // iPhone sin instalar: no hay avisos todavía, se explica cómo instalar
      if (necesitaInstalar()) { if (vivo) { setIos(true); setAbierta(true) } return }
      const estado = await estadoPush()
      if (vivo && estado === 'inactivo') setAbierta(true)
    }, 1200)
    return () => { vivo = false; clearTimeout(t) }
  }, [listo])

  if (!abierta) return null

  const cerrar = () => { posponer(); setAbierta(false) }

  async function activar() {
    setOcupado(true)
    try {
      await activarPush()
      vibrar([10, 40, 10])
      avisar?.('ok', '🔔 Listo, te llegarán los avisos.')
      setAbierta(false)
    } catch (err) {
      avisar?.('error', mensajeError(err))
      posponer()
      setAbierta(false)
    } finally {
      setOcupado(false)
    }
  }

  const beneficios = pendiente
    ? [`✅ Cuando ${encargada} apruebe tu cuenta`, '💵 Cuando te confirmen un pago', '💸 Tu saldo en días de quincena']
    : ['💵 Cuando te confirmen un pago', '💸 Tu saldo en días de quincena', '🔥 Promos y avisos de la tienda']

  return (
    <Hoja titulo="🔔 Activa los avisos" onCerrar={cerrar}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Te avisamos en tu celular, aunque la app esté cerrada:</p>
        <ul className="space-y-2">
          {beneficios.map((b) => (
            <li key={b} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{b}</li>
          ))}
        </ul>
        {ios ? (
          <>
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              En iPhone, los avisos solo funcionan con la app instalada. Instálala así y ábrela desde tu pantalla de inicio:
            </p>
            <PasosIOS />
            <button type="button" onClick={cerrar} className="btn-secundario w-full">Entendido</button>
          </>
        ) : (
          <>
            <button type="button" disabled={ocupado} onClick={activar} className="btn-primario w-full">
              {ocupado ? 'Un momento…' : 'Activar avisos'}
            </button>
            <p className="text-center text-xs text-slate-500">Tu celular te preguntará si das permiso: toca <b>Permitir</b>.</p>
          </>
        )}
        <button type="button" onClick={cerrar} className="w-full py-1 text-sm font-semibold text-slate-500">Ahora no</button>
      </div>
    </Hoja>
  )
}
