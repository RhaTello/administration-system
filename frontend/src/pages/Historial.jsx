import { useState, useEffect } from 'react'
import { Eye, Printer } from 'lucide-react'
import Modal from '../components/Modal'
import TicketImprimible from '../components/TicketImprimible'
import { getVentas } from '../api/ventas'

function formatFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function hoy() {
  return formatFecha(new Date())
}

function diasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatFecha(d)
}

export default function Historial() {
  const [ventas, setVentas] = useState([])
  const [filtros, setFiltros] = useState({ fecha_desde: hoy(), fecha_hasta: hoy() })
  const [atajoActivo, setAtajoActivo] = useState('Hoy')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    setCargando(true)
    setError(null)
    getVentas(filtros)
      .then(setVentas)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false))
  }, [filtros])

  const totalMonto = ventas.reduce((s, v) => s + v.total, 0)
  const totalPiezas = ventas.reduce((s, v) => v.items.reduce((si, i) => si + i.cantidad, 0) + s, 0)

  const atajos = [
    { label: 'Hoy',          desde: hoy(),         hasta: hoy() },
    { label: 'Últimos 7 días', desde: diasAtras(6), hasta: hoy() },
    { label: 'Últimos 30 días', desde: diasAtras(29), hasta: hoy() },
  ]

  function setAtajo(label, desde, hasta) {
    setAtajoActivo(label)
    setFiltros({ fecha_desde: desde, fecha_hasta: hasta })
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-800 mb-5">Historial de ventas</h1>

      {/* Barra de filtros */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-1">
          {atajos.map(a => (
            <button
              key={a.label}
              onClick={() => setAtajo(a.label, a.desde, a.hasta)}
              className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                atajoActivo === a.label
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
          <input
            type="date"
            value={filtros.fecha_desde}
            onChange={e => { setAtajoActivo(null); setFiltros(f => ({ ...f, fecha_desde: e.target.value })) }}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span>al</span>
          <input
            type="date"
            value={filtros.fecha_hasta}
            onChange={e => { setAtajoActivo(null); setFiltros(f => ({ ...f, fecha_hasta: e.target.value })) }}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Resumen del período */}
      {!cargando && ventas.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Ventas</p>
            <p className="text-2xl font-bold text-gray-900">{ventas.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Piezas vendidas</p>
            <p className="text-2xl font-bold text-gray-900">{totalPiezas}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total recaudado</p>
            <p className="text-2xl font-bold text-green-700">${totalMonto.toFixed(2)}</p>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Folio', 'Fecha', 'Hora', 'Artículos', 'Descuento', 'Total', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Cargando...</td></tr>
            ) : ventas.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Sin ventas en el período seleccionado</td></tr>
            ) : ventas.map(v => {
              const fecha = new Date(v.fecha)
              const piezas = v.items.reduce((s, i) => s + i.cantidad, 0)
              return (
                <tr key={v.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetalle(v)}>
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">
                    #{String(v.id).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {fecha.toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {piezas} {piezas === 1 ? 'pza' : 'pzas'}
                    <span className="text-gray-400 text-xs ml-1">({v.items.length} prod.)</span>
                  </td>
                  <td className="px-4 py-3">
                    {v.descuento > 0
                      ? <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">{v.descuento}%</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">${v.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); setDetalle(v) }}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Ticket oculto para impresión */}
      {detalle && <TicketImprimible venta={detalle} />}

      {/* Modal de detalle */}
      {detalle && (
        <Modal
          titulo={`Ticket #${String(detalle.id).padStart(4, '0')}`}
          onCerrar={() => setDetalle(null)}
        >
          <div className="ticket-preview mb-4">
            <TicketImprimible venta={detalle} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded font-medium text-sm hover:bg-blue-700"
            >
              <Printer size={15} /> Reimprimir
            </button>
            <button
              onClick={() => setDetalle(null)}
              className="flex-1 py-2.5 rounded font-medium text-sm text-gray-600 bg-gray-100 hover:bg-gray-200"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
