import { parseError } from './helpers'

const BASE = '/api/clientes-fiscales'

export async function getClientesFiscales(buscar = '') {
  const params = buscar ? `?buscar=${encodeURIComponent(buscar)}` : ''
  const res = await fetch(`${BASE}/${params}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function getClienteFiscal(id) {
  const res = await fetch(`${BASE}/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createClienteFiscal(data) {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updateClienteFiscal(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deleteClienteFiscal(id) {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function sincronizarClienteFiscal(id) {
  const res = await fetch(`${BASE}/${id}/sincronizar`, { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
