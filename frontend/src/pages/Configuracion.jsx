import { useState, useEffect } from 'react'
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import * as api from '../api/configuracion'

const inputClass = 'border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function Configuracion() {
  const [apiKey, setApiKey] = useState('')
  const [modo, setModo] = useState('sandbox')
  const [preview, setPreview] = useState('')
  const [mostrarKey, setMostrarKey] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [estadoConexion, setEstadoConexion] = useState(null) // null | 'ok' | 'error'
  const [mensajeConexion, setMensajeConexion] = useState('')
  const [guardadoOk, setGuardadoOk] = useState(false)

  useEffect(() => {
    api.getConfiguracion().then(data => {
      setModo(data.facturapi_modo || 'sandbox')
      setPreview(data.facturapi_api_key_preview || '')
    }).catch(() => {})
  }, [])

  async function handleGuardar(e) {
    e.preventDefault()
    setGuardando(true)
    setGuardadoOk(false)
    try {
      const datos = { facturapi_modo: modo }
      if (apiKey.trim()) datos.facturapi_api_key = apiKey.trim()
      await api.guardarConfiguracion(datos)
      if (apiKey.trim()) {
        const masked = `${'*'.repeat(Math.max(0, apiKey.length - 4))}${apiKey.slice(-4)}`
        setPreview(masked)
        setApiKey('')
      }
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 3000)
    } catch (err) {
      alert(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleProbar() {
    setProbando(true)
    setEstadoConexion(null)
    try {
      const res = await api.probarConexion()
      setEstadoConexion('ok')
      setMensajeConexion(`Conexión exitosa en modo ${res.modo}`)
    } catch (err) {
      setEstadoConexion('error')
      setMensajeConexion(err.message)
    } finally {
      setProbando(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-6">
      <h1 className="text-xl font-semibold text-gray-800 mb-1">Configuración</h1>
      <p className="text-sm text-gray-400 mb-8">Integración con Facturapi para timbrado de CFDIs</p>

      <form onSubmit={handleGuardar} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div>
          <label className={labelClass}>Modo de operación</label>
          <div className="flex gap-3">
            <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${modo === 'sandbox' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="modo" value="sandbox" checked={modo === 'sandbox'}
                onChange={() => setModo('sandbox')} className="sr-only" />
              <p className="text-sm font-medium text-gray-800">Sandbox</p>
              <p className="text-xs text-gray-400 mt-0.5">Pruebas sin validez fiscal</p>
            </label>
            <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${modo === 'produccion' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="modo" value="produccion" checked={modo === 'produccion'}
                onChange={() => setModo('produccion')} className="sr-only" />
              <p className="text-sm font-medium text-gray-800">Producción</p>
              <p className="text-xs text-gray-400 mt-0.5">Timbrado real ante el SAT</p>
            </label>
          </div>
          {modo === 'produccion' && (
            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle size={12} /> En producción las facturas generan costos y tienen validez fiscal real.
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>API Key de Facturapi</label>
          {preview && (
            <p className="text-xs text-gray-400 mb-1">
              Key actual: <span className="font-mono">{preview}</span>
            </p>
          )}
          <div className="relative">
            <input
              type={mostrarKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={preview ? 'Escribe una nueva key para reemplazar' : 'sk_live_... o sk_test_...'}
              className={inputClass}
            />
            <button type="button" onClick={() => setMostrarKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {mostrarKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Encuéntrala en{' '}
            <span className="font-mono text-gray-500">facturapi.io → Organización → API Keys</span>
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={handleProbar} disabled={probando}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
            {probando ? <Loader size={13} className="animate-spin" /> : null}
            Probar conexión
          </button>

          <button type="submit" disabled={guardando}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
            {guardando ? <Loader size={13} className="animate-spin" /> : null}
            {guardadoOk ? '¡Guardado!' : 'Guardar'}
          </button>
        </div>

        {estadoConexion && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${estadoConexion === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {estadoConexion === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {mensajeConexion}
          </div>
        )}
      </form>

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-600">¿Cómo obtener la API Key?</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Crea una cuenta en <span className="font-mono">facturapi.io</span></li>
          <li>Ve a <span className="font-mono">Organización → API Keys</span></li>
          <li>Copia la key de <strong>Sandbox</strong> para pruebas o <strong>Live</strong> para producción</li>
          <li>Pega la key aquí y guarda</li>
        </ol>
      </div>
    </div>
  )
}
