# Systema

Sistema local de inventario, ventas, cotizaciones y facturación para la tornillería.

## Uso en la computadora del negocio

- Abrir con `iniciar.bat`. Reconoce entornos Python en `backend/.venv` o `backend/venv`.
- Para actualizar: cerrar las ventanas Backend y Frontend, ejecutar `actualizar.bat` y volver a abrir con `iniciar.bat`.
- El actualizador respalda SQLite en `backend/respaldos/`, descarga con `git pull --ff-only`, instala las dependencias del lockfile del frontend, verifica su compilación y aplica las migraciones. Se detiene ante un error.
- Los datos siempre están en `backend/systema.db`, independientemente del directorio desde el que se abra el programa. La clave de Facturapi se carga de `backend/.env`. Ambos archivos son locales y están excluidos de Git.

## Inventario y ventas

Para cancelar una nota, abrirla en **Historial** y pulsar **Cancelar nota**. Se restituyen todas las piezas una sola vez y la operación deja de contar en los totales y estadísticas. El registro se conserva como cancelado, incluida su reimpresión. Si hay una factura vigente vinculada, primero hay que cancelar el CFDI y confirmar su estado desde Facturas. Las cotizaciones convertidas conservan su vínculo aunque se cancele la venta.

En **Inventario → Por reponer** se consultan productos con existencias en cero o negativas, con búsqueda y páginas de 100 registros. Durante el conteo físico, esos valores pueden no representar faltantes reales.

El control **Bloquear ventas sin existencias suficientes** empieza desactivado. Activarlo al terminar el conteo: se aplica a ventas, facturas nuevas y conversiones de cotizaciones. La elección queda guardada en la base local y se conserva al actualizar.

Las nuevas facturas generan una venta vinculada y descuentan las piezas una sola vez. Este flujo corresponde a una venta nueva; no debe usarse para facturar otra nota ya registrada, porque representaría una segunda venta. Las facturas anteriores quedan sin vincular para evitar duplicar ventas históricas cuyo origen no está registrado.

Si falla la conexión al timbrar, usar **Reintentar confirmación**: se conservan los datos y la clave de la solicitud para evitar duplicados. No borrar los datos del navegador mientras haya una solicitud pendiente. Si las existencias cambiaron y el control bloquea la recuperación, reconciliar esa solicitud antes de comenzar otra factura para la misma operación.

Cancelar un CFDI conserva la venta y sus existencias: no registra una devolución de mercancía. Las solicitudes pendientes muestran su estado y permiten consultarlo nuevamente. El motivo 01 requiere la factura sustituta. Referencia: [cancelaciones de Facturapi](https://docs.facturapi.io/docs/guides/invoices/cancelaciones/).

Una cotización convertida conserva el folio de venta y ya no puede editarse, eliminarse ni producir otra venta. La migración reconoce conversiones antiguas por las notas que generaba el sistema; no elimina posibles duplicados previos.

Las ventas nuevas conservan el costo unitario del momento y el importe neto por concepto. Los montos por producto consideran descuentos y concilian en centavos con el total de venta. No se inventan costos históricos para ventas anteriores. La comparación de precio y costo del catálogo se identifica como información actual, no como utilidad histórica.

## Verificación

Desde `backend`: `venv\Scripts\python.exe -m unittest discover -s tests -v` (usar `.venv` si corresponde). Las pruebas usan SQLite temporal y Facturapi simulado; no timbran documentos reales.

Desde `frontend`: `npm run build`.

Full-stack application with React + Vite frontend and Python + FastAPI backend.

## Structure

```
Systema/
├── frontend/        # React + Vite
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/         # Python + FastAPI
│   ├── app/
│   │   └── routers/
│   │       └── health.py
│   ├── main.py
│   └── requirements.txt
└── .gitignore
```

## Getting started

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
python main.py
```

API running at <http://localhost:8000> — docs at <http://localhost:8000/docs>

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App running at <http://localhost:5173>
