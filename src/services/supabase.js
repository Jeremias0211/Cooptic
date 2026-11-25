import { createClient } from '@supabase/supabase-js'

// Solo se usan la URL y la clave PÚBLICA (anon). La seguridad real la dan
// las políticas RLS de la base de datos. La clave service_role NUNCA va en el cliente.
const url = import.meta.env.VITE_SUPABASE_URL
const claveAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hayConfigSupabase = Boolean(url && claveAnon && !url.includes('TU-PROYECTO'))

export const supabase = hayConfigSupabase ? createClient(url, claveAnon) : null

export const DOMINIO_DNI = import.meta.env.VITE_DOMINIO_DNI || 'cooptic.escuela'
