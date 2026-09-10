import { useEffect, useState } from 'react'
import { getStockCritico } from '../api/estadisticas'
import { getConfiguracion, guardarConfiguracion } from '../api/configuracion'

export default function Reposicion() {
  const [productos, setProductos] = useState([])
  const [config, setConfig] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [p, c] = await Promise.all([getStockCritico(), getConfiguracion()])
      setProductos(p)
      setConfig(c)
      setPagina(1)
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  async function cambiarControl(activar) {
    setGuardando(true)
    setError(null)
    try { setConfig(await guardarConfiguracion({ bloquear_sin_stock: activar })) }
    catch (e) { setError(e.message) }
    finally { setGuardando(false) }
  }

  const filtrados = productos.filter(p => [p.sku, p.categoria, p.familia, p.medida, p.material]
    .filter(Boolean).join(' ').toLocaleLowerCase('es-MX').includes(buscar.toLocaleLowerCase('es-MX')))
  const paginas = Math.max(1, Math.ceil(filtrados.length / 100))

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-semibold text-gray-800">Productos sin stock</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
        <label className="flex gap-2 items-center font-medium text-gray-800">
          <input type="checkbox" checked={config?.bloquear_sin_stock ?? false}
            disabled={!config || guardando || cargando} onChange={e => cambiarControl(e.target.checked)} />
          Bloquear ventas sin existencias suficientes
        </label>
        <p className="text-sm text-gray-500">Actívalo al terminar el conteo. Se aplica a notas, facturas y cotizaciones convertidas a venta.</p>
        {config && <p className="text-sm text-blue-700">{config.bloquear_sin_stock
          ? 'Control activo: ninguna venta puede dejar existencias negativas.'
          : 'Conteo en curso: se permite vender aunque las existencias estén en cero o negativas.'}</p>}
      </div>
      <p className="text-sm text-gray-600">Productos con existencias en cero o negativas. Durante el conteo, verifica la cantidad física antes de comprar.</p>
      <div className="flex gap-3 items-center">
        <input value={buscar} onChange={e => { setBuscar(e.target.value); setPagina(1) }}
          placeholder="Buscar SKU, categoría, familia, medida o material" aria-label="Buscar productos por reponer"
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1" />
        <button onClick={cargar} disabled={cargando} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Actualizar</button>
      </div>
      {error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded">{error}</p>}
      {cargando ? <p>Cargando...</p> : <>
        <p className="text-sm text-gray-500">{filtrados.length} productos</p>
        <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50"><tr>{['SKU', 'Categoría', 'Familia', 'Medida', 'Material', 'Existencias'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{filtrados.slice((pagina - 1) * 100, pagina * 100).map(p => <tr key={p.id} className="border-t border-gray-100">
              <td className="p-3 font-mono">{p.sku}</td><td className="p-3">{p.categoria}</td><td className="p-3">{p.familia}</td>
              <td className="p-3">{p.medida || '—'}</td><td className="p-3">{p.material || '—'}</td><td className="p-3 text-red-700 font-semibold">{p.stock}</td>
            </tr>)}</tbody>
          </table>
          {filtrados.length === 0 && <p className="p-5 text-gray-500">No hay productos que coincidan.</p>}
        </div>
        <div className="flex gap-4 items-center text-sm">
          <button disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} className="disabled:opacity-40">Anterior</button>
          <span>Página {pagina} de {paginas}</span>
          <button disabled={pagina === paginas} onClick={() => setPagina(p => p + 1)} className="disabled:opacity-40">Siguiente</button>
        </div>
      </>}
    </div>
  )
}
