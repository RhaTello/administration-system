import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Search, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react'
import * as api from '../api/clientesFiscales'
import { REGIMENES_FISCALES, USOS_CFDI, FORMAS_PAGO } from '../constants/sat'

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'
const sectionTitle = 'text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50 border-y border-gray-100'

const FORM_VACIO = {
  razon_social: '', rfc: '', nombre_comercial: '', regimen_fiscal: '',
  uso_cfdi: '', forma_pago: '', correo: '', telefono: '', contacto: '',
  calle: '', num_exterior: '', num_interior: '', entre_calle: '',
  colonia: '', municipio: '', estado: '', cp: '',
  manejo_credito: 0, dias_credito: 0, limite_credito: 0, descuento: 0,
}

const RFC_REGEX = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i

function validarRFC(rfc) {
  const r = rfc.trim().toUpperCase()
  // RFCs genéricos válidos del SAT
  if (r === 'XAXX010101000' || r === 'XEXX010101000') return null
  if (!RFC_REGEX.test(r)) return 'RFC inválido (debe tener 12 o 13 caracteres con formato correcto)'
  return null
}

function datosTimbradoCompletos(c) {
  return !!(c.rfc && c.regimen_fiscal && c.cp && c.uso_cfdi)
}

function EstadoCFDI({ form }) {
  const faltantes = []
  if (!form.rfc?.trim()) faltantes.push('RFC')
  if (!form.regimen_fiscal) faltantes.push('Régimen fiscal')
  if (!form.cp?.trim()) faltantes.push('C.P.')
  if (!form.uso_cfdi) faltantes.push('Uso CFDI')
  if (faltantes.length === 0) return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <CheckCircle size={12} /> Datos de timbrado completos
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <AlertCircle size={12} /> Faltan para timbrar: {faltantes.join(', ')}
    </span>
  )
}

function SatSelect({ label, value, onChange, opciones, required }) {
  return (
    <div>
      <label className={labelClass}>{label}{required && ' *'}</label>
      <select value={value} onChange={onChange} className={inputClass}>
        <option value="">— Seleccionar —</option>
        {opciones.map(o => (
          <option key={o.clave} value={o.clave}>{o.clave} — {o.descripcion}</option>
        ))}
      </select>
    </div>
  )
}

