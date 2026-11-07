import { useState } from 'react'

// Campo de PIN/contraseña: teclado numérico por defecto, con botón para cambiar a letras
export default function CampoClave({ id, value, onChange, autoComplete = 'current-password', placeholder, autoFocus, className = '' }) {
  const [letras, setLetras] = useState(() => /\D/.test(value || ''))
  const [ver, setVer] = useState(false)
  return (
    <div className={`relative ${className}`}>
      <input id={id} className={`input pr-24 ${letras ? '' : 'tracking-[0.4em]'}`}
        type={ver ? 'text' : 'password'} inputMode={letras ? 'text' : 'numeric'}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={30}
        autoComplete={autoComplete} placeholder={placeholder} autoFocus={autoFocus}
        value={value} onChange={(e) => onChange(letras ? e.target.value : e.target.value.replace(/\D/g, ''))} />
      <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
        <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar' : 'Mostrar'}
          className="rounded-lg px-1.5 py-1 text-base text-slate-500">{ver ? '🙈' : '👁️'}</button>
        <button type="button" aria-label={letras ? 'Usar teclado de números' : 'Usar teclado de letras'}
          onClick={(e) => {
            setLetras(!letras)
            // Vuelve a enfocar para que el celular cambie el teclado de inmediato
            const campo = e.currentTarget.closest('div.relative')?.querySelector('input')
            setTimeout(() => campo?.focus(), 0)
          }}
          className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
          {letras ? '123' : 'ABC'}
        </button>
      </div>
    </div>
  )
}

// PIN de 6 números o contraseña de 6 a 30 caracteres
export function claveValida(v) {
  if (/^\d+$/.test(v)) return v.length === 6 ? null : 'El PIN debe tener 6 números.'
  if (v.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  if (v.length > 30) return 'La contraseña puede tener hasta 30 caracteres.'
  return null
}
