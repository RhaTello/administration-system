import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Printer, ShoppingCart, ArrowLeft, RefreshCw, Save } from 'lucide-react'
import { getProductos } from '../api/productos'
import { getMateriales, getTiposMedida } from '../api/catalogos'
import { getCategorias } from '../api/categorias'
import { getFamilias } from '../api/familias'
import * as api from '../api/cotizaciones'
import { NEGOCIO } from '../negocio'

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── Utilidades ────────────────────────────────────────────────────────────────

function buildDescripcion(p) {
  return [p.familia.categoria.nombre, p.familia.nombre, p.medida, p.material]
    .filter(Boolean).join(' ')
}

function imprimirCotizacion(cotizacion) {
  const folio = String(cotizacion.id).padStart(4, '0')
  const fecha = new Date(cotizacion.fecha).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const subtotal = cotizacion.items.reduce((s, i) => s + i.subtotal, 0)
  const descMonto = subtotal * (cotizacion.descuento / 100)

  const filas = cotizacion.items.map(item => `
    <tr>
      <td>${item.sku}</td>
      <td>${item.descripcion}</td>
      <td class="num">${item.cantidad}</td>
      <td class="num">$${item.precio_unitario.toFixed(2)}</td>
      <td class="num">$${item.subtotal.toFixed(2)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 20mm 18mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; }
  .negocio-nombre { font-size: 18pt; font-weight: bold; letter-spacing: 1px; }
  .negocio-info { font-size: 9pt; color: #555; margin-top: 3px; line-height: 1.5; }
  .folio-box { text-align: right; }
  .folio-titulo { font-size: 20pt; font-weight: bold; color: #1d4ed8; letter-spacing: 2px; }
  .folio-num { font-size: 13pt; color: #555; margin-top: 2px; }
  .divider { border-top: 2px solid #1d4ed8; margin: 6mm 0; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 8mm; font-size: 10pt; }
  .meta-label { color: #777; font-size: 9pt; margin-bottom: 2px; }
  .meta-value { font-weight: bold; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; }
  thead tr { background: #1d4ed8; color: white; }
  th { padding: 6px 8px; text-align: left; font-size: 9pt; font-weight: normal; letter-spacing: 0.5px; }
  td { padding: 5px 8px; font-size: 10pt; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f8fafc; }
  .num { text-align: right; }
  th.num { text-align: right; }
  .totales { margin-left: auto; width: 220px; }
  .totales-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10pt; }
  .totales-total { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13pt; font-weight: bold; border-top: 2px solid #1d4ed8; margin-top: 4px; color: #1d4ed8; }
  .notas { margin-top: 8mm; font-size: 9pt; color: #555; border-top: 1px solid #e5e7eb; padding-top: 4mm; }
  .footer { margin-top: 12mm; font-size: 8pt; color: #999; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 4mm; }
  @media print { @page { size: A4; margin: 0; } body { padding: 15mm 14mm; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="negocio-nombre">${NEGOCIO.nombre}</div>
      <div class="negocio-info">${NEGOCIO.direccion}<br>Tel: ${NEGOCIO.telefono}</div>
    </div>
    <div class="folio-box">
      <div class="folio-titulo">COTIZACIÓN</div>
      <div class="folio-num"># ${folio}</div>
    </div>
  </div>
  <div class="divider"></div>
  <div class="meta">
    <div>
      <div class="meta-label">CLIENTE</div>
      <div class="meta-value">${cotizacion.cliente}</div>
    </div>
    <div style="text-align:right">
      <div class="meta-label">FECHA</div>
      <div class="meta-value">${fecha}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Descripción</th>
        <th class="num">Cant.</th>
        <th class="num">P. Unit.</th>
        <th class="num">Subtotal</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="totales">
    ${cotizacion.descuento > 0 ? `
    <div class="totales-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
    <div class="totales-row"><span>Descuento (${cotizacion.descuento}%)</span><span>-$${descMonto.toFixed(2)}</span></div>` : ''}
    <div class="totales-total"><span>TOTAL</span><span>$${cotizacion.total.toFixed(2)}</span></div>
  </div>
  ${cotizacion.notas ? `<div class="notas"><strong>Notas:</strong> ${cotizacion.notas}</div>` : ''}
  <div class="footer">Precios en pesos mexicanos (MXN) · ${NEGOCIO.nombre} · ${NEGOCIO.telefono}</div>
</body>
</html>`

  const ventana = window.open('', '_blank', 'width=900,height=700')
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => ventana.print(), 400)
}

// ── Lista de cotizaciones ─────────────────────────────────────────────────────

