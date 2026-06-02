import { NEGOCIO } from '../negocio'

export default function TicketImprimible({ venta }) {
  const fecha = new Date(venta.fecha)
  const folio = String(venta.id).padStart(4, '0')
  const subtotal = venta.items.reduce((s, i) => s + i.subtotal, 0)

  return (
    <div id="ticket-print">
      <div className="ticket-header">
        <span className="ticket-nombre">{NEGOCIO.nombre}</span>
        <span>{NEGOCIO.direccion}</span>
        <span>Tel: {NEGOCIO.telefono}</span>
      </div>

      <div className="ticket-divider" />

      <div className="ticket-row">
        <span>Ticket #{folio}</span>
        <span>{fecha.toLocaleDateString('es-MX')}</span>
      </div>
      <div className="ticket-center">
        {fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>

      <div className="ticket-divider" />

      {venta.items.map((item) => (
        <div key={item.id} className="ticket-item">
          <div className="ticket-desc">{item.descripcion}</div>
          <div className="ticket-row">
            <span>{item.cantidad} × ${item.precio_unitario.toFixed(2)}</span>
            <span>${item.subtotal.toFixed(2)}</span>
          </div>
        </div>
      ))}

      <div className="ticket-divider" />

      {venta.descuento > 0 && (
        <>
          <div className="ticket-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="ticket-row">
            <span>Descuento ({venta.descuento}%)</span>
            <span>-${(subtotal * venta.descuento / 100).toFixed(2)}</span>
          </div>
        </>
      )}

      <div className="ticket-row ticket-total">
        <span>TOTAL</span>
        <span>${venta.total.toFixed(2)}</span>
      </div>

      {venta.notas && (
        <>
          <div className="ticket-divider" />
          <div className="ticket-small">{venta.notas}</div>
        </>
      )}

      <div className="ticket-divider" />
      <div className="ticket-center ticket-small">¡Gracias por su compra!</div>
    </div>
  )
}
