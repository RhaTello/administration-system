import { parseError } from './helpers'

export async function getMateriales() {
  const res = await fetch('/api/catalogos/materiales')
  if (!res.ok) throw new Error('Error al cargar materiales')
  return res.json()
}

export async function createMaterial(nombre) {
  const res = await fetch('/api/catalogos/materiales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updateMaterial(id, nombre) {
  const res = await fetch(`/api/catalogos/materiales/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deleteMaterial(id) {
  const res = await fetch(`/api/catalogos/materiales/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function getTiposMedida() {
  const res = await fetch('/api/catalogos/tipos-medida')
  if (!res.ok) throw new Error('Error al cargar tipos de medida')
  return res.json()
}

export async function createTipoMedida(nombre) {
  const res = await fetch('/api/catalogos/tipos-medida', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updateTipoMedida(id, nombre) {
  const res = await fetch(`/api/catalogos/tipos-medida/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function deleteTipoMedida(id) {
  const res = await fetch(`/api/catalogos/tipos-medida/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}