function ClienteForm({ inicial, onGuardar, onCancelar }) {
  const [form, setForm] = useState(inicial ? { ...FORM_VACIO, ...inicial } : { ...FORM_VACIO })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const set = campo => e => setForm(f => ({ ...f, [campo]: e.target.value }))
  const setNum = campo => e => setForm(f => ({ ...f, [campo]: Number(e.target.value) }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.razon_social.trim()) { setError('La razón social es obligatoria'); return }
    if (!form.rfc.trim()) { setError('El RFC es obligatorio'); return }
    const rfcError = validarRFC(form.rfc)
    if (rfcError) { setError(rfcError); return }
    if (form.cp && !/^\d{5}$/.test(form.cp.trim())) { setError('El C.P. debe ser de 5 dígitos'); return }
    setError(null)
    setGuardando(true)
    try {
      await onGuardar(form)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
      {error && (
        <div className="mx-4 mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {/* Datos generales */}
        <p className={sectionTitle}>Datos generales</p>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Razón social *</label>
            <input value={form.razon_social} onChange={set('razon_social')} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>RFC *</label>
            <input value={form.rfc}
              onChange={e => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
              required className={inputClass} maxLength={13}
              placeholder="ej. ABC010101XYZ" />
          </div>
          <div>
            <label className={labelClass}>Nombre comercial</label>
            <input value={form.nombre_comercial} onChange={set('nombre_comercial')} className={inputClass} />
          </div>
          <SatSelect
            label="Régimen fiscal"
            value={form.regimen_fiscal}
            onChange={set('regimen_fiscal')}
            opciones={REGIMENES_FISCALES}
          />
          <div>
            <label className={labelClass}>Contacto</label>
            <input value={form.contacto} onChange={set('contacto')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Teléfono</label>
            <input value={form.telefono} onChange={set('telefono')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Correo</label>
            <input type="email" value={form.correo} onChange={set('correo')} className={inputClass} />
          </div>
        </div>

        {/* Dirección */}
        <p className={sectionTitle}>Dirección fiscal</p>
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Calle</label>
            <input value={form.calle} onChange={set('calle')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>No. Exterior</label>
            <input value={form.num_exterior} onChange={set('num_exterior')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>No. Interior</label>
            <input value={form.num_interior} onChange={set('num_interior')} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Entre calle</label>
            <input value={form.entre_calle} onChange={set('entre_calle')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>C.P. *</label>
            <input value={form.cp}
              onChange={e => setForm(f => ({ ...f, cp: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
              placeholder="Requerido CFDI 4.0" className={inputClass} maxLength={5} />
          </div>
          <div>
            <label className={labelClass}>Colonia</label>
            <input value={form.colonia} onChange={set('colonia')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Municipio</label>
            <input value={form.municipio} onChange={set('municipio')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <input value={form.estado} onChange={set('estado')} className={inputClass} />
          </div>
        </div>

        {/* Datos fiscales */}
        <p className={sectionTitle}>Datos fiscales</p>
        <div className="p-4 grid grid-cols-2 gap-3">
          <SatSelect
            label="Uso de CFDI"
            value={form.uso_cfdi}
            onChange={set('uso_cfdi')}
            opciones={USOS_CFDI}
          />
          <SatSelect
            label="Forma de pago"
            value={form.forma_pago}
            onChange={set('forma_pago')}
            opciones={FORMAS_PAGO}
          />
        </div>

        {/* Datos comerciales */}
        <p className={sectionTitle}>Datos comerciales</p>
        <div className="p-4 grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Descuento %</label>
            <input type="number" min="0" max="100" step="0.01"
              value={form.descuento} onChange={setNum('descuento')} className={inputClass} />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.manejo_credito === 1}
                onChange={e => setForm(f => ({ ...f, manejo_credito: e.target.checked ? 1 : 0 }))}
                className="w-4 h-4 accent-blue-600"
              />
              Manejo de crédito
            </label>
          </div>
          {form.manejo_credito === 1 && (
            <>
              <div>
                <label className={labelClass}>Días de crédito</label>
                <input type="number" min="0" value={form.dias_credito}
                  onChange={setNum('dias_credito')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Límite de crédito</label>
                <input type="number" min="0" step="0.01" value={form.limite_credito}
                  onChange={setNum('limite_credito')} className={inputClass} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <EstadoCFDI form={form} />
        <div className="flex gap-2">
          <button type="button" onClick={onCancelar}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Panel lateral ─────────────────────────────────────────────────────────────

function PanelLateral({ cliente, onCerrar, onEditar, onSincronizado }) {
  const regimen = REGIMENES_FISCALES.find(r => r.clave === cliente.regimen_fiscal)
  const usoCfdi = USOS_CFDI.find(u => u.clave === cliente.uso_cfdi)
  const formaPago = FORMAS_PAGO.find(f => f.clave === cliente.forma_pago)
  const timbradoOk = datosTimbradoCompletos(cliente)
  const [sincronizando, setSincronizando] = useState(false)
  const [errorSync, setErrorSync] = useState(null)

  async function handleSincronizar() {
    setSincronizando(true)
    setErrorSync(null)
    try {
      const actualizado = await api.sincronizarClienteFiscal(cliente.id)
      onSincronizado(actualizado)
    } catch (e) {
      setErrorSync(e.message)
    } finally {
      setSincronizando(false)
    }
  }

  function Campo({ label, valor }) {
    if (!valor) return null
    return (
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{valor}</p>
      </div>
    )
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-800 text-sm truncate">{cliente.razon_social}</h2>
        <button onClick={onCerrar} className="text-gray-400 hover:text-gray-600 shrink-0 ml-2">
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <div className="flex items-center gap-2">
          {timbradoOk
            ? <><CheckCircle size={14} className="text-green-500" /><span className="text-xs text-green-600">Datos de timbrado completos</span></>
            : <><AlertCircle size={14} className="text-amber-500" /><span className="text-xs text-amber-600">Faltan datos para timbrar (RFC, régimen, C.P., uso CFDI)</span></>
          }
        </div>

        <div className="space-y-3">
          <Campo label="RFC" valor={cliente.rfc} />
          <Campo label="Nombre comercial" valor={cliente.nombre_comercial} />
          <Campo label="Régimen fiscal" valor={regimen ? `${regimen.clave} — ${regimen.descripcion}` : cliente.regimen_fiscal} />
          <Campo label="Correo" valor={cliente.correo} />
          <Campo label="Teléfono" valor={cliente.telefono} />
          <Campo label="Contacto" valor={cliente.contacto} />
        </div>

        {(cliente.calle || cliente.cp) && (
          <>
            <hr className="border-gray-100" />
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Dirección fiscal</p>
              <p className="text-sm text-gray-700">
                {[cliente.calle, cliente.num_exterior, cliente.num_interior && `Int. ${cliente.num_interior}`].filter(Boolean).join(' ')}
              </p>
              <p className="text-sm text-gray-700">
                {[cliente.colonia, cliente.municipio, cliente.estado].filter(Boolean).join(', ')}
              </p>
              {cliente.cp && <p className="text-sm text-gray-700">C.P. {cliente.cp}</p>}
            </div>
          </>
        )}

        {(cliente.uso_cfdi || cliente.forma_pago) && (
          <>
            <hr className="border-gray-100" />
            <div className="space-y-3">
              <Campo label="Uso de CFDI" valor={usoCfdi ? `${usoCfdi.clave} — ${usoCfdi.descripcion}` : cliente.uso_cfdi} />
              <Campo label="Forma de pago" valor={formaPago ? `${formaPago.clave} — ${formaPago.descripcion}` : cliente.forma_pago} />
            </div>
          </>
        )}

        {cliente.manejo_credito === 1 && (
          <>
            <hr className="border-gray-100" />
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Crédito</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-gray-400">Días</p><p>{cliente.dias_credito}</p></div>
                <div><p className="text-xs text-gray-400">Límite</p><p>${cliente.limite_credito.toFixed(2)}</p></div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-gray-200 p-3 space-y-2">
        {errorSync && (
          <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{errorSync}</p>
        )}
        <div className="flex gap-2">
          <button onClick={onEditar}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50">
            <Pencil size={13} /> Editar
          </button>
          <button onClick={handleSincronizar} disabled={sincronizando || !timbradoOk}
            title={!timbradoOk ? 'Completa RFC, régimen fiscal y C.P. primero' : (cliente.facturapi_id ? 'Actualizar en Facturapi' : 'Registrar en Facturapi')}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-green-700 border border-green-200 rounded hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed">
            <RefreshCw size={13} className={sincronizando ? 'animate-spin' : ''} />
            {cliente.facturapi_id ? 'Actualizar' : 'Sincronizar'}
          </button>
        </div>
        {cliente.facturapi_id && (
          <p className="text-xs text-gray-400 text-center font-mono truncate">{cliente.facturapi_id}</p>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ClientesFiscales() {
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [seleccionado, setSeleccionado] = useState(null)
  const [modal, setModal] = useState({ abierto: false, cliente: null })
  const busquedaRef = useRef('')

  async function cargar(texto = '') {
    setCargando(true)
    try { setClientes(await api.getClientesFiscales(texto)) } catch { /* silent */ }
    finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    busquedaRef.current = busqueda
    const id = setTimeout(() => {
      if (busquedaRef.current === busqueda) cargar(busqueda)
    }, 300)
    return () => clearTimeout(id)
  }, [busqueda])

  function abrirNuevo() { setModal({ abierto: true, cliente: null }) }
  function abrirEditar(c) { setModal({ abierto: true, cliente: c }) }
  function cerrarModal() { setModal({ abierto: false, cliente: null }) }

  async function handleGuardar(datos) {
    if (modal.cliente) {
      const actualizado = await api.updateClienteFiscal(modal.cliente.id, datos)
      setClientes(cs => cs.map(c => c.id === actualizado.id ? actualizado : c))
      setSeleccionado(actualizado)
    } else {
      const nuevo = await api.createClienteFiscal(datos)
      setClientes(cs => [...cs, nuevo].sort((a, b) => a.razon_social.localeCompare(b.razon_social)))
      setSeleccionado(nuevo)
    }
    cerrarModal()
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este cliente?')) return
    try {
      await api.deleteClienteFiscal(id)
      setClientes(cs => cs.filter(c => c.id !== id))
      if (seleccionado?.id === id) setSeleccionado(null)
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="flex h-full">
      {/* Lista */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-gray-800 shrink-0">Clientes fiscales</h1>
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o RFC..."
                className="border border-gray-300 rounded pl-8 pr-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{clientes.length} registros</span>
            <button onClick={abrirNuevo}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              <Plus size={15} /> Agregar cliente
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {cargando ? (
            <p className="text-sm text-gray-400 text-center py-16">Cargando...</p>
          ) : clientes.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-gray-400 mb-4">
                {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay clientes registrados'}
              </p>
              {!busqueda && (
                <button onClick={abrirNuevo}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                  <Plus size={15} /> Agregar primer cliente
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {['Razón social', 'RFC', 'Teléfono', 'Correo', 'Crédito', 'Datos timbrado', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientes.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSeleccionado(s => s?.id === c.id ? null : c)}
                    className={`cursor-pointer hover:bg-gray-50 ${seleccionado?.id === c.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{c.razon_social}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{c.rfc}</td>
                    <td className="px-4 py-3 text-gray-500">{c.telefono || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.correo || '—'}</td>
                    <td className="px-4 py-3">
                      {c.manejo_credito === 1
                        ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Sí</span>
                        : <span className="text-xs text-gray-400">No</span>}
                    </td>
                    <td className="px-4 py-3">
                      {datosTimbradoCompletos(c)
                        ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={13} /> Completo</span>
                        : <span className="flex items-center gap-1 text-xs text-amber-600"><AlertCircle size={13} /> Incompleto</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={e => { e.stopPropagation(); handleEliminar(c.id) }}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Panel de detalle */}
      {seleccionado && (
        <PanelLateral
          cliente={seleccionado}
          onCerrar={() => setSeleccionado(null)}
          onEditar={() => abrirEditar(seleccionado)}
          onSincronizado={actualizado => {
            setClientes(cs => cs.map(c => c.id === actualizado.id ? actualizado : c))
            setSeleccionado(actualizado)
          }}
        />
      )}

      {/* Modal formulario */}
      {modal.abierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              <h2 className="font-semibold text-gray-800">
                {modal.cliente ? `Editar: ${modal.cliente.razon_social}` : 'Nuevo cliente fiscal'}
              </h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <ClienteForm
              inicial={modal.cliente}
              onGuardar={handleGuardar}
              onCancelar={cerrarModal}
            />
          </div>
        </div>
      )}
    </div>
  )
}
