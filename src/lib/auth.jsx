import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { aplicarModo } from './tema'
import { desactivarPush } from './push'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [perfil, setPerfil] = useState(null)
  const [cargandoPerfil, setCargandoPerfil] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // No hacer llamadas a Supabase dentro de este callback (evita bloqueos)
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const cargarPerfil = useCallback(async () => {
    if (!session?.user) {
      setPerfil(null)
      return
    }
    setCargandoPerfil(true)
    const { data } = await supabase
      .from('perfiles')
      .select('id, usuario, nombre, rol, permisos, activo, tema, telefono')
      .eq('id', session.user.id)
      .maybeSingle()
    setPerfil(data)
    setCargandoPerfil(false)
  }, [session?.user?.id])

  useEffect(() => {
    cargarPerfil()
  }, [cargarPerfil])

  // El modo claro/oscuro sigue la preferencia guardada del usuario
  useEffect(() => {
    if (perfil?.tema) aplicarModo(perfil.tema)
  }, [perfil?.tema])

  const salir = async () => {
    await desactivarPush().catch(() => {})
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        perfil,
        cargando: session === undefined || cargandoPerfil,
        recargarPerfil: cargarPerfil,
        salir,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

// ¿Este perfil puede hacer X? (mismo criterio que la base de datos)
export function puede(perfil, permiso) {
  if (!perfil?.activo) return false
  if (perfil.rol === 'superadmin' || perfil.rol === 'admin') return true
  return perfil.rol === 'colaborador' && perfil.permisos?.includes(permiso)
}

export const esPersonal = (perfil) =>
  ['superadmin', 'admin', 'colaborador'].includes(perfil?.rol) && perfil?.activo

export const esJefatura = (perfil) => ['superadmin', 'admin'].includes(perfil?.rol) && perfil?.activo
