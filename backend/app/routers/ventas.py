from datetime import date, time, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models
from app.schemas import VentaCreate, VentaResponse
from app.services.inventario import bloquear_escritura, validar_stock, asignar_netos

router = APIRouter(prefix="/ventas", tags=["ventas"])


@router.post("/{venta_id}/cancelar", response_model=VentaResponse)
def cancelar_venta(venta_id: int, db: Session = Depends(get_db)):
    bloquear_escritura(db)
    venta = db.get(models.Venta, venta_id)
    if not venta:
        raise HTTPException(404, "Venta no encontrada")
    if venta.estado == "cancelada":
        return venta
    factura = db.query(models.Factura).filter(
        models.Factura.venta_id == venta_id, models.Factura.status != "canceled"
    ).first()
    if factura:
        raise HTTPException(400, "Esta venta tiene una factura vigente. Cancela primero la factura y confirma su estado desde Facturas")
    productos = {}
    for item in venta.items:
        producto = db.get(models.Producto, item.producto_id)
        if not producto:
            raise HTTPException(400, f"No se puede devolver inventario: el producto '{item.sku}' fue eliminado")
        productos[item.producto_id] = producto
    for item in venta.items:
        productos[item.producto_id].stock += item.cantidad
    venta.estado = "cancelada"
    venta.fecha_cancelacion = datetime.now()
    db.commit()
    db.refresh(venta)
    return venta


@router.post("/", response_model=VentaResponse, status_code=201)
def crear_venta(datos: VentaCreate, db: Session = Depends(get_db)):
    bloquear_escritura(db)
    validar_stock(db, [(i.producto_id, i.cantidad) for i in datos.items])
    items_validados = []

    for item in datos.items:
        producto = (
            db.query(models.Producto)
            .options(joinedload(models.Producto.familia).joinedload(models.Familia.categoria))
            .filter(models.Producto.id == item.producto_id)
            .first()
        )
        if not producto:
            raise HTTPException(status_code=400, detail=f"Producto ID {item.producto_id} no encontrado")
        if producto.precio is None:
            raise HTTPException(status_code=400, detail=f"El producto '{producto.sku}' no tiene precio definido")

        partes = [producto.familia.categoria.nombre, producto.familia.nombre]
        if producto.medida:
            partes.append(producto.medida)
        if producto.material:
            partes.append(producto.material)

        items_validados.append({
            "producto": producto,
            "sku": producto.sku,
            "descripcion": " ".join(partes),
            "cantidad": item.cantidad,
            "precio_unitario": producto.precio,
            "subtotal": round(producto.precio * item.cantidad, 2),
        })

    subtotal = round(sum(i["subtotal"] for i in items_validados), 2)
    monto_descuento = round(subtotal * datos.descuento / 100, 2)
    total = round(subtotal - monto_descuento, 2)

    venta = models.Venta(total=total, descuento=datos.descuento, notas=datos.notas)
    db.add(venta)
    db.flush()  # obtiene venta.id sin hacer commit aún

    detalles = []
    for item in items_validados:
        detalle = models.VentaItem(
            venta_id=venta.id,
            producto_id=item["producto"].id,
            sku=item["sku"],
            descripcion=item["descripcion"],
            cantidad=item["cantidad"],
            precio_unitario=item["precio_unitario"],
            costo_unitario=item["producto"].costo,
            subtotal=item["subtotal"],
        )
        db.add(detalle)
        detalles.append(detalle)
        item["producto"].stock -= item["cantidad"]

    asignar_netos(detalles, total)
    db.commit()
    db.refresh(venta)
    return venta


@router.get("/", response_model=list[VentaResponse])
def listar_ventas(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Venta).options(joinedload(models.Venta.items))
    if fecha_desde:
        query = query.filter(models.Venta.fecha >= datetime.combine(fecha_desde, time.min))
    if fecha_hasta:
        query = query.filter(models.Venta.fecha <= datetime.combine(fecha_hasta, time.max))
    return query.order_by(models.Venta.fecha.desc()).all()


@router.get("/{venta_id}", response_model=VentaResponse)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    venta = (
        db.query(models.Venta)
        .options(joinedload(models.Venta.items))
        .filter(models.Venta.id == venta_id)
        .first()
    )
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return venta
