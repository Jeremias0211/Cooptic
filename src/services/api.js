// Punto único de acceso a los datos.
// Si hay configuración de Supabase (.env) se usa la base de datos real;
// si no, el modo demo con datos de prueba guardados en el navegador.
// Las vistas siempre llaman a "api.algo()" sin saber de dónde salen los datos.
import { hayConfigSupabase } from './supabase'
import * as demo from './demoApi'
import * as remoto from './supabaseApi'

export const MODO_DEMO = !hayConfigSupabase
export const api = MODO_DEMO ? demo : remoto
