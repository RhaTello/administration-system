import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Upload, Download, Settings, X, Check } from 'lucide-react'
import Modal from '../components/Modal'
import * as api from '../api/productos'
import * as catalogosApi from '../api/catalogos'
import { getCategorias } from '../api/categorias'
import { getFamilias } from '../api/familias'

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

function ProductoForm({ inicial, familias, materiales, tiposMedida, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    sku: inicial?.sku ?? '',
    familia_id: inicial?.familia_id ?? '',
    medida: inicial?.medida ?? '',
    material: inicial?.material ?? '',
    tipo_medida: inicial?.tipo_medida ?? '',
    precio: inicial?.precio ?? '',
    costo: inicial?.costo ?? '',
    stock: inicial?.stock ?? 0,
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const set = campo => e => setForm(f => ({ ...f, [campo]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await onGuardar({
        sku: form.sku,
        familia_id: Number(form.familia_id),
        medida: form.medida || null,
        material: form.material || null,
        tipo_medida: form.tipo_medida || null,
        precio: form.precio !== '' ? Number(form.precio) : null,
        costo: form.costo !== '' ? Number(form.costo) : null,
        stock: Number(form.stock),
      })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>SKU *</label>
          <input required value={form.sku} onChange={set('sku')} className={`${inputClass} w-full`} />
        </div>
        <div>
          <label className={labelClass}>Familia *</label>
          <select required value={form.familia_id} onChange={set('familia_id')} className={`${inputClass} w-full`}>
            <option value="">— Seleccionar —</option>
            {familias.map(f => (
              <option key={f.id} value={f.id}>{f.nombre} ({f.categoria.nombre})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Medida</label>
          <input value={form.medida} onChange={set('medida')} placeholder='ej. 1/4" x 1"' className={`${inputClass} w-full`} />
        </div>
        <div>
          <label className={labelClass}>Material</label>
          <select value={form.material} onChange={set('material')} className={`${inputClass} w-full`}>
            <option value="">— Ninguno —</option>
            {materiales.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Tipo de medida</label>
          <select value={form.tipo_medida} onChange={set('tipo_medida')} className={`${inputClass} w-full`}>
            <option value="">— Ninguno —</option>
            {tiposMedida.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Stock</label>
          <input type="number" min="0" value={form.stock} onChange={set('stock')} className={`${inputClass} w-full`} />
        </div>
        <div>
          <label className={labelClass}>Precio</label>
          <input type="number" step="0.01" min="0" value={form.precio} onChange={set('precio')} placeholder="0.00" className={`${inputClass} w-full`} />
        </div>
        <div>
          <label className={labelClass}>Costo</label>
          <input type="number" step="0.01" min="0" value={form.costo} onChange={set('costo')} placeholder="0.00" className={`${inputClass} w-full`} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancelar} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

function CatalogoSeccion({ titulo, items, onAgregar, onRenombrar, onEliminar }) {
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [editandoValor, setEditandoValor] = useState('')

  async function handleAgregar(e) {
    e.preventDefault()
    if (!nuevo.trim()) return
    setError(null)
    setGuardando(true)
    try {
      await onAgregar(nuevo.trim())
      setNuevo('')
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  function iniciarEdicion(item) {
    setEditandoId(item.id)
    setEditandoValor(item.nombre)
    setError(null)
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditandoValor('')
  }

  async function confirmarEdicion(id) {
    const nombre = editandoValor.trim()
    if (!nombre) return
    setError(null)
    try {
      await onRenombrar(id, nombre)
      setEditandoId(null)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{titulo}</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
        {items.length === 0
          ? <p className="text-xs text-gray-400 px-3 py-3">Sin opciones</p>
          : items.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0">
              {editandoId === item.id ? (
                <>
                  <input
                    autoFocus
                    value={editandoValor}
                    onChange={e => setEditandoValor(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmarEdicion(item.id)
                      if (e.key === 'Escape') cancelarEdicion()
                    }}
                    className="flex-1 border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none"
                  />
                  <button onClick={() => confirmarEdicion(item.id)} className="text-green-600 hover:text-green-700">
                    <Check size={14} />
                  </button>
                  <button onClick={cancelarEdicion} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-700">{item.nombre}</span>
                  <button onClick={() => iniciarEdicion(item)} className="text-gray-300 hover:text-blue-500 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => onEliminar(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          ))
        }
      </div>
      <form onSubmit={handleAgregar} className="flex gap-2">
        <input
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          placeholder="Nuevo..."
          className={`${inputClass} flex-1 text-sm`}
        />
        <button
          type="submit"
          disabled={guardando || !nuevo.trim()}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [familias, setFamilias] = useState([])
  const [categorias, setCategorias] = useState([])
  const [materiales, setMateriales] = useState([])
  const [tiposMedida, setTiposMedida] = useState([])
  const [filtros, setFiltros] = useState({ sku: '', familia_id: '', categoria_id: '', material: '', tipo_medida: '' })
  const [modal, setModal] = useState({ abierto: false, producto: null })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [modalCatalogos, setModalCatalogos] = useState(false)

  function cargarCatalogos() {
    catalogosApi.getMateriales().then(setMateriales).catch(() => {})
    catalogosApi.getTiposMedida().then(setTiposMedida).catch(() => {})
  }

  useEffect(() => {
    getCategorias().then(setCategorias).catch(() => {})
    getFamilias().then(setFamilias).catch(() => {})
    cargarCatalogos()
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      setCargando(true)
      setError(null)
      api.getProductos(filtros)
        .then(setProductos)
        .catch(e => setError(e.message))
        .finally(() => setCargando(false))
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

  function cerrarModal() { setModal({ abierto: false, producto: null }) }

  async function handleGuardar(datos) {
    if (modal.producto) {
      await api.updateProducto(modal.producto.id, datos)
    } else {
      await api.createProducto(datos)
    }
    cerrarModal()
    const actualizados = await api.getProductos(filtros)
    setProductos(actualizados)
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este producto?')) return
    try {
      await api.deleteProducto(id)
      setProductos(p => p.filter(x => x.id !== id))
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-800">Productos</h1>
        <div className="flex gap-2">
          <button onClick={() => setModalCatalogos(true)}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-50">
            <Settings size={15} /> Catálogos
          </button>
          <button onClick={() => setModalImportar(true)}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-50">
            <Upload size={15} /> Importar CSV
          </button>
          <button onClick={() => setModal({ abierto: true, producto: null })}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            <Plus size={15} /> Nuevo producto
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 grid grid-cols-5 gap-2">
        <input value={filtros.sku} onChange={setFiltro('sku')} placeholder="Buscar SKU..."
          className={inputClass} />
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
        <select value={filtros.tipo_medida} onChange={setFiltro('tipo_medida')} className={inputClass}>
          <option value="">Todos los tipos</option>
          {tiposMedida.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}

      <p className="text-xs text-gray-400 mb-2">
        {cargando ? 'Cargando...' : `Mostrando ${productos.length} producto${productos.length !== 1 ? 's' : ''}`}
      </p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['SKU', 'Familia', 'Categoría', 'Medida', 'Material', 'Tipo', 'Precio', 'Costo', 'Stock', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">Cargando...</td></tr>
            ) : productos.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">Sin resultados</td></tr>
            ) : productos.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium text-gray-900">{p.sku}</td>
                <td className="px-4 py-3 text-gray-700">{p.familia.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{p.familia.categoria.nombre}</td>
                <td className="px-4 py-3 text-gray-700">{p.medida ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">{p.material ?? '—'}</td>
                <td className="px-4 py-3">
                  {p.tipo_medida
                    ? <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{p.tipo_medida}</span>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-700">{p.precio != null ? `$${p.precio.toFixed(2)}` : '—'}</td>
                <td className="px-4 py-3 text-gray-700">{p.costo != null ? `$${p.costo.toFixed(2)}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {p.stock}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ abierto: true, producto: p })}
                      className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleEliminar(p.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.abierto && (
        <Modal
          titulo={modal.producto ? `Editar: ${modal.producto.sku}` : 'Nuevo producto'}
          onCerrar={cerrarModal}
        >
          <ProductoForm
            inicial={modal.producto}
            familias={familias}
            materiales={materiales}
            tiposMedida={tiposMedida}
            onGuardar={handleGuardar}
            onCancelar={cerrarModal}
          />
        </Modal>
      )}

      {modalImportar && (
        <Modal
          titulo="Importar productos desde CSV"
          onCerrar={() => {
            setModalImportar(false)
            api.getProductos(filtros).then(setProductos)
          }}
        >
          <ImportarCSV />
        </Modal>
      )}

      {modalCatalogos && (
        <Modal titulo="Catálogos" onCerrar={() => setModalCatalogos(false)}>
          <div className="grid grid-cols-2 gap-6">
            <CatalogoSeccion
              titulo="Materiales"
              items={materiales}
              onAgregar={async nombre => {
                await catalogosApi.createMaterial(nombre)
                cargarCatalogos()
              }}
              onRenombrar={async (id, nombre) => {
                await catalogosApi.updateMaterial(id, nombre)
                cargarCatalogos()
              }}
              onEliminar={async id => {
                await catalogosApi.deleteMaterial(id)
                cargarCatalogos()
              }}
            />
            <CatalogoSeccion
              titulo="Tipos de medida"
              items={tiposMedida}
              onAgregar={async nombre => {
                await catalogosApi.createTipoMedida(nombre)
                cargarCatalogos()
              }}
              onRenombrar={async (id, nombre) => {
                await catalogosApi.updateTipoMedida(id, nombre)
                cargarCatalogos()
              }}
              onEliminar={async id => {
                await catalogosApi.deleteTipoMedida(id)
                cargarCatalogos()
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

function ImportarCSV() {
  const inputRef = useRef(null)
  const [archivo, setArchivo] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  function descargarPlantilla() {
    const filas = [
      'sku,categoria,familia,medida,material,tipo_medida,precio,costo,stock',
      'M6X20,Pijas,Hexagonal,M6x20,Gr-5,milimétrico,2.50,1.20,100',
      '1/4X1,Pijas,Hexagonal,1/4"x1",Gr-5,fraccional,1.80,0.90,200',
    ]
    const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_productos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportar() {
    if (!archivo) return
    setImportando(true)
    const form = new FormData()
    form.append('archivo', archivo)
    try {
      const res = await fetch('/api/productos/importar', { method: 'POST', body: form })
      const data = await res.json()
      setResultado(data)
    } catch {
      setResultado({ importados: 0, actualizados: 0, errores: [{ fila: 0, sku: '', error: 'Error de conexión' }] })
    } finally {
      setImportando(false)
    }
  }

  if (resultado) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{resultado.importados}</p>
            <p className="text-xs text-green-600 mt-0.5">Nuevos</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{resultado.actualizados}</p>
            <p className="text-xs text-blue-600 mt-0.5">Actualizados</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{resultado.errores.length}</p>
            <p className="text-xs text-red-600 mt-0.5">Con error</p>
          </div>
        </div>

        {resultado.errores.length > 0 && (
          <div className="border border-red-200 rounded-lg overflow-hidden">
            <p className="text-xs font-medium text-red-700 bg-red-50 px-3 py-2">Filas con error:</p>
            <div className="divide-y divide-gray-100 max-h-48 overflow-auto">
              {resultado.errores.map((e, i) => (
                <div key={i} className="flex gap-3 px-3 py-2 text-xs">
                  <span className="text-gray-400 shrink-0">Fila {e.fila}</span>
                  {e.sku && <span className="font-mono text-gray-700 shrink-0">{e.sku}</span>}
                  <span className="text-red-600">{e.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => { setResultado(null); setArchivo(null) }}
          className="w-full py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
        >
          Importar otro archivo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
        <p className="font-medium text-gray-700">Formato del archivo:</p>
        <p>Columnas requeridas: <code className="bg-white px-1 rounded border border-gray-200">sku</code>, <code className="bg-white px-1 rounded border border-gray-200">familia</code></p>
        <p>Columnas opcionales: <code className="bg-white px-1 rounded border border-gray-200">categoria</code>, <code className="bg-white px-1 rounded border border-gray-200">medida</code>, <code className="bg-white px-1 rounded border border-gray-200">material</code>, <code className="bg-white px-1 rounded border border-gray-200">tipo_medida</code>, <code className="bg-white px-1 rounded border border-gray-200">precio</code>, <code className="bg-white px-1 rounded border border-gray-200">costo</code>, <code className="bg-white px-1 rounded border border-gray-200">stock</code></p>
        <p className="text-xs text-gray-500">Si el SKU ya existe, se actualizará con la nueva información.</p>
        <p className="text-xs text-amber-600">Si hay dos familias con el mismo nombre en distintas categorías, la columna <code className="bg-white px-1 rounded border border-gray-200">categoria</code> es obligatoria para esas filas.</p>
      </div>

      <button
        onClick={descargarPlantilla}
        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
      >
        <Download size={14} /> Descargar plantilla de ejemplo
      </button>

      <div
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          archivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => setArchivo(e.target.files[0] || null)}
        />
        {archivo ? (
          <div className="flex items-center justify-center gap-2 text-green-700">
            <Upload size={18} />
            <span className="text-sm font-medium">{archivo.name}</span>
          </div>
        ) : (
          <div className="text-gray-400">
            <Upload size={24} className="mx-auto mb-2" />
            <p className="text-sm">Clic para seleccionar archivo CSV</p>
          </div>
        )}
      </div>

      <button
        onClick={handleImportar}
        disabled={!archivo || importando}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {importando ? 'Importando...' : 'Importar'}
      </button>
    </div>
  )
}
