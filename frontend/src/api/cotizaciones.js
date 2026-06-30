import { parseError } from './helpers'

const BASE = '/api/cotizaciones'

export async function getCotizaciones() {
  const res = await fetch(`${BASE}/`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getCotizacion(id) {
  const res = await fetch(`${BASE}/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createCotizacion(data) {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updateCotizacion(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deleteCotizacion(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function convertirAVenta(id) {
  const res = await fetch(`${BASE}/${id}/convertir`, { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
