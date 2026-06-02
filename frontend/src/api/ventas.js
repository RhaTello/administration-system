import { parseError } from './helpers'

const BASE = '/api/ventas'

export async function getVentas(filtros = {}) {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([k, v]) => { if (v) params.append(k, v) })
  const res = await fetch(`${BASE}/?${params}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createVenta(data) {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getVenta(id) {
  const res = await fetch(`${BASE}/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