function ListaCotizaciones({ onNueva, onEditar }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [convirtiendo, setConvirtiendo] = useState(null)

  async function cargar() {
    setCargando(true)
    try { setCotizaciones(await api.getCotizaciones()) } catch { /* silent */ }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta cotización?')) return
    try {
      await api.deleteCotizacion(id)
      setCotizaciones(c => c.filter(x => x.id !== id))
    } catch (e) { alert(e.message) }
  }

  async function handleConvertir(cotizacion) {
    if (!confirm(`¿Convertir cotización #${String(cotizacion.id).padStart(4,'0')} a venta? Se descontará stock.`)) return
    setConvirtiendo(cotizacion.id)
    try {
      await api.convertirAVenta(cotizacion.id)
      alert(`Venta generada correctamente para ${cotizacion.cliente}.`)
    } catch (e) {
      alert(e.message)
    } finally {
      setConvirtiendo(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-800">Cotizaciones</h1>
        <button
          onClick={onNueva}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          <Plus size={15} /> Nueva cotización
        </button>
      </div>

      {cargando ? (
        <p className="text-sm text-gray-400 text-center py-16">Cargando...</p>
      ) : cotizaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300 gap-3">
          <ShoppingCart size={48} />
          <p className="text-sm">No hay cotizaciones guardadas</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['#', 'Fecha', 'Cliente', 'Productos', 'Total', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cotizaciones.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-500 text-xs">
                    #{String(c.id).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(c.fecha).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.cliente}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.items.length} {c.items.length === 1 ? 'producto' : 'productos'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    ${c.total.toFixed(2)}
                    {c.descuento > 0 && (
                      <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        -{c.descuento}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => imprimirCotizacion(c)}
                        title="Imprimir"
                        className="text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={() => handleConvertir(c)}
                        disabled={convirtiendo === c.id}
                        title="Convertir a venta"
                        className="text-gray-400 hover:text-green-600 transition-colors disabled:opacity-40"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => onEditar(c)}
                        title="Editar"
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleEliminar(c.id)}
                        title="Eliminar"
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Editor de cotización ──────────────────────────────────────────────────────

const FILTROS_VACIOS = { sku: '', familia_id: '', categoria_id: '', material: '', medida: '', tipo_medida: '' }

function EditorCotizacion({ cotizacionInicial, onGuardado, onCancelar }) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [categorias, setCategorias] = useState([])
  const [familias, setFamilias] = useState([])
  const [materiales, setMateriales] = useState([])
  const [tiposMedida, setTiposMedida] = useState([])

  const [carrito, setCarrito] = useState(
    cotizacionInicial
      ? cotizacionInicial.items.map(i => ({
          producto_id: i.producto_id,
          sku: i.sku,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        }))
      : []
  )
  const [cliente, setCliente] = useState(cotizacionInicial?.cliente ?? '')
  const [descuento, setDescuento] = useState(cotizacionInicial?.descuento ?? 0)
  const [notas, setNotas] = useState(cotizacionInicial?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCategorias().then(setCategorias).catch(() => {})
    getFamilias().then(setFamilias).catch(() => {})
    getMateriales().then(setMateriales).catch(() => {})
    getTiposMedida().then(setTiposMedida).catch(() => {})
  }, [])

  const hayFiltros = filtros.sku.trim() || filtros.familia_id || filtros.categoria_id || filtros.material.trim() || filtros.tipo_medida

  useEffect(() => {
    if (!hayFiltros) { setResultados([]); return }
    const id = setTimeout(() => {
      setBuscando(true)
      getProductos(filtros).then(setResultados).catch(() => {}).finally(() => setBuscando(false))
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

  function agregarProducto(producto) {
    if (producto.precio == null) return
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === producto.id)
      if (existe) {
        return prev.map(i => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, {
        producto_id: producto.id,
        sku: producto.sku,
        descripcion: buildDescripcion(producto),
        cantidad: 1,
        precio_unitario: producto.precio,
      }]
    })
  }

  function setCantidad(producto_id, valor) {
    const n = parseInt(valor)
    if (!n || n < 1) return
    setCarrito(prev => prev.map(i => i.producto_id === producto_id ? { ...i, cantidad: n } : i))
  }

  function setPrecio(producto_id, valor) {
    const n = parseFloat(valor)
    if (isNaN(n) || n < 0) return
    setCarrito(prev => prev.map(i => i.producto_id === producto_id ? { ...i, precio_unitario: n } : i))
  }

  function quitarItem(producto_id) {
    setCarrito(prev => prev.filter(i => i.producto_id !== producto_id))
  }

  const subtotal = carrito.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
  const descMonto = subtotal * (descuento / 100)
  const total = subtotal - descMonto

  async function handleGuardar() {
    if (!cliente.trim()) { setError('El nombre del cliente es obligatorio'); return }
    if (carrito.length === 0) { setError('Agrega al menos un producto'); return }
    setError(null)
    setGuardando(true)
    try {
      const payload = {
        cliente,
        descuento: Number(descuento),
        notas: notas || null,
        items: carrito.map(i => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
        })),
      }
      const resultado = cotizacionInicial
        ? await api.updateCotizacion(cotizacionInicial.id, payload)
        : await api.createCotizacion(payload)
      onGuardado(resultado)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex h-full">

      {/* Panel izquierdo: búsqueda */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onCancelar} className="text-gray-400 hover:text-gray-700">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-base font-semibold text-gray-800">
              {cotizacionInicial ? `Editando cotización #${String(cotizacionInicial.id).padStart(4,'0')}` : 'Nueva cotización'}
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={filtros.sku} onChange={setFiltro('sku')} placeholder="Buscar SKU..." autoFocus className={inputClass} />
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
              {materiales.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
            </select>
            <input value={filtros.medida} onChange={setFiltro('medida')} placeholder="Medida..." className={inputClass} />
            <select value={filtros.tipo_medida} onChange={setFiltro('tipo_medida')} className={inputClass}>
              <option value="">Todos los tipos</option>
              {tiposMedida.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {!hayFiltros ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-3">
              <ShoppingCart size={48} />
              <p className="text-sm">Busca productos para agregar</p>
            </div>
          ) : buscando ? (
            <p className="text-sm text-gray-400 text-center py-10">Buscando...</p>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Sin resultados</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {['SKU', 'Familia', 'Medida', 'Material', 'Precio', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resultados.map(p => {
                  const sinPrecio = p.precio == null
                  return (
                    <tr
                      key={p.id}
                      onClick={() => !sinPrecio && agregarProducto(p)}
                      className={sinPrecio ? 'opacity-50' : 'hover:bg-blue-50 cursor-pointer'}
                    >
                      <td className="px-4 py-2.5 font-mono font-medium text-gray-900">{p.sku}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.familia.nombre}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.medida ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{p.material ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {sinPrecio
                          ? <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Sin precio</span>
                          : `$${p.precio.toFixed(2)}`}
                      </td>
                      <td className="px-4 py-2.5 text-blue-600 text-xs">{!sinPrecio && '+ Agregar'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panel derecho: cotización */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente *</label>
            <input
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Descuento %</label>
            <input
              type="number" min="0" max="100" step="0.5"
              value={descuento}
              onChange={e => setDescuento(Math.min(100, Math.max(0, Number(e.target.value))))}
              className={`${inputClass} w-full`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
          {carrito.length === 0 ? (
            <p className="text-sm text-gray-400 text-center pt-8">Sin productos</p>
          ) : carrito.map(item => (
            <div key={item.producto_id} className="border border-gray-100 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-sm text-gray-900">{item.sku}</p>
                  <p className="text-xs text-gray-400 truncate">{item.descripcion}</p>
                </div>
                <button onClick={() => quitarItem(item.producto_id)} className="text-gray-300 hover:text-red-500 shrink-0 ml-2">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Cant.</label>
                  <input
                    type="number" min="1" value={item.cantidad}
                    onChange={e => setCantidad(item.producto_id, e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Precio</label>
                  <input
                    type="number" min="0" step="0.01" value={item.precio_unitario}
                    onChange={e => setPrecio(item.producto_id, e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-gray-700">
                ${(item.precio_unitario * item.cantidad).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 px-4 py-3 space-y-2">
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Notas (opcional)"
            rows={2}
            className="w-full border border-gray-200 rounded px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />

          {subtotal > 0 && (
            <div className="text-sm space-y-1">
              {descuento > 0 && (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Descuento {descuento}%</span><span>-${descMonto.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100">
                <span>Total</span><span>${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleGuardar}
            disabled={guardando || carrito.length === 0 || !cliente.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save size={14} />
            {guardando ? 'Guardando...' : cotizacionInicial ? 'Guardar cambios' : 'Guardar cotización'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Cotizaciones() {
  const [vista, setVista] = useState('lista')
  const [editando, setEditando] = useState(null)

  function handleGuardado(cotizacion) {
    imprimirCotizacion(cotizacion)
    setVista('lista')
    setEditando(null)
  }

  function handleEditar(cotizacion) {
    setEditando(cotizacion)
    setVista('editor')
  }

  function handleNueva() {
    setEditando(null)
    setVista('editor')
  }

  function handleCancelar() {
    setEditando(null)
    setVista('lista')
  }

  if (vista === 'editor') {
    return (
      <EditorCotizacion
        cotizacionInicial={editando}
        onGuardado={handleGuardado}
        onCancelar={handleCancelar}
      />
    )
  }

  return (
    <ListaCotizaciones
      onNueva={handleNueva}
      onEditar={handleEditar}
    />
  )
}
