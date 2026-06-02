from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from app.database import get_db
from app import models
from app.schemas import FamiliaCreate, FamiliaUpdate, FamiliaResponse

router = APIRouter(prefix="/familias", tags=["familias"])


def _query_con_categoria(db: Session):
    return db.query(models.Familia).options(joinedload(models.Familia.categoria))


@router.get("/", response_model=list[FamiliaResponse])
def listar_familias(
    categoria_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = _query_con_categoria(db)
    if categoria_id:
        query = query.filter(models.Familia.categoria_id == categoria_id)
    return query.order_by(models.Familia.nombre).all()


@router.get("/{familia_id}", response_model=FamiliaResponse)
def obtener_familia(familia_id: int, db: Session = Depends(get_db)):
    familia = _query_con_categoria(db).filter(models.Familia.id == familia_id).first()
    if not familia:
        raise HTTPException(status_code=404, detail="Familia no encontrada")
    return familia


@router.post("/", response_model=FamiliaResponse, status_code=201)
def crear_familia(datos: FamiliaCreate, db: Session = Depends(get_db)):
    if not db.query(models.Categoria).filter(models.Categoria.id == datos.categoria_id).first():
        raise HTTPException(status_code=400, detail="Categoría no encontrada")

    familia = models.Familia(**datos.model_dump())
    db.add(familia)
    db.commit()
    db.refresh(familia)

    return _query_con_categoria(db).filter(models.Familia.id == familia.id).first()


@router.put("/{familia_id}", response_model=FamiliaResponse)
def actualizar_familia(familia_id: int, datos: FamiliaUpdate, db: Session = Depends(get_db)):
    familia = db.query(models.Familia).filter(models.Familia.id == familia_id).first()
    if not familia:
        raise HTTPException(status_code=404, detail="Familia no encontrada")

    cambios = datos.model_dump(exclude_unset=True)

    if "categoria_id" in cambios:
        if not db.query(models.Categoria).filter(models.Categoria.id == cambios["categoria_id"]).first():
            raise HTTPException(status_code=400, detail="Categoría no encontrada")

    for campo, valor in cambios.items():
        setattr(familia, campo, valor)

    db.commit()

    return _query_con_categoria(db).filter(models.Familia.id == familia_id).first()


@router.delete("/{familia_id}", status_code=204)
def eliminar_familia(familia_id: int, db: Session = Depends(get_db)):
    familia = db.query(models.Familia).filter(models.Familia.id == familia_id).first()
    if not familia:
        raise HTTPException(status_code=404, detail="Familia no encontrada")

    tiene_productos = db.query(models.Producto).filter(
        models.Producto.familia_id == familia_id
    ).first()
    if tiene_productos:
        raise HTTPException(status_code=400, detail="No se puede eliminar: tiene productos asociados")

    db.delete(familia)
    db.commit()
