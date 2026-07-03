import { useState, useEffect } from 'react'
import { Plus, Minus, Trash2, AlertCircle, CheckCircle, FileText, Download, XCircle, CreditCard } from 'lucide-react'
import * as api from '../api/facturas'
import { getClientesFiscales } from '../api/clientesFiscales'
import { getProductos } from '../api/productos'
import { getMateriales, getTiposMedida } from '../api/catalogos'
import { getCategorias } from '../api/categorias'
import { getFamilias } from '../api/familias'
import { USOS_CFDI, FORMAS_PAGO } from '../constants/sat'

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

const FILTROS_VACIOS = { sku: '', familia_id: '', categoria_id: '', material: '', medida: '', tipo_medida: '' }

const MOTIVOS_CANCELACION = [
  { clave: '01', descripcion: 'Emitido con errores con relación' },
  { clave: '02', descripcion: 'Emitido con errores sin relación' },
  { clave: '03', descripcion: 'No se llevó a cabo la operación' },
  { clave: '04', descripcion: 'Operación nominativa en factura global' },
]

function fmt(n) {
  return Number(n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function descripcionProducto(p) {
  return [p.familia?.categoria?.nombre, p.familia?.nombre, p.medida, p.material].filter(Boolean).join(' ') || p.sku
}

// ── Modal cancelar ────────────────────────────────────────────────────────────

function ModalCancelar({ factura, onCancelar, onCerrar }) {
  const [motivo, setMotivo] = useState('02')
  const [cancelando, setCancelando] = useState(false)
  const [error, setError] = useState(null)

  async function handleCancelar() {
    setCancelando(true)
    setError(null)
    try {
      await onCancelar(factura.id, motivo)
      onCerrar()
    } catch (e) {
      setError(e.message)
      setCancelando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Cancelar factura {factura.folio || `#${factura.id}`}</h2>
        <p className="text-sm text-gray-500">Esta acción cancela el CFDI ante el SAT. No se puede deshacer.</p>
        <div>
          <label className={labelClass}>Motivo de cancelación</label>
          <select value={motivo} onChange={e => setMotivo(e.target.value)} className={`${inputClass} w-full`}>
            {MOTIVOS_CANCELACION.map(m => (
              <option key={m.clave} value={m.clave}>{m.clave} — {m.descripcion}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
            Volver
          </button>
          <button onClick={handleCancelar} disabled={cancelando}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50">
            {cancelando ? 'Cancelando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal complemento de pago ─────────────────────────────────────────────────

function ModalPago({ factura, onCerrar, onPagado }) {
  const pagosValidos = (factura.pagos || []).filter(p => p.status === 'valid')
  const pagado = pagosValidos.reduce((s, p) => s + p.monto, 0)
  const saldo = factura.total - pagado

  const hoy = new Date()
  const hoyCadena = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}T12:00`

  const [form, setForm] = useState({
    fecha_pago: hoyCadena,
    forma_pago: factura.forma_pago || '03',
    monto: saldo > 0 ? saldo.toFixed(2) : '',
  })
  const [registrando, setRegistrando] = useState(false)
  const [error, setError] = useState(null)

  async function handleRegistrar() {
    if (!form.forma_pago) { setError('Selecciona la forma de pago'); return }
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresa un monto válido'); return }
    setRegistrando(true)
    setError(null)
    try {
      await api.createComplementoPago(factura.id, {
        fecha_pago: form.fecha_pago,
        forma_pago: form.forma_pago,
        monto: Number(form.monto),
      })
      onPagado()
      onCerrar()
    } catch (e) {
      setError(e.message)
      setRegistrando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">Registrar pago</h2>
            <p className="text-xs text-gray-500 mt-0.5">{factura.folio || `#${factura.id}`} · {factura.cliente_razon_social}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Saldo pendiente</p>
            <p className="text-lg font-bold text-blue-600">{fmt(saldo)}</p>
          </div>
        </div>

        {/* Pagos anteriores */}
        {pagosValidos.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-500 mb-2">Pagos registrados</p>
            {pagosValidos.map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  Parcialidad {p.numero_parcialidad} · {new Date(p.fecha_pago).toLocaleDateString('es-MX')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">{fmt(p.monto)}</span>
                  <button onClick={() => window.open(api.urlPdfComplemento(p.id), '_blank')}
                    title="PDF" className="text-gray-400 hover:text-red-500">
                    <FileText size={12} />
                  </button>
                  <button onClick={() => window.open(api.urlXmlComplemento(p.id), '_blank')}
                    title="XML" className="text-gray-400 hover:text-blue-500">
                    <Download size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {saldo <= 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <CheckCircle size={20} className="text-green-500 mx-auto mb-1" />
            <p className="text-sm text-green-700 font-medium">Factura liquidada</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Fecha de pago *</label>
                <input type="datetime-local" value={form.fecha_pago}
                  onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))}
                  className={`${inputClass} w-full`} />
              </div>
              <div>
                <label className={labelClass}>Forma de pago *</label>
                <select value={form.forma_pago}
                  onChange={e => setForm(f => ({ ...f, forma_pago: e.target.value }))}
                  className={`${inputClass} w-full`}>
                  <option value="">— Forma —</option>
                  {FORMAS_PAGO.map(fp => (
                    <option key={fp.clave} value={fp.clave}>{fp.clave} — {fp.descripcion}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Monto a pagar *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0.01" step="0.01" max={saldo}
                  value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  className={`${inputClass} w-full pl-7`} />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Parcialidad {pagosValidos.length + 1} de {fmt(factura.total)}
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
            Cerrar
          </button>
          {saldo > 0 && (
            <button onClick={handleRegistrar} disabled={registrando}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
              {registrando ? 'Timbrando...' : 'Timbrar complemento'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Facturas() {
  const [vista, setVista] = useState('nueva')

  // Catálogos compartidos
  const [categorias, setCategorias] = useState([])
  const [familias, setFamilias] = useState([])
  const [materiales, setMateriales] = useState([])
  const [tiposMedida, setTiposMedida] = useState([])
  const [clientes, setClientes] = useState([])

  // Nueva factura
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [carrito, setCarrito] = useState([])
  const [datos, setDatos] = useState({ cliente_id: '', uso_cfdi: '', forma_pago: '', metodo_pago: 'PUE' })
  const [timbrando, setTimbrando] = useState(false)
  const [error, setError] = useState(null)

  // Historial
  const [facturas, setFacturas] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [modalCancelar, setModalCancelar] = useState(null)
  const [modalPago, setModalPago] = useState(null)

  useEffect(() => {
    getCategorias().then(setCategorias).catch(() => {})
    getFamilias().then(setFamilias).catch(() => {})
    getMateriales().then(setMateriales).catch(() => {})
    getTiposMedida().then(setTiposMedida).catch(() => {})
    getClientesFiscales().then(lista => setClientes(lista.filter(c => c.facturapi_id))).catch(() => {})
  }, [])

  // Autocompletar uso_cfdi desde el cliente seleccionado
  useEffect(() => {
    const c = clientes.find(c => c.id === Number(datos.cliente_id))
    if (c?.uso_cfdi) setDatos(d => ({ ...d, uso_cfdi: c.uso_cfdi }))
  }, [datos.cliente_id, clientes])

  // Búsqueda de productos con debounce
  const hayFiltros = Object.values(filtros).some(v => v !== '')
  useEffect(() => {
    if (!hayFiltros) { setResultados([]); return }
    const id = setTimeout(() => {
      setBuscando(true)
      getProductos(filtros).then(setResultados).catch(() => {}).finally(() => setBuscando(false))
    }, 300)
    return () => clearTimeout(id)
  }, [filtros])

  // Cargar historial al cambiar de vista
  useEffect(() => {
    if (vista !== 'historial') return
    setCargandoHistorial(true)
    api.getFacturas().then(setFacturas).catch(() => {}).finally(() => setCargandoHistorial(false))
  }, [vista])

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

  function agregarAlCarrito(p) {
    setCarrito(prev => {
      const idx = prev.findIndex(i => i._productoId === p.id)
      if (idx >= 0) return prev.map((i, n) => n === idx ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, {
        _productoId: p.id,
        sku: p.sku,
        descripcion: descripcionProducto(p),
        clave_prod_serv: p.clave_prod_serv ?? '',
        clave_unidad: p.clave_unidad ?? '',
        unidad: 'Pieza',
        cantidad: 1,
        precio_unitario: p.precio ?? 0,
      }]
    })
  }

  function actualizarItem(idx, campo, valor) {
    setCarrito(prev => prev.map((i, n) => n === idx ? { ...i, [campo]: valor } : i))
  }

  function cambiarCantidad(idx, delta) {
    setCarrito(prev => prev
      .map((i, n) => n === idx ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i)
    )
  }

  function quitarItem(idx) {
    setCarrito(prev => prev.filter((_, n) => n !== idx))
  }

  const total = carrito.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)
  const subtotal = total / 1.16   // base sin IVA
  const iva = total - subtotal    // IVA incluido en el precio
  const itemsSinCodigos = carrito.filter(i => !i.clave_prod_serv || !i.clave_unidad)

  async function timbrar() {
    if (!datos.cliente_id) { setError('Selecciona un cliente'); return }
    if (!datos.uso_cfdi) { setError('Selecciona el uso de CFDI'); return }
    if (!datos.forma_pago) { setError('Selecciona la forma de pago'); return }
    if (carrito.length === 0) { setError('Agrega al menos un concepto'); return }
    if (itemsSinCodigos.length > 0) { setError(`${itemsSinCodigos.length} concepto(s) sin clave SAT. Complétalos primero.`); return }
    setError(null)
    setTimbrando(true)
    try {
      await api.createFactura({
        cliente_id: Number(datos.cliente_id),
        uso_cfdi: datos.uso_cfdi,
        forma_pago: datos.forma_pago,
        metodo_pago: datos.metodo_pago,
        items: carrito.map(({ descripcion, clave_prod_serv, clave_unidad, unidad, cantidad, precio_unitario }) => ({
          descripcion, clave_prod_serv, clave_unidad, unidad,
          cantidad: Number(cantidad),
          precio_unitario: Number(precio_unitario),
        })),
      })
      setCarrito([])
      setDatos({ cliente_id: '', uso_cfdi: '', forma_pago: '', metodo_pago: 'PUE' })
      setFiltros(FILTROS_VACIOS)
      setVista('historial')
    } catch (e) {
      setError(e.message)
    } finally {
      setTimbrando(false)
    }
  }

  function recargarHistorial() {
    api.getFacturas().then(setFacturas).catch(() => {})
  }

  async function handleCancelar(id, motivo) {
    await api.cancelarFactura(id, motivo)
    setFacturas(fs => fs.map(f => f.id === id ? { ...f, status: 'canceled' } : f))
  }

  function descargar(url) {
    const a = document.createElement('a')
    a.href = url; a.click()
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header con toggle de vista */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-4 shrink-0">
        <h1 className="font-semibold text-gray-800 shrink-0">Facturas</h1>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setVista('nueva')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${vista === 'nueva' ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
            Nueva factura
          </button>
          <button onClick={() => setVista('historial')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${vista === 'historial' ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
            Historial
          </button>
        </div>
      </div>

      {vista === 'nueva' ? (
        <div className="flex flex-1 min-h-0">

          {/* Panel izquierdo: filtros + resultados */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-gray-200 p-4">
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
                  <FileText size={48} />
                  <p className="text-sm">Usa los filtros para buscar productos</p>
                </div>
              ) : buscando ? (
                <p className="text-sm text-gray-400 text-center py-10">Buscando...</p>
              ) : resultados.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Sin resultados</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      {['SKU', 'Familia', 'Categoría', 'Medida', 'Material', 'Precio', 'SAT', ''].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resultados.map(p => (
                      <tr key={p.id} onClick={() => agregarAlCarrito(p)}
                        className="hover:bg-blue-50 cursor-pointer">
                        <td className="px-4 py-2.5 font-mono font-medium text-gray-900">{p.sku}</td>
                        <td className="px-4 py-2.5 text-gray-700">{p.familia.nombre}</td>
                        <td className="px-4 py-2.5 text-gray-500">{p.familia.categoria.nombre}</td>
                        <td className="px-4 py-2.5 text-gray-700">{p.medida ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{p.material ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {p.precio != null ? `$${p.precio.toFixed(2)}` : <span className="text-xs text-orange-500">Sin precio</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {(p.clave_prod_serv && p.clave_unidad)
                            ? <CheckCircle size={14} className="text-green-400" title="Claves SAT completas" />
                            : <AlertCircle size={14} className="text-amber-400" title="Faltan claves SAT" />}
                        </td>
                        <td className="px-4 py-2.5 text-blue-500 text-xs">+ Agregar</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Panel derecho: datos de factura + carrito */}
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col">

            {/* Datos fiscales */}
            <div className="p-4 border-b border-gray-100 space-y-3 shrink-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Datos de facturación</p>
              <div>
                <label className={labelClass}>Cliente *</label>
                <select value={datos.cliente_id} onChange={e => setDatos(d => ({ ...d, cliente_id: e.target.value }))}
                  className={`${inputClass} w-full`}>
                  <option value="">— Seleccionar cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
                {clientes.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> Sincroniza clientes desde el módulo de Clientes
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Uso CFDI *</label>
                  <select value={datos.uso_cfdi} onChange={e => setDatos(d => ({ ...d, uso_cfdi: e.target.value }))}
                    className={`${inputClass} w-full`}>
                    <option value="">— Uso —</option>
                    {USOS_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} — {u.descripcion}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Forma de pago *</label>
                  <select value={datos.forma_pago} onChange={e => setDatos(d => ({ ...d, forma_pago: e.target.value }))}
                    className={`${inputClass} w-full`}>
                    <option value="">— Forma —</option>
                    {FORMAS_PAGO.map(f => <option key={f.clave} value={f.clave}>{f.clave} — {f.descripcion}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                {[{ clave: 'PUE', label: 'PUE — Una sola exhibición' }, { clave: 'PPD', label: 'PPD — Parcialidades' }].map(m => (
                  <label key={m.clave}
                    className={`flex-1 border rounded-lg px-3 py-2 cursor-pointer text-xs transition-colors ${datos.metodo_pago === m.clave ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <input type="radio" name="metodo" value={m.clave} checked={datos.metodo_pago === m.clave}
                      onChange={e => setDatos(d => ({ ...d, metodo_pago: e.target.value }))} className="sr-only" />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Carrito */}
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {carrito.length === 0 ? (
                <p className="text-sm text-gray-400 text-center pt-8">
                  Selecciona productos de la tabla
                </p>
              ) : carrito.map((item, idx) => (
                <div key={idx}
                  className={`border rounded-lg p-3 space-y-2 ${!item.clave_prod_serv || !item.clave_unidad ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-gray-600">{item.sku}</p>
                      <input
                        value={item.descripcion}
                        onChange={e => actualizarItem(idx, 'descripcion', e.target.value)}
                        className="text-sm text-gray-800 w-full border-0 border-b border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none bg-transparent mt-0.5"
                      />
                    </div>
                    <button onClick={() => quitarItem(idx)} className="text-gray-300 hover:text-red-500 shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Claves SAT — solo muestra los inputs si faltan */}
                  {(!item.clave_prod_serv || !item.clave_unidad) ? (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-amber-600 mb-0.5">Clave prod/serv</p>
                        <input value={item.clave_prod_serv}
                          onChange={e => actualizarItem(idx, 'clave_prod_serv', e.target.value.toUpperCase())}
                          placeholder="ej. 31161500" maxLength={10}
                          className="border border-amber-300 rounded px-2 py-1 text-xs font-mono w-full focus:outline-none focus:ring-1 focus:ring-amber-400" />
                      </div>
                      <div className="w-20">
                        <p className="text-xs text-amber-600 mb-0.5">Unidad</p>
                        <input value={item.clave_unidad}
                          onChange={e => actualizarItem(idx, 'clave_unidad', e.target.value.toUpperCase())}
                          placeholder="H87" maxLength={6}
                          className="border border-amber-300 rounded px-2 py-1 text-xs font-mono w-full focus:outline-none focus:ring-1 focus:ring-amber-400" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 font-mono">
                      {item.clave_prod_serv} / {item.clave_unidad}
                    </p>
                  )}

                  {/* Cantidad + precio */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => cambiarCantidad(idx, -1)}
                        className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                        <Minus size={10} />
                      </button>
                      <input type="number" min="1" value={item.cantidad}
                        onChange={e => actualizarItem(idx, 'cantidad', Math.max(1, Number(e.target.value)))}
                        className="w-14 text-center border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <button onClick={() => cambiarCantidad(idx, 1)}
                        className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                        <Plus size={10} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-400">$</span>
                      <input type="number" min="0" step="0.01" value={item.precio_unitario}
                        onChange={e => actualizarItem(idx, 'precio_unitario', e.target.value)}
                        className="w-20 text-right border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 shrink-0">
                      {fmt(item.cantidad * item.precio_unitario)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totales + timbrar */}
            <div className="border-t border-gray-200 p-4 space-y-2 shrink-0">
              {error && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded flex items-center gap-1">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal (sin IVA)</span><span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>IVA 16%</span><span>{fmt(iva)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 text-lg border-t border-gray-100 pt-2">
                <span>Total</span><span>{fmt(total)}</span>
              </div>
              <button onClick={timbrar} disabled={timbrando || carrito.length === 0}
                className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-1">
                {timbrando ? 'Timbrando...' : 'Timbrar factura'}
              </button>
            </div>
          </div>
        </div>

      ) : (
        /* ── Historial ── */
        <div className="flex-1 overflow-auto">
          {cargandoHistorial ? (
            <p className="text-sm text-gray-400 text-center py-16">Cargando...</p>
          ) : facturas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-16">No hay facturas registradas</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {['Folio', 'Fecha', 'Cliente', 'RFC', 'Subtotal', 'IVA', 'Total', 'Saldo', 'Método', 'Estado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => {
                  const pagado = (f.pagos || []).filter(p => p.status === 'valid').reduce((s, p) => s + p.monto, 0)
                  const saldo = f.total - pagado
                  const esPPD = f.metodo_pago === 'PPD'
                  const tieneSaldo = esPPD && saldo > 0.01 && f.status === 'valid'
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-700">{f.folio || `#${f.id}`}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(f.fecha).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-[160px] truncate">{f.cliente_razon_social}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{f.cliente_rfc}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(f.subtotal)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{fmt(f.iva)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(f.total)}</td>
                      <td className="px-4 py-3 text-right">
                        {esPPD
                          ? <span className={`text-xs font-semibold ${saldo > 0.01 ? 'text-amber-600' : 'text-green-600'}`}>
                              {fmt(saldo)}
                            </span>
                          : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{f.metodo_pago}</span>
                      </td>
                      <td className="px-4 py-3">
                        {f.status === 'valid'
                          ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Vigente</span>
                          : <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">Cancelada</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => descargar(api.urlPdf(f.id))} title="PDF"
                            className="text-gray-400 hover:text-red-500 transition-colors">
                            <FileText size={15} />
                          </button>
                          <button onClick={() => descargar(api.urlXml(f.id))} title="XML"
                            className="text-gray-400 hover:text-blue-500 transition-colors">
                            <Download size={15} />
                          </button>
                          {esPPD && f.status === 'valid' && (
                            <button onClick={() => setModalPago(f)}
                              title={tieneSaldo ? 'Registrar pago' : 'Ver pagos'}
                              className={`transition-colors ${tieneSaldo ? 'text-amber-500 hover:text-amber-700' : 'text-gray-300 hover:text-gray-500'}`}>
                              <CreditCard size={15} />
                            </button>
                          )}
                          {f.status === 'valid' && (
                            <button onClick={() => setModalCancelar(f)} title="Cancelar"
                              className="text-gray-400 hover:text-red-600 transition-colors">
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalCancelar && (
        <ModalCancelar
          factura={modalCancelar}
          onCancelar={handleCancelar}
          onCerrar={() => setModalCancelar(null)}
        />
      )}

      {modalPago && (
        <ModalPago
          factura={modalPago}
          onCerrar={() => setModalPago(null)}
          onPagado={() => {
            setModalPago(null)
            recargarHistorial()
          }}
        />
      )}
    </div>
  )
}
