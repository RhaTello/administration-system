from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app import models
from app.schemas import CategoriaCreate, CategoriaUpdate, CategoriaResponse

router = APIRouter(prefix="/categorias", tags=["categorias"])


@router.get("/", response_model=list[CategoriaResponse])
def listar_categorias(
    solo_raiz: bool = Query(False, description="Si es true, devuelve solo categorías sin padre"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Categoria)
    if solo_raiz:
        query = query.filter(models.Categoria.padre_id == None)
    return query.order_by(models.Categoria.nombre).all()


@router.get("/{categoria_id}", response_model=CategoriaResponse)
def obtener_categoria(categoria_id: int, db: Session = Depends(get_db)):
    categoria = db.query(models.Categoria).filter(models.Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return categoria


@router.post("/", response_model=CategoriaResponse, status_code=201)
def crear_categoria(datos: CategoriaCreate, db: Session = Depends(get_db)):
    if datos.padre_id is not None:
        padre = db.query(models.Categoria).filter(models.Categoria.id == datos.padre_id).first()
        if not padre:
            raise HTTPException(status_code=400, detail="Categoría padre no encontrada")

    categoria = models.Categoria(**datos.model_dump())
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    return categoria


@router.put("/{categoria_id}", response_model=CategoriaResponse)
def actualizar_categoria(categoria_id: int, datos: CategoriaUpdate, db: Session = Depends(get_db)):
    categoria = db.query(models.Categoria).filter(models.Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    cambios = datos.model_dump(exclude_unset=True)

    if "padre_id" in cambios and cambios["padre_id"] is not None:
        if cambios["padre_id"] == categoria_id:
            raise HTTPException(status_code=400, detail="Una categoría no puede ser su propio padre")
        padre = db.query(models.Categoria).filter(models.Categoria.id == cambios["padre_id"]).first()
        if not padre:
            raise HTTPException(status_code=400, detail="Categoría padre no encontrada")

    for campo, valor in cambios.items():
        setattr(categoria, campo, valor)

    db.commit()
    db.refresh(categoria)
    return categoria


@router.delete("/{categoria_id}", status_code=204)
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    categoria = db.query(models.Categoria).filter(models.Categoria.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    tiene_subcategorias = db.query(models.Categoria).filter(
        models.Categoria.padre_id == categoria_id
    ).first()
    if tiene_subcategorias:
        raise HTTPException(status_code=400, detail="No se puede eliminar: tiene subcategorías asociadas")

    tiene_familias = db.query(models.Familia).filter(
        models.Familia.categoria_id == categoria_id
    ).first()
    if tiene_familias:
        raise HTTPException(status_code=400, detail="No se puede eliminar: tiene familias asociadas")

    db.delete(categoria)
    db.commit()
