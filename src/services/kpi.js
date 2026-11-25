// Indicadores clave (Actividad KPI de la precooperativa).
// Cada KPI = (casos que cumplen ÷ total de casos del período) × 100.
// Si el total es 0 → "No aplica: no hubo casos en el período" (no se informa 0%).
import { rangoMes, hoyISO } from '../utils/fechas'

export const DEFINICION_KPI = [
  {
    clave: 'k1',
    categoria: 'Recursos',
    nombre: 'Herramientas disponibles y en buen estado',
    meta: 95,
    formula: 'Unidades en condiciones de uso ÷ unidades inventariadas × 100',
    responsable: 'Comisión de Relevamiento',
    tipo: 'Operacional · Rezagado',
    nota: 'Se calcula sobre el inventario actual: unidades de herramientas activas, sin contar las que están en reparación, fuera de servicio o con una rotura/pérdida sin resolver.'
  },
  {
    clave: 'k2',
    categoria: 'Usuarios',
    nombre: 'Solicitudes de préstamo atendidas',
    meta: 90,
    formula: 'Solicitudes atendidas en el mes ÷ solicitudes recibidas en el mes × 100',
    responsable: 'Relevamiento y Documentación y Comunicación',
    tipo: 'Estratégico · Rezagado',
    nota: 'Incluye pedidos de docentes y de alumnos. Atendidas: las atendidas por el pañol y los pedidos de alumnos autorizados o retirados. No se cuentan las canceladas por quien las pidió.'
  },
  {
    clave: 'k3',
    categoria: 'Procesos',
    nombre: 'Devoluciones realizadas en término',
    meta: 90,
    formula: 'Devoluciones en fecha ÷ devoluciones que debían hacerse en el mes × 100',
    responsable: 'Relevamiento y Documentación y Comunicación',
    tipo: 'Operacional · Rezagado',
    nota: 'Se toman los préstamos (no cancelados) cuya fecha límite cayó en el mes y ya pasó.'
  },
  {
    clave: 'k4',
    categoria: 'Personas',
    nombre: 'Cumplimiento de tareas asignadas',
    meta: 90,
    formula: 'Tareas completadas en plazo ÷ tareas con vencimiento en el mes × 100',
    responsable: 'Las tres comisiones',
    tipo: 'Operacional · Adelantado',
    nota: 'Las tareas se identifican con códigos (I-01, I-02…) para no publicar nombres.'
  }
]

// Valores de la simulación del documento de la actividad (datos ficticios)
export const SIMULACION_ACTIVIDAD = {
  k1: { num: 45, den: 50 },
  k2: { num: 36, den: 40 },
  k3: { num: 34, den: 40 },
  k4: { num: 18, den: 20 }
}

// Cuenta numeradores y denominadores a partir de los registros (se usa en modo demo).
// En Supabase lo hace la función SQL kpi_mes() con la misma lógica.
export function contarKpi(datos, mes) {
  const [ini, fin] = rangoMes(mes)
  const hoy = hoyISO()
  const enMes = (f) => f && f >= ini && f <= fin

  // KPI 1
  const activas = datos.herramientas.filter((h) => h.activo)
  const total = activas.reduce((s, h) => s + h.cantidad_total, 0)
  let noOperativas = 0
  for (const h of activas) {
    if (['en_reparacion', 'fuera_de_servicio'].includes(h.estado_general)) {
      noOperativas += h.cantidad_total
    } else {
      noOperativas += datos.incidencias
        .filter((i) => i.herramienta_id === h.id && i.estado === 'abierta')
        .reduce((s, i) => s + i.cantidad, 0)
    }
  }
  const k1 = { num: Math.max(total - noOperativas, 0), den: total }

  // KPI 2
  const sol = datos.solicitudes.filter((s) => enMes(s.fecha) && s.estado !== 'cancelada')
  const k2 = { num: sol.filter((s) => ['atendida', 'autorizada', 'retirada'].includes(s.estado)).length, den: sol.length }

  // KPI 3
  const debian = datos.prestamos.filter((p) => p.estado !== 'cancelado' && enMes(p.fecha_limite) && p.fecha_limite < hoy)
  const enTermino = debian.filter((p) => p.devolucion && p.devolucion.fecha_real <= p.fecha_limite)
  const k3 = { num: enTermino.length, den: debian.length }

  // KPI 4
  const tareas = datos.tareas.filter((t) => t.estado !== 'cancelada' && enMes(t.fecha_limite))
  const k4 = {
    num: tareas.filter((t) => t.estado === 'completada' && t.fecha_completada <= t.fecha_limite).length,
    den: tareas.length
  }
  return { k1, k2, k3, k4 }
}

// Convierte {num, den} en resultado con estado de color + etiqueta escrita
export function evaluar({ num, den }, meta) {
  if (!den) {
    return { valor: null, texto: 'No aplica', estado: 'na', etiqueta: 'No aplica: no hubo casos en el período' }
  }
  const valor = Math.round((num / den) * 1000) / 10
  if (valor >= meta) return { valor, texto: `${valor}%`, estado: 'verde', etiqueta: 'VERDE – Meta cumplida' }
  if (valor >= meta - 5) return { valor, texto: `${valor}%`, estado: 'amarillo', etiqueta: 'AMARILLO – Cerca de la meta' }
  return { valor, texto: `${valor}%`, estado: 'rojo', etiqueta: 'ROJO – Requiere atención' }
}
