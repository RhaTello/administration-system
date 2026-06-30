import { parseError } from './helpers'

const BASE = '/api/configuracion'

export async function getConfiguracion() {
  const res = await fetch(`${BASE}/`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function guardarConfiguracion(datos) {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function probarConexion() {
  const res = await fetch(`${BASE}/facturapi/probar`, { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
