import csv
import io
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from app.database import get_db
from app import models
from app.schemas import ProductoCreate, ProductoUpdate, ProductoResponse

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


COLUMNAS_CSV = {"sku", "familia", "medida", "material", "tipo_medida", "precio", "costo", "stock"}
TIPOS_MEDIDA_VALIDOS = {"fraccional", "milimétrico"}


@router.post("/importar")
async def importar_productos(archivo: UploadFile = File(...), db: Session = Depends(get_db)):
    if not archivo.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser .csv")

    contenido = await archivo.read()
    # utf-8-sig maneja el BOM que agrega Excel al guardar como CSV
    texto = contenido.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(texto))

    if not reader.fieldnames or not {"sku", "familia"}.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=400, detail="El CSV debe tener al menos las columnas: sku, familia")

    # Cache de familias para no hacer una query por fila
    familias = {f.nombre.lower(): f for f in db.query(models.Familia).all()}

    importados = 0
    omitidos = 0
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

        # SKU duplicado: omitir silenciosamente
        if db.query(models.Producto).filter(models.Producto.sku == sku).first():
            omitidos += 1
            continue

        familia = familias.get(familia_nombre.lower())
        if not familia:
            errores.append({"fila": i, "sku": sku, "error": f"Familia '{familia_nombre}' no encontrada"})
            continue

        tipo_medida_val = fila.get("tipo_medida", "").strip() or None
        if tipo_medida_val and tipo_medida_val not in TIPOS_MEDIDA_VALIDOS:
            errores.append({"fila": i, "sku": sku, "error": f"tipo_medida inválido: '{tipo_medida_val}'"})
            continue

        try:
            precio_str = fila.get("precio", "").strip()
            costo_str = fila.get("costo", "").strip()
            stock_str = fila.get("stock", "").strip()

            db.add(models.Producto(
                sku=sku,
                familia_id=familia.id,
                medida=fila.get("medida", "").strip() or None,
                material=fila.get("material", "").strip() or None,
                tipo_medida=tipo_medida_val,
                precio=float(precio_str) if precio_str else None,
                costo=float(costo_str) if costo_str else None,
                stock=int(stock_str) if stock_str else 0,
            ))
            importados += 1
        except ValueError as e:
            errores.append({"fila": i, "sku": sku, "error": f"Valor inválido: {e}"})

    if importados > 0:
        db.commit()

    return {"importados": importados, "omitidos": omitidos, "errores": errores}
