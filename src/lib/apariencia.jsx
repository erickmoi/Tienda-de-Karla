import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { aplicarColor } from './tema'

const POR_DEFECTO = {
  nombre_tienda: 'Tienda de Karla',
  color_marca: '#312e81',
  emoji: '🍿',
  logo_url: null,
  frase: 'Anota lo que tomas y paga después',
  columnas_menu: 2,
  nombre_encargada: 'Karla',
  pagos_clientes: true,
  mostrar_stock: false,
  pagos_auto: false,
}

const AparienciaContext = createContext({ apariencia: POR_DEFECTO, recargar: () => {} })

export function AparienciaProvider({ children }) {
  const [apariencia, setApariencia] = useState(POR_DEFECTO)

  const recargar = useCallback(async () => {
    const { data } = await supabase.rpc('apariencia')
    if (data) {
      setApariencia({ ...POR_DEFECTO, ...data })
      aplicarColor(data.color_marca)
      document.title = data.nombre_tienda
    }
  }, [])

  useEffect(() => { recargar() }, [recargar])

  return (
    <AparienciaContext.Provider value={{ apariencia, recargar }}>
      {children}
    </AparienciaContext.Provider>
  )
}

export const useApariencia = () => useContext(AparienciaContext)

// Nombre de quien atiende la tienda (Karla por defecto)
export const useEncargada = () => useContext(AparienciaContext).apariencia.nombre_encargada || 'Karla'

export function Logo({ className = 'h-8 w-8 text-2xl' }) {
  const { apariencia } = useApariencia()
  return apariencia.logo_url ? (
    <img src={apariencia.logo_url} alt="" className={`${className} rounded-lg object-cover`} />
  ) : (
    <span className={`${className} inline-flex items-center justify-center`}>{apariencia.emoji}</span>
  )
}
