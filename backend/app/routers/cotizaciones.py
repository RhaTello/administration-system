from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import models
from app.schemas import CotizacionCreate, CotizacionResponse, VentaResponse

router = APIRouter(prefix="/cotizaciones", tags=["cotizaciones"])


def _con_items(db: Session, cotizacion_id: int):
    return (
        db.query(models.Cotizacion)
        .options(joinedload(models.Cotizacion.items))
        .filter(models.Cotizacion.id == cotizacion_id)
        .first()
    )


def _calcular_y_crear_items(cotizacion_id: int, items_data, db: Session):
    items_validados = []
    for item in items_data:
        producto = (
            db.query(models.Producto)
            .options(joinedload(models.Producto.familia).joinedload(models.Familia.categoria))
            .filter(models.Producto.id == item.producto_id)
            .first()
        )
        if not producto:
            raise HTTPException(status_code=400, detail=f"Producto ID {item.producto_id} no encontrado")

        partes = [producto.familia.categoria.nombre, producto.familia.nombre]
        if producto.medida:
            partes.append(producto.medida)
        if producto.material:
            partes.append(producto.material)

        items_validados.append(models.CotizacionItem(
            cotizacion_id=cotizacion_id,
            producto_id=producto.id,
            sku=producto.sku,
            descripcion=" ".join(partes),
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            subtotal=round(item.precio_unitario * item.cantidad, 2),
        ))
    return items_validados


@router.get("/", response_model=list[CotizacionResponse])
def listar_cotizaciones(db: Session = Depends(get_db)):
    return (
        db.query(models.Cotizacion)
        .options(joinedload(models.Cotizacion.items))
        .order_by(models.Cotizacion.fecha.desc())
        .all()
    )


@router.get("/{cotizacion_id}", response_model=CotizacionResponse)
def obtener_cotizacion(cotizacion_id: int, db: Session = Depends(get_db)):
    c = _con_items(db, cotizacion_id)
    if not c:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return c


@router.post("/", response_model=CotizacionResponse, status_code=201)
def crear_cotizacion(datos: CotizacionCreate, db: Session = Depends(get_db)):
    subtotal_bruto = round(sum(i.precio_unitario * i.cantidad for i in datos.items), 2)
    total = round(subtotal_bruto * (1 - datos.descuento / 100), 2)

    cotizacion = models.Cotizacion(
        cliente=datos.cliente.strip(),
        descuento=datos.descuento,
        total=total,
        notas=datos.notas,
    )
    db.add(cotizacion)
    db.flush()

    for item in _calcular_y_crear_items(cotizacion.id, datos.items, db):
        db.add(item)

    db.commit()
    return _con_items(db, cotizacion.id)


@router.put("/{cotizacion_id}", response_model=CotizacionResponse)
def actualizar_cotizacion(cotizacion_id: int, datos: CotizacionCreate, db: Session = Depends(get_db)):
    cotizacion = db.query(models.Cotizacion).filter(models.Cotizacion.id == cotizacion_id).first()
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    subtotal_bruto = round(sum(i.precio_unitario * i.cantidad for i in datos.items), 2)
    total = round(subtotal_bruto * (1 - datos.descuento / 100), 2)

    cotizacion.cliente = datos.cliente.strip()
    cotizacion.descuento = datos.descuento
    cotizacion.total = total
    cotizacion.notas = datos.notas

    db.query(models.CotizacionItem).filter(
        models.CotizacionItem.cotizacion_id == cotizacion_id
    ).delete()

    for item in _calcular_y_crear_items(cotizacion_id, datos.items, db):
        db.add(item)

    db.commit()
    return _con_items(db, cotizacion_id)


@router.delete("/{cotizacion_id}", status_code=204)
def eliminar_cotizacion(cotizacion_id: int, db: Session = Depends(get_db)):
    cotizacion = db.query(models.Cotizacion).filter(models.Cotizacion.id == cotizacion_id).first()
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    db.delete(cotizacion)
    db.commit()


@router.post("/{cotizacion_id}/convertir", response_model=VentaResponse)
def convertir_a_venta(cotizacion_id: int, db: Session = Depends(get_db)):
    cotizacion = _con_items(db, cotizacion_id)
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    if not cotizacion.items:
        raise HTTPException(status_code=400, detail="La cotización no tiene productos")

    for item in cotizacion.items:
        if not db.query(models.Producto).filter(models.Producto.id == item.producto_id).first():
            raise HTTPException(status_code=400, detail=f"El producto '{item.sku}' ya no existe en inventario")

    notas_venta = f"De cotización #{str(cotizacion_id).zfill(4)} — {cotizacion.cliente}"
    if cotizacion.notas:
        notas_venta += f". {cotizacion.notas}"

    venta = models.Venta(
        total=cotizacion.total,
        descuento=cotizacion.descuento,
        notas=notas_venta,
    )
    db.add(venta)
    db.flush()

    for item in cotizacion.items:
        producto = db.query(models.Producto).filter(models.Producto.id == item.producto_id).first()
        db.add(models.VentaItem(
            venta_id=venta.id,
            producto_id=item.producto_id,
            sku=item.sku,
            descripcion=item.descripcion,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            subtotal=item.subtotal,
        ))
        producto.stock -= item.cantidad

    db.commit()

    return (
        db.query(models.Venta)
        .options(joinedload(models.Venta.items))
        .filter(models.Venta.id == venta.id)
        .first()
    )
