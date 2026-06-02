import { useState, useEffect, useRef } from 'react'
import { Plus, Minus, Trash2, Printer, ShoppingCart } from 'lucide-react'
import Modal from '../components/Modal'
import TicketImprimible from '../components/TicketImprimible'
import { getProductos } from '../api/productos'
import { MATERIALES, TIPOS_MEDIDA } from '../constants'
import { getCategorias } from '../api/categorias'
import { getFamilias } from '../api/familias'
import { createVenta } from '../api/ventas'

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function CantidadInput({ valor, onChange, className }) {
  const [texto, setTexto] = useState(String(valor))
  const prevValor = useRef(valor)

  useEffect(() => {
    if (valor !== prevValor.current) {
      setTexto(String(valor))
      prevValor.current = valor
    }
  }, [valor])

  function handleChange(e) {
    const raw = e.target.value
    setTexto(raw)
    const n = parseInt(raw)
    if (n >= 1) {
      prevValor.current = n
      onChange(n)
    }
  }

  function handleBlur() {
    const n = parseInt(texto)
    if (!n || n < 1) setTexto(String(valor)) // restaura al último válido si quedó vacío
  }

  return (
    <input
      type="number"
      min="1"
      value={texto}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  )
}

const FILTROS_VACIOS = { sku: '', familia_id: '', categoria_id: '', material: '', medida: '', tipo_medida: '' }

