from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas import MaterialCreate, MaterialResponse, TipoMedidaCreate, TipoMedidaResponse

router = APIRouter(prefix="/catalogos", tags=["catalogos"])


@router.get("/materiales", response_model=list[MaterialResponse])
def listar_materiales(db: Session = Depends(get_db)):
    return db.query(models.Material).order_by(models.Material.nombre).all()


@router.post("/materiales", response_model=MaterialResponse, status_code=201)
def crear_material(datos: MaterialCreate, db: Session = Depends(get_db)):
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    if db.query(models.Material).filter(models.Material.nombre == nombre).first():
        raise HTTPException(status_code=400, detail=f"Ya existe el material '{nombre}'")
    m = models.Material(nombre=nombre)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/materiales/{material_id}", response_model=MaterialResponse)
def renombrar_material(material_id: int, datos: MaterialCreate, db: Session = Depends(get_db)):
    m = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    nuevo_nombre = datos.nombre.strip()
    if not nuevo_nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    if db.query(models.Material).filter(models.Material.nombre == nuevo_nombre, models.Material.id != material_id).first():
        raise HTTPException(status_code=400, detail=f"Ya existe el material '{nuevo_nombre}'")
    viejo_nombre = m.nombre
    m.nombre = nuevo_nombre
    db.query(models.Producto).filter(models.Producto.material == viejo_nombre).update({"material": nuevo_nombre})
    db.commit()
    db.refresh(m)
    return m


@router.delete("/materiales/{material_id}", status_code=204)
def eliminar_material(material_id: int, db: Session = Depends(get_db)):
    m = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    db.delete(m)
    db.commit()


@router.get("/tipos-medida", response_model=list[TipoMedidaResponse])
def listar_tipos_medida(db: Session = Depends(get_db)):
    return db.query(models.TipoMedida).order_by(models.TipoMedida.nombre).all()


@router.post("/tipos-medida", response_model=TipoMedidaResponse, status_code=201)
def crear_tipo_medida(datos: TipoMedidaCreate, db: Session = Depends(get_db)):
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    if db.query(models.TipoMedida).filter(models.TipoMedida.nombre == nombre).first():
        raise HTTPException(status_code=400, detail=f"Ya existe el tipo de medida '{nombre}'")
    t = models.TipoMedida(nombre=nombre)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/tipos-medida/{tipo_id}", response_model=TipoMedidaResponse)
def renombrar_tipo_medida(tipo_id: int, datos: TipoMedidaCreate, db: Session = Depends(get_db)):
    t = db.query(models.TipoMedida).filter(models.TipoMedida.id == tipo_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tipo de medida no encontrado")
    nuevo_nombre = datos.nombre.strip()
    if not nuevo_nombre:
        raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
    if db.query(models.TipoMedida).filter(models.TipoMedida.nombre == nuevo_nombre, models.TipoMedida.id != tipo_id).first():
        raise HTTPException(status_code=400, detail=f"Ya existe el tipo de medida '{nuevo_nombre}'")
    viejo_nombre = t.nombre
    t.nombre = nuevo_nombre
    db.query(models.Producto).filter(models.Producto.tipo_medida == viejo_nombre).update({"tipo_medida": nuevo_nombre})
    db.commit()
    db.refresh(t)
    return t


@router.delete("/tipos-medida/{tipo_id}", status_code=204)
def eliminar_tipo_medida(tipo_id: int, db: Session = Depends(get_db)):
    t = db.query(models.TipoMedida).filter(models.TipoMedida.id == tipo_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tipo de medida no encontrado")
    db.delete(t)
    db.commit()
