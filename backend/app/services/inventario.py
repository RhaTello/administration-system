from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from sqlalchemy import text
from app import models


def bloquear_escritura(db):
    # Serializa comprobación y descuento, incluso entre pestañas/procesos locales.
    db.execute(text("BEGIN IMMEDIATE"))


def validar_stock(db, items):
    config = db.get(models.Configuracion, 1)
    cantidades = {}
    for producto_id, cantidad in items:
        cantidades[producto_id] = cantidades.get(producto_id, 0) + cantidad
    productos = {}
    for producto_id, cantidad in cantidades.items():
        producto = db.get(models.Producto, producto_id)
        if not producto:
            raise HTTPException(400, f"Producto ID {producto_id} no encontrado")
        if config and config.bloquear_sin_stock and producto.stock < cantidad:
            raise HTTPException(400, f"Existencias insuficientes para '{producto.sku}': disponibles {producto.stock}, solicitadas {cantidad}")
        productos[producto_id] = producto
    return productos


def asignar_netos(items, total):
    """Reparte centavos proporcionalmente; la suma coincide con el total cobrado."""
    bruto = sum(Decimal(str(i.subtotal)) for i in items)
    pendiente = Decimal(str(total)).quantize(Decimal('0.01'))
    for indice, item in enumerate(items):
        neto = pendiente if indice == len(items) - 1 else (
            (Decimal(str(item.subtotal)) / bruto * Decimal(str(total))).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            ) if bruto else Decimal('0')
        )
        neto = min(neto, pendiente)
        item.total_neto = float(neto)
        pendiente -= neto
