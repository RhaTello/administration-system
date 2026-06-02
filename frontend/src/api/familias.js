import { parseError } from './helpers'

const BASE = '/api/familias'

export async function getFamilias(filtros = {}) {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([k, v]) => { if (v != null && v !== '') params.append(k, v) })
  const res = await fetch(`${BASE}/?${params}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createFamilia(data) {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updateFamilia(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deleteFamilia(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}
