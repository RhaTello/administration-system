import { parseError } from './helpers'

const BASE = '/api/facturas'

export async function getFacturas() {
  const res = await fetch(`${BASE}/`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createFactura(data) {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export function urlPdf(id) {
  return `${BASE}/${id}/pdf`
}

export function urlXml(id) {
  return `${BASE}/${id}/xml`
}

export async function cancelarFactura(id, motivo = '02') {
  const res = await fetch(`${BASE}/${id}/cancelar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function createComplementoPago(facturaId, data) {
  const res = await fetch(`${BASE}/${facturaId}/pagos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export function urlPdfComplemento(pagoId) {
  return `${BASE}/pagos/${pagoId}/pdf`
}

export function urlXmlComplemento(pagoId) {
  return `${BASE}/pagos/${pagoId}/xml`
}
