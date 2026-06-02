import { useState, useEffect } from 'react'
import { getVentasPorDia, getProductosMasVendidos, getStockCritico, getMargen } from '../api/estadisticas'

function hoy() { return new Date().toISOString().split('T')[0] }
function inicioMes() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function inicioSemana() {
  const d = new Date()
  const dia = d.getDay() || 7
  d.setDate(d.getDate() - dia + 1)
  return d.toISOString().split('T')[0]
}

const ATAJOS = [
  { label: 'Hoy',         desde: hoy,          hasta: hoy },
  { label: 'Esta semana', desde: inicioSemana, hasta: hoy },
  { label: 'Este mes',    desde: inicioMes,    hasta: hoy },
]

function formatFecha(str) {
  const [y, m, d] = str.split('-')
  return `${d}/${m}`
}

function MargenBadge({ pct }) {
  if (pct >= 40) return <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">{pct}%</span>
  if (pct >= 20) return <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded">{pct}%</span>
  return <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">{pct}%</span>
}

export default function Estadisticas() {
  const [filtros, setFiltros] = useState({ fecha_desde: inicioMes(), fecha_hasta: hoy() })
  const [dias, setDias] = useState([])
  const [topProductos, setTopProductos] = useState([])
  const [stockCritico, setStockCritico] = useState([])
  const [margen, setMargen] = useState([])
  const [cargandoFecha, setCargandoFecha] = useState(false)
  const [cargandoFijo, setCargandoFijo] = useState(true)

  // Carga con filtro de fecha
  useEffect(() => {
    setCargandoFecha(true)
    Promise.all([
      getVentasPorDia(filtros),
      getProductosMasVendidos({ ...filtros, limite: 10 }),
    ])
      .then(([d, p]) => { setDias(d); setTopProductos(p) })
      .finally(() => setCargandoFecha(false))
  }, [filtros])

  // Carga sin filtro de fecha (solo al montar)
  useEffect(() => {
    Promise.all([getStockCritico(), getMargen()])
      .then(([s, m]) => { setStockCritico(s); setMargen(m) })
      .finally(() => setCargandoFijo(false))
  }, [])

  const maxDia = Math.max(...dias.map(d => d.total), 1)
  const totalPeriodo = dias.reduce((s, d) => s + d.total, 0)
  const totalVentas = dias.reduce((s, d) => s + d.cantidad_ventas, 0)

  const atajoCurrent = ATAJOS.find(a => a.desde() === filtros.fecha_desde && a.hasta() === filtros.fecha_hasta)

  function setAtajo(a) {
    setFiltros({ fecha_desde: a.desde(), fecha_hasta: a.hasta() })
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">Estadísticas</h1>

      {/* Filtro de fecha */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {ATAJOS.map(a => (
            <button
              key={a.label}
              onClick={() => setAtajo(a)}
              className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                atajoCurrent?.label === a.label
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Del</span>
          <input type="date" value={filtros.fecha_desde}
            onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span>al</span>
          <input type="date" value={filtros.fecha_hasta}
            onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-2 gap-6">

        {/* ── Ventas por día ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-semibold text-gray-800">Ventas por día</h2>
              <p className="text-xs text-gray-400 mt-0.5">{totalVentas} ventas · ${totalPeriodo.toFixed(2)} total</p>
            </div>
          </div>
          {cargandoFecha ? (
            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
          ) : dias.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin ventas en el período</p>
          ) : (
            <div className="space-y-2">
              {dias.map(d => (
                <div key={d.fecha} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-10 shrink-0 text-right">{formatFecha(d.fecha)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${(d.total / maxDia) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-20 text-right">${d.total.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 w-14 text-right">{d.cantidad_ventas} vta{d.cantidad_ventas !== 1 && 's'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Productos más vendidos ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Productos más vendidos</h2>
          {cargandoFecha ? (
            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
          ) : topProductos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin ventas en el período</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 font-medium text-gray-500 text-xs">#</th>
                  <th className="text-left pb-2 font-medium text-gray-500 text-xs">SKU / Descripción</th>
                  <th className="text-right pb-2 font-medium text-gray-500 text-xs">Pzas</th>
                  <th className="text-right pb-2 font-medium text-gray-500 text-xs">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topProductos.map((p, i) => (
                  <tr key={p.producto_id}>
                    <td className="py-2 text-xs text-gray-400 pr-2">{i + 1}</td>
                    <td className="py-2">
                      <p className="font-mono font-medium text-gray-900 text-xs">{p.sku}</p>
                      <p className="text-xs text-gray-400 truncate">{p.descripcion}</p>
                    </td>
                    <td className="py-2 text-right font-semibold text-gray-800">{p.total_piezas}</td>
                    <td className="py-2 text-right text-gray-600 text-xs">${p.total_monto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Stock crítico ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-800">Stock en cero o negativo</h2>
            {!cargandoFijo && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${stockCritico.length === 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {stockCritico.length === 0 ? 'Sin alertas' : `${stockCritico.length} producto${stockCritico.length !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
          {cargandoFijo ? (
            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
          ) : stockCritico.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Todos los productos tienen stock disponible</p>
          ) : (
            <div className="overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 font-medium text-gray-500 text-xs">SKU</th>
                    <th className="text-left pb-2 font-medium text-gray-500 text-xs">Familia</th>
                    <th className="text-left pb-2 font-medium text-gray-500 text-xs">Medida</th>
                    <th className="text-right pb-2 font-medium text-gray-500 text-xs">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stockCritico.map(p => (
                    <tr key={p.id}>
                      <td className="py-1.5 font-mono text-xs font-medium text-gray-900">{p.sku}</td>
                      <td className="py-1.5 text-xs text-gray-600">{p.familia}</td>
                      <td className="py-1.5 text-xs text-gray-500">{p.medida ?? '—'}</td>
                      <td className="py-1.5 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.stock < 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
                          {p.stock}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Margen de ganancia ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="font-semibold text-gray-800 mb-1">Margen de ganancia</h2>
          <p className="text-xs text-gray-400 mb-4">Solo productos con precio y costo definidos · ordenados por margen</p>
          {cargandoFijo ? (
            <p className="text-sm text-gray-400 text-center py-6">Cargando...</p>
          ) : margen.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No hay productos con precio y costo definidos</p>
          ) : (
            <div className="overflow-auto max-h-64">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 font-medium text-gray-500 text-xs">SKU</th>
                    <th className="text-left pb-2 font-medium text-gray-500 text-xs">Familia</th>
                    <th className="text-right pb-2 font-medium text-gray-500 text-xs">Precio</th>
                    <th className="text-right pb-2 font-medium text-gray-500 text-xs">Costo</th>
                    <th className="text-right pb-2 font-medium text-gray-500 text-xs">Margen</th>
                    <th className="text-right pb-2 font-medium text-gray-500 text-xs">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {margen.map(p => (
                    <tr key={p.id}>
                      <td className="py-1.5 font-mono text-xs font-medium text-gray-900">{p.sku}</td>
                      <td className="py-1.5 text-xs text-gray-600 truncate max-w-24">{p.familia}</td>
                      <td className="py-1.5 text-right text-xs text-gray-600">${p.precio.toFixed(2)}</td>
                      <td className="py-1.5 text-right text-xs text-gray-600">${p.costo.toFixed(2)}</td>
                      <td className="py-1.5 text-right text-xs font-medium text-gray-800">${p.margen.toFixed(2)}</td>
                      <td className="py-1.5 text-right"><MargenBadge pct={p.margen_pct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
