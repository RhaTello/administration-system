from datetime import date, time, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models
from app.schemas import VentaCreate, VentaResponse

router = APIRouter(prefix="/ventas", tags=["ventas"])


@router.post("/", response_model=VentaResponse, status_code=201)
def crear_venta(datos: VentaCreate, db: Session = Depends(get_db)):
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

    for item in items_validados:
        db.add(models.VentaItem(
            venta_id=venta.id,
            producto_id=item["producto"].id,
            sku=item["sku"],
            descripcion=item["descripcion"],
            cantidad=item["cantidad"],
            precio_unitario=item["precio_unitario"],
            subtotal=item["subtotal"],
        ))
        item["producto"].stock -= item["cantidad"]

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
