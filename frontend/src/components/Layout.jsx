import { NavLink, Outlet } from 'react-router-dom'

const linkClass = ({ isActive }) =>
  `block px-3 py-2 rounded text-sm ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-52 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-200">
          <h1 className="font-bold text-gray-900">Systema</h1>
          <p className="text-xs text-gray-400 mt-0.5">Administración</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="text-xs font-semibold text-gray-400 uppercase px-3 pt-2 pb-1">Ventas</p>
          <NavLink to="/ventas" className={linkClass}>Nueva venta</NavLink>
          <NavLink to="/cotizaciones" className={linkClass}>Cotizaciones</NavLink>
          <NavLink to="/historial" className={linkClass}>Historial</NavLink>
          <NavLink to="/estadisticas" className={linkClass}>Estadísticas</NavLink>
          <p className="text-xs font-semibold text-gray-400 uppercase px-3 pt-3 pb-1">Facturación</p>
          <NavLink to="/clientes-fiscales" className={linkClass}>Clientes</NavLink>
          <NavLink to="/facturas" className={linkClass}>Facturas</NavLink>
          <p className="text-xs font-semibold text-gray-400 uppercase px-3 pt-3 pb-1">Inventario</p>
          <NavLink to="/productos" className={linkClass}>Productos</NavLink>
          <NavLink to="/categorias" className={linkClass}>Categorías</NavLink>
          <NavLink to="/familias" className={linkClass}>Familias</NavLink>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
