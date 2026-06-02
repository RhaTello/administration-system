import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import * as api from '../api/familias'
import { getCategorias } from '../api/categorias'

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'

function FamiliaForm({ inicial, categorias, onGuardar, onCancelar }) {
  const [form, setForm] = useState({
    nombre: inicial?.nombre ?? '',
    categoria_id: inicial?.categoria?.id ?? '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await onGuardar({ nombre: form.nombre, categoria_id: Number(form.categoria_id) })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
        <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
        <select required value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))} className={inputClass}>
          <option value="">— Seleccionar —</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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

export default function Familias() {
  const [familias, setFamilias] = useState([])
  const [categorias, setCategorias] = useState([])
  const [modal, setModal] = useState({ abierto: false, familia: null })
  const [error, setError] = useState(null)

  async function cargar() {
    const [fams, cats] = await Promise.all([api.getFamilias(), getCategorias()])
    setFamilias(fams)
    setCategorias(cats)
  }

  useEffect(() => { cargar() }, [])

  function cerrarModal() { setModal({ abierto: false, familia: null }) }

  async function handleGuardar(datos) {
    if (modal.familia) {
      await api.updateFamilia(modal.familia.id, datos)
    } else {
      await api.createFamilia(datos)
    }
    cerrarModal()
    await cargar()
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar esta familia?')) return
    try {
      await api.deleteFamilia(id)
      setFamilias(f => f.filter(x => x.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-800">Familias</h1>
        <button onClick={() => setModal({ abierto: true, familia: null })}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          <Plus size={15} /> Nueva familia
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded mb-4">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nombre', 'Categoría', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {familias.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-10 text-gray-400">Sin familias aún</td></tr>
            ) : familias.map(f => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{f.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{f.categoria.nombre}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ abierto: true, familia: f })}
                      className="text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleEliminar(f.id)}
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
          titulo={modal.familia ? `Editar: ${modal.familia.nombre}` : 'Nueva familia'}
          onCerrar={cerrarModal}
        >
          <FamiliaForm
            inicial={modal.familia}
            categorias={categorias}
            onGuardar={handleGuardar}
            onCancelar={cerrarModal}
          />
        </Modal>
      )}
    </div>
  )
}
