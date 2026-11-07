import { useEffect, useState } from 'react'
import {
  alCambiarInstalable, esSamsung, estaInstalada, instalarDirecto, navegadorIOS, plataforma, puedeInstalarDirecto,
} from '../lib/instalar'

// Íconos dibujados para que la persona reconozca qué botón tocar
const IconoCompartir = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-[-4px] text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="ícono de compartir">
    <path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
)
const IconoMas = () => (
  <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-[-4px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-label="ícono de agregar">
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
)
const IconoMenu = () => (
  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 align-[-6px] text-base font-bold text-slate-700" aria-label="menú de tres puntos">⋮</span>
)

function Paso({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca text-sm font-bold text-sobre-marca">{n}</span>
      <span className="pt-0.5 text-sm leading-relaxed text-slate-700">{children}</span>
    </li>
  )
}

export function PasosIOS() {
  const nav = navegadorIOS()
  return (
    <ol className="space-y-3">
      {nav !== 'safari' && nav !== 'chrome' && (
        <Paso n="!">Abre este enlace en <b>Safari</b> (el navegador de la brújula azul).</Paso>
      )}
      <Paso n={1}>
        Toca <b>Compartir</b> <IconoCompartir />{' '}
        {nav === 'chrome' ? 'arriba a la derecha, junto a la barra de dirección.' : 'en la barra de abajo (en iPad, arriba).'}
      </Paso>
      <Paso n={2}>Desliza hacia abajo y toca <b>“Agregar a pantalla de inicio”</b> <IconoMas />.</Paso>
      <Paso n={3}>Toca <b>“Agregar”</b> arriba a la derecha.</Paso>
      <Paso n={4}>Abre la tienda desde el nuevo ícono en tu pantalla de inicio. Ahí sí te llegan las notificaciones.</Paso>
    </ol>
  )
}

export function PasosAndroid() {
  return esSamsung() ? (
    <ol className="space-y-3">
      <Paso n={1}>Toca el menú <b>☰</b> abajo a la derecha.</Paso>
      <Paso n={2}>Toca <b>“Agregar página a”</b> y luego <b>“Pantalla de inicio”</b>.</Paso>
      <Paso n={3}>Confirma con <b>“Agregar”</b>.</Paso>
    </ol>
  ) : (
    <ol className="space-y-3">
      <Paso n={1}>En Chrome, toca el menú <IconoMenu /> arriba a la derecha.</Paso>
      <Paso n={2}>Toca <b>“Instalar app”</b> (o <b>“Agregar a la pantalla principal”</b>).</Paso>
      <Paso n={3}>Confirma con <b>“Instalar”</b>. El ícono aparece junto a tus otras apps.</Paso>
    </ol>
  )
}

// Guía completa: elige la pestaña según el teléfono y, en Android, ofrece instalar con un toque
export default function GuiaInstalar({ onInstalada }) {
  const [tab, setTab] = useState(() => (plataforma() === 'ios' ? 'ios' : 'android'))
  const [directo, setDirecto] = useState(puedeInstalarDirecto())
  useEffect(() => alCambiarInstalable(setDirecto), [])

  if (estaInstalada()) {
    return <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">✅ Ya estás usando la app instalada.</p>
  }

  return (
    <div className="space-y-4">
      {directo && (
        <button onClick={async () => { if (await instalarDirecto()) onInstalada?.() }}
          className="btn-primario w-full text-base">📲 Instalar con un toque</button>
      )}
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {[['ios', '📱 iPhone'], ['android', '🤖 Android']].map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg py-2 ${tab === k ? 'bg-superficie text-marca-texto shadow' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>
      <div key={tab} className="animar-entrada">{tab === 'ios' ? <PasosIOS /> : <PasosAndroid />}</div>
      <p className="text-xs text-slate-500">
        Instalada abre más rápido, ocupa la pantalla completa y puede enviarte avisos. No ocupa espacio como una app de la tienda.
      </p>
    </div>
  )
}
