import { parseError } from './helpers'

const BASE = '/api/estadisticas'

async function get(path, params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.append(k, v) })
  const res = await fetch(`${BASE}/${path}?${qs}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export const getVentasPorDia      = (p) => get('ventas-por-dia', p)
export const getProductosMasVendidos = (p) => get('productos-mas-vendidos', p)
export const getStockCritico      = ()  => get('stock-critico')
export const getMargen            = ()  => get('margen')
