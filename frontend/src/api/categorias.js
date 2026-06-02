import { parseError } from './helpers'

const BASE = '/api/categorias'

export async function getCategorias() {
  const res = await fetch(`${BASE}/`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createCategoria(data) {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updateCategoria(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deleteCategoria(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}
