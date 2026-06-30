import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas import FacturaCreate, FacturaResponse
from app.services import facturapi as fapi

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


class CancelBody(BaseModel):
    motivo: str = "02"


@router.get("/", response_model=list[FacturaResponse])
def listar_facturas(db: Session = Depends(get_db)):
    return db.query(models.Factura).order_by(models.Factura.fecha.desc()).all()


@router.post("/", response_model=FacturaResponse, status_code=201)
def crear_factura(datos: FacturaCreate, db: Session = Depends(get_db)):
    _check_key()

    cliente = db.query(models.ClienteFiscal).filter(models.ClienteFiscal.id == datos.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if not cliente.facturapi_id:
        raise HTTPException(
            status_code=400,
            detail="El cliente no está sincronizado con Facturapi. Sincronízalo desde el módulo de Clientes.",
        )

    payload = {
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
            raise HTTPException(status_code=400, detail=f"Facturapi: {detalle}")

        inv = r.json()
        series = inv.get("series") or ""
        numero = inv.get("folio_number") or ""
        subtotal = float(inv.get("subtotal", 0))
        total = float(inv.get("total", 0))

        factura = models.Factura(
            facturapi_id=inv["id"],
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

    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{factura_id}/pdf")
def descargar_pdf(factura_id: int, db: Session = Depends(get_db)):
    _check_key()
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
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
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
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
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.status == "canceled":
        raise HTTPException(status_code=400, detail="La factura ya está cancelada")
    if body.motivo not in MOTIVOS_CANCELACION:
        raise HTTPException(status_code=400, detail=f"Motivo inválido. Use: {list(MOTIVOS_CANCELACION.keys())}")
    try:
        with fapi.http_client() as http:
            r = http.delete(f"/invoices/{factura.facturapi_id}", json={"motive": body.motivo})
        if not r.is_success:
            detalle = r.json().get("message", r.text) if r.content else r.text
            raise HTTPException(status_code=400, detail=f"Facturapi: {detalle}")
        factura.status = "canceled"
        db.commit()
        return {"ok": True}
    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
