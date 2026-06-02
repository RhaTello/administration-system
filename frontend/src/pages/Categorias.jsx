import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import * as api from '../api/categorias'

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'

function CategoriaForm({ inicial, categorias, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    nombre: inicial?.nombre ?? '',
    padre_id: inicial?.padre_id ?? '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await onGuardar({
        nombre: form.nombre,
        padre_id: form.padre_id !== '' ? Number(form.padre_id) : null,
      })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  const opciones = categorias.filter(c => c.id !== inicial?.id)

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
        <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría padre</label>
        <select value={form.padre_id} onChange={e => setForm(f => ({ ...f, padre_id: e.target.value }))} className={inputClass}>
          <option value="">— Sin padre (categoría raíz) —</option>
          {opciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
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

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [modal, setModal] = useState({ abierto: false, categoria: null })
  const [error, setError] = useState(null)

  async function cargar() {
    const data = await api.getCategorias()
    setCategorias(data)
  }

  useEffect(() => { cargar() }, [])

  function cerrarModal() { setModal({ abierto: false, categoria: null }) }

  async function handleGuardar(datos) {
    if (modal.categoria) {
      await api.updateCategoria(modal.categoria.id, datos)
    } else {
      await api.createCategoria(datos)
    }
    cerrarModal()
    await cargar()
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta categoría?')) return
    try {
      await api.deleteCategoria(id)
      setCategorias(c => c.filter(x => x.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  const padreMap = Object.fromEntries(categorias.map(c => [c.id, c.nombre]))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-800">Categorías</h1>
        <button onClick={() => setModal({ abierto: true, categoria: null })}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          <Plus size={15} /> Nueva categoría
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nombre', 'Categoría padre', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categorias.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-10 text-gray-400">Sin categorías aún</td></tr>
            ) : categorias.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{c.padre_id ? padreMap[c.padre_id] : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ abierto: true, categoria: c })}
                      className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleEliminar(c.id)}
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
          titulo={modal.categoria ? `Editar: ${modal.categoria.nombre}` : 'Nueva categoría'}
          onCerrar={cerrarModal}
        >
          <CategoriaForm
            inicial={modal.categoria}
            categorias={categorias}
            onGuardar={handleGuardar}
            onCancelar={cerrarModal}
          />
        </Modal>
      )}
    </div>
  )
}
