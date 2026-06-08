import csv
import io
import unicodedata
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from app.database import get_db
from app import models
from app.schemas import ProductoCreate, ProductoUpdate, ProductoResponse


def _normalizar(s: str) -> str:
    """Quita acentos y pasa a minúsculas para comparación flexible."""
    return ''.join(
        c for c in unicodedata.normalize('NFD', s.lower())
        if unicodedata.category(c) != 'Mn'
    )

router = APIRouter(prefix="/productos", tags=["productos"])


def _query_con_relaciones(db: Session):
    return db.query(models.Producto).options(
        joinedload(models.Producto.familia).joinedload(models.Familia.categoria)
    )


@router.get("/", response_model=list[ProductoResponse])
def listar_productos(
    sku: Optional[str] = Query(None),
    familia_id: Optional[int] = Query(None),
    categoria_id: Optional[int] = Query(None),
    material: Optional[str] = Query(None),
    medida: Optional[str] = Query(None),
    tipo_medida: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = _query_con_relaciones(db)

    if sku:
        query = query.filter(models.Producto.sku.ilike(f"%{sku}%"))
    if familia_id:
        query = query.filter(models.Producto.familia_id == familia_id)
    if categoria_id:
        query = query.join(models.Familia).filter(models.Familia.categoria_id == categoria_id)
    if material:
        query = query.filter(models.Producto.material.ilike(f"%{material}%"))
    if medida:
        query = query.filter(models.Producto.medida.ilike(f"%{medida}%"))
    if tipo_medida:
        query = query.filter(models.Producto.tipo_medida == tipo_medida)

    return query.all()


@router.get("/{producto_id}", response_model=ProductoResponse)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = _query_con_relaciones(db).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@router.post("/", response_model=ProductoResponse, status_code=201)
def crear_producto(datos: ProductoCreate, db: Session = Depends(get_db)):
    if db.query(models.Producto).filter(models.Producto.sku == datos.sku).first():
        raise HTTPException(status_code=400, detail=f"Ya existe un producto con SKU '{datos.sku}'")

    if not db.query(models.Familia).filter(models.Familia.id == datos.familia_id).first():
        raise HTTPException(status_code=400, detail="Familia no encontrada")

    producto = models.Producto(**datos.model_dump())
    db.add(producto)
    db.commit()
    db.refresh(producto)

    return _query_con_relaciones(db).filter(models.Producto.id == producto.id).first()


@router.put("/{producto_id}", response_model=ProductoResponse)
def actualizar_producto(producto_id: int, datos: ProductoUpdate, db: Session = Depends(get_db)):
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    cambios = datos.model_dump(exclude_unset=True)

    if "sku" in cambios:
        duplicado = db.query(models.Producto).filter(
            models.Producto.sku == cambios["sku"],
            models.Producto.id != producto_id,
        ).first()
        if duplicado:
            raise HTTPException(status_code=400, detail=f"Ya existe un producto con SKU '{cambios['sku']}'")

    if "familia_id" in cambios:
        if not db.query(models.Familia).filter(models.Familia.id == cambios["familia_id"]).first():
            raise HTTPException(status_code=400, detail="Familia no encontrada")

    for campo, valor in cambios.items():
        setattr(producto, campo, valor)

    db.commit()

    return _query_con_relaciones(db).filter(models.Producto.id == producto_id).first()


@router.delete("/{producto_id}", status_code=204)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    db.delete(producto)
    db.commit()


@router.post("/importar")
async def importar_productos(archivo: UploadFile = File(...), db: Session = Depends(get_db)):
    if not archivo.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser .csv")

    contenido = await archivo.read()
    texto = contenido.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(texto))

    if not reader.fieldnames or not {"sku", "familia"}.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=400, detail="El CSV debe tener al menos las columnas: sku, familia")

    # Caches para no hacer queries por fila
    # familias_unicas: nombre → familia (solo si no hay duplicados con ese nombre)
    # familias_duplicadas: nombres que aparecen en más de una categoría
    todas_familias = db.query(models.Familia).options(joinedload(models.Familia.categoria)).all()
    familias_por_nombre: dict[str, list] = {}
    for f in todas_familias:
        familias_por_nombre.setdefault(f.nombre.lower(), []).append(f)

    # Mapeo normalizado → nombre canónico en DB
    tipos_medida_map = {_normalizar(t.nombre): t.nombre for t in db.query(models.TipoMedida).all()}
    materiales_map = {_normalizar(m.nombre): m.nombre for m in db.query(models.Material).all()}

    importados = 0
    actualizados = 0
    errores = []

    for i, fila in enumerate(reader, start=2):
        sku = fila.get("sku", "").strip()
        familia_nombre = fila.get("familia", "").strip()

        if not sku:
            errores.append({"fila": i, "sku": "", "error": "SKU vacío"})
            continue
        if not familia_nombre:
            errores.append({"fila": i, "sku": sku, "error": "Familia vacía"})
            continue

        categoria_nombre = fila.get("categoria", "").strip() if "categoria" in (reader.fieldnames or []) else ""
        candidatas = familias_por_nombre.get(familia_nombre.lower(), [])

        if not candidatas:
            errores.append({"fila": i, "sku": sku, "error": f"Familia '{familia_nombre}' no encontrada"})
            continue

        if len(candidatas) > 1:
            if not categoria_nombre:
                nombres_cat = ", ".join(f.categoria.nombre for f in candidatas)
                errores.append({"fila": i, "sku": sku, "error": f"Familia '{familia_nombre}' existe en varias categorías ({nombres_cat}). Agrega la columna 'categoria' al CSV."})
                continue
            matches = [f for f in candidatas if f.categoria.nombre.lower() == categoria_nombre.lower()]
            if not matches:
                errores.append({"fila": i, "sku": sku, "error": f"Familia '{familia_nombre}' no encontrada en categoría '{categoria_nombre}'"})
                continue
            familia = matches[0]
        else:
            familia = candidatas[0]
            # Si se proporcionó categoría, validar que coincida
            if categoria_nombre and familia.categoria.nombre.lower() != categoria_nombre.lower():
                errores.append({"fila": i, "sku": sku, "error": f"Familia '{familia_nombre}' no pertenece a la categoría '{categoria_nombre}'"})
                continue

        # Resolución flexible de tipo_medida (acepta variaciones de mayúsculas/acentos)
        tipo_medida_raw = fila.get("tipo_medida", "").strip()
        tipo_medida_val = None
        if tipo_medida_raw:
            tipo_medida_val = tipos_medida_map.get(_normalizar(tipo_medida_raw))
            if tipo_medida_val is None:
                errores.append({"fila": i, "sku": sku, "error": f"tipo_medida desconocido: '{tipo_medida_raw}'"})
                continue

        # Resolución flexible de material
        material_raw = fila.get("material", "").strip()
        material_val = None
        if material_raw:
            material_val = materiales_map.get(_normalizar(material_raw))
            if material_val is None:
                errores.append({"fila": i, "sku": sku, "error": f"material desconocido: '{material_raw}'"})
                continue

        try:
            precio_str = fila.get("precio", "").strip()
            costo_str = fila.get("costo", "").strip()
            stock_str = fila.get("stock", "").strip()

            precio = float(precio_str) if precio_str else None
            costo = float(costo_str) if costo_str else None
            stock = int(stock_str) if stock_str else 0
            medida = fila.get("medida", "").strip() or None

            existente = db.query(models.Producto).filter(models.Producto.sku == sku).first()
            if existente:
                existente.familia_id = familia.id
                existente.medida = medida
                existente.material = material_val
                existente.tipo_medida = tipo_medida_val
                existente.precio = precio
                existente.costo = costo
                existente.stock = stock
                actualizados += 1
            else:
                db.add(models.Producto(
                    sku=sku,
                    familia_id=familia.id,
                    medida=medida,
                    material=material_val,
                    tipo_medida=tipo_medida_val,
                    precio=precio,
                    costo=costo,
                    stock=stock,
                ))
                importados += 1
        except ValueError as e:
            errores.append({"fila": i, "sku": sku, "error": f"Valor inválido: {e}"})

    if importados > 0 or actualizados > 0:
        db.commit()

    return {"importados": importados, "actualizados": actualizados, "errores": errores}
