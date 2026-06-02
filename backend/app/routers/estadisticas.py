from datetime import date, time, datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from pydantic import BaseModel
from app.database import get_db
from app import models

router = APIRouter(prefix="/estadisticas", tags=["estadisticas"])


# ── Schemas de respuesta ──────────────────────────────────────────────────────

class VentaPorDia(BaseModel):
    fecha: str
    total: float
    cantidad_ventas: int

class ProductoVendido(BaseModel):
    producto_id: int
    sku: str
    descripcion: str
    total_piezas: int
    total_monto: float

class ProductoStockCritico(BaseModel):
    id: int
    sku: str
    familia: str
    categoria: str
    medida: str | None
    material: str | None
    stock: int

class ProductoMargen(BaseModel):
    id: int
    sku: str
    familia: str
    medida: str | None
    precio: float
    costo: float
    margen: float
    margen_pct: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/ventas-por-dia", response_model=list[VentaPorDia])
def ventas_por_dia(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(
        func.date(models.Venta.fecha).label("fecha"),
        func.sum(models.Venta.total).label("total"),
        func.count(models.Venta.id).label("cantidad_ventas"),
    )
    if fecha_desde:
        query = query.filter(models.Venta.fecha >= datetime.combine(fecha_desde, time.min))
    if fecha_hasta:
        query = query.filter(models.Venta.fecha <= datetime.combine(fecha_hasta, time.max))

    rows = (
        query
        .group_by(func.date(models.Venta.fecha))
        .order_by(func.date(models.Venta.fecha))
        .all()
    )
    return [{"fecha": str(r.fecha), "total": round(r.total, 2), "cantidad_ventas": r.cantidad_ventas} for r in rows]


@router.get("/productos-mas-vendidos", response_model=list[ProductoVendido])
def productos_mas_vendidos(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    limite: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    query = db.query(
        models.VentaItem.producto_id,
        models.VentaItem.sku,
        models.VentaItem.descripcion,
        func.sum(models.VentaItem.cantidad).label("total_piezas"),
        func.sum(models.VentaItem.subtotal).label("total_monto"),
    )
    if fecha_desde or fecha_hasta:
        query = query.join(models.Venta, models.VentaItem.venta_id == models.Venta.id)
        if fecha_desde:
            query = query.filter(models.Venta.fecha >= datetime.combine(fecha_desde, time.min))
        if fecha_hasta:
            query = query.filter(models.Venta.fecha <= datetime.combine(fecha_hasta, time.max))

    rows = (
        query
        .group_by(models.VentaItem.producto_id, models.VentaItem.sku, models.VentaItem.descripcion)
        .order_by(desc("total_piezas"))
        .limit(limite)
        .all()
    )
    return [
        {
            "producto_id": r.producto_id,
            "sku": r.sku,
            "descripcion": r.descripcion,
            "total_piezas": r.total_piezas,
            "total_monto": round(r.total_monto, 2),
        }
        for r in rows
    ]


@router.get("/stock-critico", response_model=list[ProductoStockCritico])
def stock_critico(db: Session = Depends(get_db)):
    productos = (
        db.query(models.Producto)
        .options(joinedload(models.Producto.familia).joinedload(models.Familia.categoria))
        .filter(models.Producto.stock <= 0)
        .order_by(models.Producto.stock)
        .all()
    )
    return [
        {
            "id": p.id,
            "sku": p.sku,
            "familia": p.familia.nombre,
            "categoria": p.familia.categoria.nombre,
            "medida": p.medida,
            "material": p.material,
            "stock": p.stock,
        }
        for p in productos
    ]


@router.get("/margen", response_model=list[ProductoMargen])
def margen_ganancia(db: Session = Depends(get_db)):
    productos = (
        db.query(models.Producto)
        .options(joinedload(models.Producto.familia))
        .filter(models.Producto.precio.isnot(None), models.Producto.costo.isnot(None))
        .all()
    )
    result = []
    for p in productos:
        margen = p.precio - p.costo
        margen_pct = round(margen / p.costo * 100, 1) if p.costo > 0 else 0
        result.append({
            "id": p.id,
            "sku": p.sku,
            "familia": p.familia.nombre,
            "medida": p.medida,
            "precio": p.precio,
            "costo": p.costo,
            "margen": round(margen, 2),
            "margen_pct": margen_pct,
        })

    result.sort(key=lambda x: x["margen_pct"], reverse=True)
    return result
