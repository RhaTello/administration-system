export async function parseError(res) {
  const data = await res.json().catch(() => ({}))
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail)) return data.detail.map(e => e.msg).join(', ')
  return 'Error inesperado'
}
