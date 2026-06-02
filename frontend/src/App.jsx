import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Ventas from './pages/Ventas'
import Historial from './pages/Historial'
import Estadisticas from './pages/Estadisticas'
import Productos from './pages/Productos'
import Categorias from './pages/Categorias'
import Familias from './pages/Familias'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/ventas" replace />} />
          <Route path="ventas" element={<Ventas />} />
          <Route path="historial" element={<Historial />} />
          <Route path="estadisticas" element={<Estadisticas />} />
          <Route path="productos" element={<Productos />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="familias" element={<Familias />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