export default function Ventas() {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [familias, setFamilias] = useState([])
  const [carrito, setCarrito] = useState([])
  const [descuento, setDescuento] = useState(0)
  const [procesando, setProcesando] = useState(false)
  const [errorVenta, setErrorVenta] = useState(null)
  const [ventaFinalizada, setVentaFinalizada] = useState(null)

  useEffect(() => {
    getCategorias().then(setCategorias).catch(() => {})
    getFamilias().then(setFamilias).catch(() => {})
  }, [])

  const hayFiltros = filtros.sku.trim() || filtros.familia_id || filtros.categoria_id || filtros.material.trim() || filtros.tipo_medida

  useEffect(() => {
    if (!hayFiltros) { setResultados([]); return }
    const id = setTimeout(() => {
      setBuscando(true)
      getProductos(filtros)
        .then(setResultados)
        .catch(() => {})
        .finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(id)
  }, [filtros])

  const familiasFiltradas = filtros.categoria_id
    ? familias.filter(f => f.categoria.id === Number(filtros.categoria_id))
    : familias

  function setFiltro(campo) {
    return e => setFiltros(f => {
      const nuevo = { ...f, [campo]: e.target.value }
      if (campo === 'categoria_id') nuevo.familia_id = ''
      return nuevo
    })
  }

  function agregarAlCarrito(producto) {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto.id === producto.id)
      if (existe) return prev.map(i =>
        i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
      )
      return [...prev, { producto, cantidad: 1 }]
    })
  }

  function setCantidad(id, valor) {
    const n = parseInt(valor)
    if (!n || n < 1) return
    setCarrito(prev => prev.map(i => i.producto.id === id ? { ...i, cantidad: n } : i))
  }

  function cambiarCantidad(id, delta) {
    setCarrito(prev => prev
      .map(i => i.producto.id === id ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    )
  }

  function quitarItem(id) {
    setCarrito(prev => prev.filter(i => i.producto.id !== id))
  }

  const subtotal = carrito.reduce((sum, i) => sum + (i.producto.precio ?? 0) * i.cantidad, 0)
  const montoDescuento = subtotal * (descuento / 100)
  const total = subtotal - montoDescuento

  async function finalizarVenta() {
    if (carrito.length === 0) return
    setErrorVenta(null)
    setProcesando(true)
    try {
      const venta = await createVenta({
        items: carrito.map(i => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
        descuento,
      })
      setVentaFinalizada(venta)
      setCarrito([])
      setDescuento(0)
      setFiltros(FILTROS_VACIOS)
    } catch (e) {
      setErrorVenta(e.message)
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="flex h-full">

      {/* Panel izquierdo */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Filtros */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h1 className="text-base font-semibold text-gray-800 mb-3">Nueva venta</h1>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={filtros.sku}
              onChange={setFiltro('sku')}
              placeholder="Buscar SKU..."
              autoFocus
              className={inputClass}
            />
            <select value={filtros.categoria_id} onChange={setFiltro('categoria_id')} className={inputClass}>
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select value={filtros.familia_id} onChange={setFiltro('familia_id')} className={inputClass}>
              <option value="">Todas las familias</option>
              {familiasFiltradas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
            <select value={filtros.material} onChange={setFiltro('material')} className={inputClass}>
              <option value="">Todos los materiales</option>
              {MATERIALES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              value={filtros.medida}
              onChange={setFiltro('medida')}
              placeholder="Medida..."
              className={inputClass}
            />
            <select value={filtros.tipo_medida} onChange={setFiltro('tipo_medida')} className={inputClass}>
              <option value="">Todos los tipos</option>
              {TIPOS_MEDIDA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-auto">
          {!hayFiltros ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
              <ShoppingCart size={48} />
              <p className="text-sm">Usá los filtros para buscar productos</p>
            </div>
          ) : buscando ? (
            <p className="text-sm text-gray-400 text-center py-10">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Sin resultados</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {['SKU', 'Familia', 'Categoría', 'Medida', 'Material', 'Tipo', 'Precio', 'Stock', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resultados.map(p => {
                  const sinPrecio = p.precio == null
                  return (
                    <tr
                      key={p.id}
                      onClick={() => !sinPrecio && agregarAlCarrito(p)}
                      className={sinPrecio ? 'opacity-50' : 'hover:bg-blue-50 cursor-pointer'}
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-gray-900">{p.sku}</td>
                      <td className="px-4 py-2.5 text-gray-700">{p.familia.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-500">{p.familia.categoria.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-700">{p.medida ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">{p.material ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {p.tipo_medida
                          ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p.tipo_medida}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {sinPrecio
                          ? <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Sin precio</span>
                          : `$${p.precio.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-blue-600 text-xs">
                        {!sinPrecio && '+ Agregar'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panel derecho: carrito */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">
            Carrito{' '}
            {carrito.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({carrito.length} {carrito.length === 1 ? 'producto' : 'productos'})
              </span>
            )}
          </h2>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {carrito.length === 0 ? (
            <p className="text-sm text-gray-400 text-center pt-8">El carrito está vacío</p>
          ) : carrito.map(({ producto, cantidad }) => (
            <div key={producto.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-sm text-gray-900">{producto.sku}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {producto.familia.categoria.nombre} {producto.familia.nombre}{producto.medida ? ` ${producto.medida}` : ''}
                  </p>
                </div>
                <button onClick={() => quitarItem(producto.id)} className="text-gray-300 hover:text-red-500 shrink-0 pt-0.5">
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                {/* Cantidad editable */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => cambiarCantidad(producto.id, -1)}
                    className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                  >
                    <Minus size={11} />
                  </button>
                  <CantidadInput
                    valor={cantidad}
                    onChange={n => setCantidad(producto.id, n)}
                    className="w-16 text-center border border-gray-300 rounded px-1 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => cambiarCantidad(producto.id, 1)}
                    className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                  >
                    <Plus size={11} />
                  </button>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm text-gray-900">${(producto.precio * cantidad).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">${producto.precio.toFixed(2)} c/u</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total y cobrar */}
        <div className="px-5 py-4 border-t border-gray-200 space-y-3">
          {errorVenta && (
            <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{errorVenta}</p>
          )}

          {/* Descuento */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-600 shrink-0">Descuento</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={descuento}
                onChange={e => setDescuento(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                className="w-16 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            {descuento > 0 && (
              <span className="text-sm text-red-500 ml-auto">-${montoDescuento.toFixed(2)}</span>
            )}
          </div>

          {descuento > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-700">Total</span>
            <span className="text-2xl font-bold text-gray-900">${total.toFixed(2)}</span>
          </div>
          <button
            onClick={finalizarVenta}
            disabled={carrito.length === 0 || procesando}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {procesando ? 'Procesando...' : 'Cobrar'}
          </button>
        </div>
      </div>

      {/* Ticket oculto en el DOM para impresión */}
      {ventaFinalizada && <TicketImprimible venta={ventaFinalizada} />}

      {/* Modal con vista previa */}
      {ventaFinalizada && (
        <Modal
          titulo={`Venta #${String(ventaFinalizada.id).padStart(4, '0')} registrada`}
          onCerrar={() => setVentaFinalizada(null)}
        >
          <div className="ticket-preview mb-4">
            <TicketImprimible venta={ventaFinalizada} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded font-medium text-sm hover:bg-blue-700"
            >
              <Printer size={15} /> Imprimir ticket
            </button>
            <button
              onClick={() => setVentaFinalizada(null)}
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
