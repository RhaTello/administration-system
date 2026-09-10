import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models
from app.schemas import FacturaCreate, FacturaResponse, ComplementoPagoCreate, ComplementoPagoResponse
from app.services import facturapi as fapi
from app.services.inventario import bloquear_escritura, validar_stock, asignar_netos

router = APIRouter(prefix="/facturas", tags=["facturas"])

MOTIVOS_CANCELACION = {
    "01": "Comprobante emitido con errores con relación",
    "02": "Comprobante emitido con errores sin relación",
    "03": "No se llevó a cabo la operación",
    "04": "Operación nominativa relacionada en factura global",
}


def _check_key():
    if not fapi.get_api_key():
        raise HTTPException(status_code=400, detail="FACTURAPI_API_KEY no está configurada en el .env")


def _get_factura(factura_id: int, db: Session) -> models.Factura:
    f = (
        db.query(models.Factura)
        .options(joinedload(models.Factura.pagos))
        .filter(models.Factura.id == factura_id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return f


class CancelBody(BaseModel):
    motivo: str = "02"
    sustitucion: str | None = None


@router.get("/", response_model=list[FacturaResponse])
def listar_facturas(db: Session = Depends(get_db)):
    return (
        db.query(models.Factura)
        .options(joinedload(models.Factura.pagos))
        .order_by(models.Factura.fecha.desc())
        .all()
    )


@router.post("/", response_model=FacturaResponse, status_code=201)
def crear_factura(datos: FacturaCreate, db: Session = Depends(get_db)):
    _check_key()
    bloquear_escritura(db)
    existente = db.query(models.Factura).filter_by(solicitud_id=datos.solicitud_id).first()
    if existente:
        return existente
    serializado = datos.model_dump_json()
    solicitud = db.get(models.SolicitudFactura, datos.solicitud_id)
    es_reintento = solicitud is not None
    if solicitud and solicitud.datos != serializado:
        raise HTTPException(409, "El reintento debe conservar los datos de la factura original")
    if solicitud is None:
        solicitud = models.SolicitudFactura(id=datos.solicitud_id, datos=serializado)
        db.add(solicitud)
        db.commit()
        bloquear_escritura(db)

    try:
        productos = validar_stock(db, [(i.producto_id, i.cantidad) for i in datos.items])
    except HTTPException as error:
        if es_reintento:
            raise HTTPException(409, f"Factura pendiente de confirmar. {error.detail}. Corrige las existencias y reintenta la misma solicitud") from error
        raise

    cliente = db.query(models.ClienteFiscal).filter(models.ClienteFiscal.id == datos.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=409 if es_reintento else 400, detail="Cliente no encontrado")
    if not cliente.facturapi_id:
        raise HTTPException(
            status_code=409 if es_reintento else 400,
            detail="El cliente no está sincronizado con Facturapi. Sincronízalo desde el módulo de Clientes.",
        )

    payload = {
        "idempotency_key": datos.solicitud_id,
        "customer": cliente.facturapi_id,
        "payment_form": datos.forma_pago,
        "use": datos.uso_cfdi,
        "payment_method": datos.metodo_pago,
        "items": [
            {
                "quantity": item.cantidad,
                "product": {
                    "description": item.descripcion,
                    "product_key": item.clave_prod_serv,
                    "unit_key": item.clave_unidad,
                    "unit_name": item.unidad,
                    "price": item.precio_unitario,
                    "tax_included": True,
                    "taxes": [{"type": "IVA", "rate": 0.16, "factor": "Tasa"}],
                },
            }
            for item in datos.items
        ],
    }

    try:
        with fapi.http_client() as http:
            r = http.post("/invoices", json=payload)
        if not r.is_success:
            detalle = r.json().get("message", r.text) if r.content else r.text
            estado = 502 if r.status_code >= 500 or r.status_code in (408, 409, 429) else 400
            # Un reintento incierto conserva siempre la misma solicitud.
            raise HTTPException(status_code=409 if es_reintento and estado == 400 else estado, detail=f"Facturapi: {detalle}")

        inv = r.json()
        series = inv.get("series") or ""
        numero = inv.get("folio_number") or ""
        total = float(inv.get("total", 0))
        # Facturapi puede regresar subtotal=null/0 en PPD; calcular de la misma forma que el frontend
        fapi_subtotal = float(inv.get("subtotal") or 0)
        subtotal = fapi_subtotal if fapi_subtotal > 0 else round(total / 1.16, 2)

        stamp = inv.get("stamp") or {}
        uuid = stamp.get("uuid") or inv.get("uuid")

        venta = models.Venta(total=total, descuento=0, notas=f"Factura {series}{numero} — {cliente.razon_social}")
        db.add(venta)
        db.flush()
        detalles = []
        for item in datos.items:
            producto = productos[item.producto_id]
            detalle = models.VentaItem(
                venta_id=venta.id, producto_id=producto.id, sku=producto.sku,
                descripcion=item.descripcion, cantidad=item.cantidad,
                precio_unitario=item.precio_unitario, costo_unitario=producto.costo,
                subtotal=round(item.cantidad * item.precio_unitario, 2),
            )
            db.add(detalle)
            detalles.append(detalle)
            producto.stock -= item.cantidad
        asignar_netos(detalles, total)

        factura = models.Factura(
            venta_id=venta.id,
            solicitud_id=datos.solicitud_id,
            facturapi_id=inv["id"],
            uuid=uuid,
            folio=f"{series}{numero}" if (series or numero) else None,
            fecha=datetime.now(),
            cliente_id=cliente.id,
            cliente_razon_social=cliente.razon_social,
            cliente_rfc=cliente.rfc,
            subtotal=subtotal,
            iva=round(total - subtotal, 2),
            total=total,
            uso_cfdi=datos.uso_cfdi,
            forma_pago=datos.forma_pago,
            metodo_pago=datos.metodo_pago,
            status=inv.get("status", "valid"),
        )
        db.add(factura)
        db.commit()
        db.refresh(factura)
        return factura

    except httpx.RequestError:
        db.rollback()
        raise HTTPException(status_code=502, detail="No se confirmó el timbrado. Reintenta la misma solicitud para recuperar el resultado sin duplicarla")
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="No se pudo registrar el resultado. Reintenta la misma solicitud") from e


@router.get("/{factura_id}/pdf")
def descargar_pdf(factura_id: int, db: Session = Depends(get_db)):
    _check_key()
    factura = _get_factura(factura_id, db)
    try:
        with fapi.http_client() as http:
            r = http.get(f"/invoices/{factura.facturapi_id}/pdf")
        if not r.is_success:
            raise HTTPException(status_code=400, detail=f"Facturapi: {r.text}")
        nombre = f"factura_{factura.folio or factura.id}.pdf"
        return StreamingResponse(
            iter([r.content]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")


@router.get("/{factura_id}/xml")
def descargar_xml(factura_id: int, db: Session = Depends(get_db)):
    _check_key()
    factura = _get_factura(factura_id, db)
    try:
        with fapi.http_client() as http:
            r = http.get(f"/invoices/{factura.facturapi_id}/xml")
        if not r.is_success:
            raise HTTPException(status_code=400, detail=f"Facturapi: {r.text}")
        nombre = f"factura_{factura.folio or factura.id}.xml"
        return StreamingResponse(
            iter([r.content]),
            media_type="application/xml",
            headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")


@router.post("/{factura_id}/cancelar")
def cancelar_factura(factura_id: int, body: CancelBody = CancelBody(), db: Session = Depends(get_db)):
    _check_key()
    factura = _get_factura(factura_id, db)
    if factura.status == "canceled":
        raise HTTPException(status_code=400, detail="La factura ya está cancelada")
    if body.motivo not in MOTIVOS_CANCELACION:
        raise HTTPException(status_code=400, detail=f"Motivo inválido. Use: {list(MOTIVOS_CANCELACION.keys())}")
    if body.motivo == "01" and not (body.sustitucion or "").strip():
        raise HTTPException(400, "Indica el UUID de la factura que sustituye a esta")
    parametros = {"motive": body.motivo}
    if body.motivo == "01":
        parametros["substitution"] = body.sustitucion.strip()
    try:
        with fapi.http_client() as http:
            r = http.delete(f"/invoices/{factura.facturapi_id}", params=parametros)
        if not r.is_success:
            detalle = r.json().get("message", r.text) if r.content else r.text
            raise HTTPException(status_code=400, detail=f"Facturapi: {detalle}")
        respuesta = r.json()
        factura.status = respuesta["status"]
        factura.cancellation_status = respuesta.get("cancellation_status")
        db.commit()
        return {"ok": True, "status": factura.status, "cancellation_status": factura.cancellation_status}
    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Complementos de pago ──────────────────────────────────────────────────────

@router.post("/{factura_id}/actualizar", response_model=FacturaResponse)
def actualizar_estado(factura_id: int, db: Session = Depends(get_db)):
    _check_key()
    factura = _get_factura(factura_id, db)
    try:
        with fapi.http_client() as http:
            r = http.get(f"/invoices/{factura.facturapi_id}")
        if not r.is_success:
            raise HTTPException(400, f"Facturapi: {r.text}")
        datos = r.json()
        factura.status = datos["status"]
        factura.cancellation_status = datos.get("cancellation_status")
        db.commit()
        db.refresh(factura)
        return factura
    except httpx.RequestError:
        raise HTTPException(502, "No se pudo consultar Facturapi. Intenta de nuevo")

@router.post("/{factura_id}/pagos", response_model=ComplementoPagoResponse, status_code=201)
def crear_complemento_pago(factura_id: int, datos: ComplementoPagoCreate, db: Session = Depends(get_db)):
    _check_key()
    factura = _get_factura(factura_id, db)

    if factura.status == "canceled":
        raise HTTPException(status_code=400, detail="La factura está cancelada")
    if factura.metodo_pago != "PPD":
        raise HTTPException(status_code=400, detail="Solo las facturas PPD requieren complemento de pago")
    if not factura.uuid:
        raise HTTPException(
            status_code=400,
            detail="La factura no tiene UUID registrado. Fue creada antes de la actualización; crea una nueva factura PPD.",
        )

    pagos_validos = [p for p in factura.pagos if p.status == "valid"]
    numero_parcialidad = len(pagos_validos) + 1
    saldo_anterior = round(factura.total - sum(p.monto for p in pagos_validos), 2)

    if datos.monto > saldo_anterior + 0.01:
        raise HTTPException(status_code=400, detail=f"El monto excede el saldo pendiente (${saldo_anterior:.2f})")

    saldo_insoluto = round(saldo_anterior - datos.monto, 2)

    cliente = db.query(models.ClienteFiscal).filter(models.ClienteFiscal.id == factura.cliente_id).first()
    if not cliente or not cliente.facturapi_id:
        raise HTTPException(status_code=400, detail="Cliente no encontrado o no sincronizado con Facturapi")

    fecha_str = datos.fecha_pago.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    base_pago = round(datos.monto / 1.16, 6)

    payload = {
        "customer": cliente.facturapi_id,
        "type": "P",
        "complements": [{
            "type": "pago",
            "data": [{
                "payment_form": datos.forma_pago,
                "date": fecha_str,
                "currency": "MXN",
                "related_documents": [{
                    "uuid": factura.uuid,
                    "amount": datos.monto,
                    "installment": numero_parcialidad,
                    "last_balance": saldo_anterior,
                    "currency": "MXN",
                    "taxes": [{
                        "base": base_pago,
                        "type": "IVA",
                        "rate": 0.16,
                        "factor": "Tasa",
                    }],
                }],
            }],
        }],
    }

    try:
        with fapi.http_client() as http:
            r = http.post("/invoices", json=payload)
        if not r.is_success:
            detalle = r.json().get("message", r.text) if r.content else r.text
            raise HTTPException(status_code=400, detail=f"Facturapi: {detalle}")

        inv = r.json()
        series = inv.get("series") or ""
        numero = inv.get("folio_number") or ""

        complemento = models.ComplementoPago(
            facturapi_id=inv["id"],
            folio=f"{series}{numero}" if (series or numero) else None,
            fecha=datetime.now(),
            fecha_pago=datos.fecha_pago,
            factura_id=factura_id,
            cliente_razon_social=factura.cliente_razon_social,
            monto=datos.monto,
            forma_pago=datos.forma_pago,
            numero_parcialidad=numero_parcialidad,
            saldo_anterior=saldo_anterior,
            saldo_insoluto=saldo_insoluto,
        )
        db.add(complemento)
        db.commit()
        db.refresh(complemento)
        return complemento

    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pagos/{pago_id}/pdf")
def descargar_pdf_complemento(pago_id: int, db: Session = Depends(get_db)):
    _check_key()
    pago = db.query(models.ComplementoPago).filter(models.ComplementoPago.id == pago_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Complemento de pago no encontrado")
    try:
        with fapi.http_client() as http:
            r = http.get(f"/invoices/{pago.facturapi_id}/pdf")
        if not r.is_success:
            raise HTTPException(status_code=400, detail=f"Facturapi: {r.text}")
        nombre = f"complemento_{pago.folio or pago.id}.pdf"
        return StreamingResponse(
            iter([r.content]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")


@router.get("/pagos/{pago_id}/xml")
def descargar_xml_complemento(pago_id: int, db: Session = Depends(get_db)):
    _check_key()
    pago = db.query(models.ComplementoPago).filter(models.ComplementoPago.id == pago_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Complemento de pago no encontrado")
    try:
        with fapi.http_client() as http:
            r = http.get(f"/invoices/{pago.facturapi_id}/xml")
        if not r.is_success:
            raise HTTPException(status_code=400, detail=f"Facturapi: {r.text}")
        nombre = f"complemento_{pago.folio or pago.id}.xml"
        return StreamingResponse(
            iter([r.content]),
            media_type="application/xml",
            headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")
