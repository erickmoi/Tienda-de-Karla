import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { vibrar } from '../lib/tema'
import { Hoja } from './ui'

const TIPOS = { ahorro: 'Cuenta de ahorro', corriente: 'Cuenta corriente', billetera: 'Billetera / app', otro: 'Otro' }
export const tipoCuenta = (t) => TIPOS[t] ?? t

// Cuentas activas (se guardan en memoria mientras la app está abierta)
let cache = null
export async function cargarCuentas({ forzar = false } = {}) {
  if (cache && !forzar) return cache
  const { data, error } = await supabase.from('metodos_pago')
    .select('id, banco, tipo_cuenta, numero, titular, nota, qr_path, activo, orden')
    .eq('activo', true).order('orden').order('id')
  if (error) throw error
  cache = data
  return data
}
export const olvidarCuentas = () => { cache = null }

export function useCuentas() {
  const [cuentas, setCuentas] = useState(cache)
  useEffect(() => { cargarCuentas().then(setCuentas).catch(() => setCuentas([])) }, [])
  return cuentas
}

// Enlace temporal (1 hora) a un QR de la carpeta privada
export async function urlQR(ruta) {
  const { data, error } = await supabase.storage.from('qr').createSignedUrl(ruta, 3600)
  if (error) throw error
  return data.signedUrl
}

function BotonCopiar({ texto }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(texto.replace(/\s/g, ''))
    } catch {
      // Respaldo para navegadores sin permiso de portapapeles
      const t = document.createElement('textarea')
      t.value = texto.replace(/\s/g, '')
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    vibrar(10)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1600)
  }
  return (
    <button type="button" onClick={copiar}
      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition ${copiado ? 'bg-emerald-600 text-white' : 'bg-marca-claro text-marca-texto'}`}>
      {copiado ? '✓ Copiado' : '📋 Copiar'}
    </button>
  )
}

function VerQR({ ruta, banco, onCerrar }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => { urlQR(ruta).then(setUrl).catch(() => setError(true)) }, [ruta])
  return (
    <Hoja titulo={`QR · ${banco}`} onCerrar={onCerrar}>
      {error ? <p className="text-sm text-red-700">No se pudo cargar el QR.</p>
        : !url ? <div className="esqueleto mx-auto aspect-square w-full max-w-xs" />
        : <img src={url} alt={`Código QR de ${banco}`} className="mx-auto w-full max-w-xs rounded-xl bg-white p-2" />}
      <p className="mt-3 text-center text-xs text-slate-500">Escanéalo desde la app de tu banco. Si estás en el mismo teléfono, tómale captura y súbela en tu app.</p>
    </Hoja>
  )
}

// Tarjeta de una cuenta. Si `elegible`, se puede seleccionar (radio).
export function TarjetaCuenta({ c, elegida, onElegir }) {
  const [verQR, setVerQR] = useState(false)
  const elegible = !!onElegir
  return (
    <div role={elegible ? 'radio' : undefined} aria-checked={elegible ? elegida : undefined} tabIndex={elegible ? 0 : undefined}
      onClick={() => onElegir?.(c.id)} onKeyDown={(e) => e.key === 'Enter' && onElegir?.(c.id)}
      className={`rounded-xl p-3 ring-1 transition ${elegible ? 'cursor-pointer' : ''} ${
        elegida ? 'bg-marca-claro ring-2 ring-marca' : 'bg-superficie ring-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-slate-900">
            {elegible && (
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${elegida ? 'border-marca' : 'border-slate-300'}`}>
                {elegida && <span className="h-2 w-2 rounded-full bg-marca" />}
              </span>
            )}
            🏦 {c.banco}
          </p>
          <p className="text-xs text-slate-500">{tipoCuenta(c.tipo_cuenta)} · {c.titular}</p>
        </div>
        {c.qr_path && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setVerQR(true) }}
            className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">🔳 QR</button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2">
        <span className="font-mono text-base font-bold tracking-wide text-slate-900">{c.numero}</span>
        <BotonCopiar texto={c.numero} />
      </div>
      {c.nota && <p className="mt-1.5 text-xs text-slate-600">💡 {c.nota}</p>}
      {verQR && <VerQR ruta={c.qr_path} banco={c.banco} onCerrar={() => setVerQR(false)} />}
    </div>
  )
}

// Selector para "Ya pagué → Transferencia": elige a qué cuenta se pagó
export function SelectorCuenta({ cuentaId, setCuentaId }) {
  const cuentas = useCuentas()
  useEffect(() => {
    if (cuentas?.length === 1 && cuentaId == null) setCuentaId(cuentas[0].id)
  }, [cuentas, cuentaId, setCuentaId])
  if (!cuentas) return <div className="esqueleto h-24" />
  if (!cuentas.length) return null
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Cuenta a la que pagaste">
      <p className="text-sm font-medium text-slate-600">{cuentas.length > 1 ? '¿A qué cuenta transferiste?' : 'Cuenta para transferir'}</p>
      {cuentas.map((c) => <TarjetaCuenta key={c.id} c={c} elegida={cuentaId === c.id} onElegir={setCuentaId} />)}
    </div>
  )
}

// Lista de solo lectura ("Cómo pagarle a Karla")
export function ListaCuentas({ encargada }) {
  const cuentas = useCuentas()
  if (!cuentas) return <div className="esqueleto h-24" />
  if (!cuentas.length) {
    return <p className="text-sm text-slate-500">{encargada} todavía no ha agregado cuentas. Por ahora, págale en efectivo.</p>
  }
  return <div className="space-y-2">{cuentas.map((c) => <TarjetaCuenta key={c.id} c={c} />)}</div>
}
