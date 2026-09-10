from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

router = APIRouter(prefix="/configuracion", tags=["configuracion"])


class ConfiguracionDatos(BaseModel):
    bloquear_sin_stock: bool = False


@router.get("/", response_model=ConfiguracionDatos)
def obtener_configuracion(db: Session = Depends(get_db)):
    config = db.get(models.Configuracion, 1)
    return {"bloquear_sin_stock": bool(config and config.bloquear_sin_stock)}


@router.post("/", response_model=ConfiguracionDatos)
def guardar_configuracion(datos: ConfiguracionDatos, db: Session = Depends(get_db)):
    config = db.get(models.Configuracion, 1)
    if config is None:
        config = models.Configuracion(id=1)
        db.add(config)
    config.bloquear_sin_stock = int(datos.bloquear_sin_stock)
    db.commit()
    return datos
