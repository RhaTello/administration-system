import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.services import facturapi as fapi

router = APIRouter(prefix="/configuracion", tags=["configuracion"])


class ConfigGuardar(BaseModel):
    facturapi_api_key: str | None = None
    facturapi_modo: str | None = None


@router.get("/")
def obtener_config(db: Session = Depends(get_db)):
    rows = db.query(models.Configuracion).all()
    data = {r.clave: r.valor for r in rows}
    api_key = data.get("facturapi_api_key") or ""
    if api_key:
        data["facturapi_api_key_preview"] = f"{'*' * max(0, len(api_key) - 4)}{api_key[-4:]}"
    else:
        data["facturapi_api_key_preview"] = ""
    data["facturapi_api_key"] = ""
    data.setdefault("facturapi_modo", "sandbox")
    return data


@router.post("/")
def guardar_config(datos: ConfigGuardar, db: Session = Depends(get_db)):
    cambios = datos.model_dump(exclude_none=True)
    for clave, valor in cambios.items():
        if not valor:
            continue
        row = db.query(models.Configuracion).filter(models.Configuracion.clave == clave).first()
        if row:
            row.valor = valor
        else:
            db.add(models.Configuracion(clave=clave, valor=valor))
    db.commit()
    return {"ok": True}


@router.post("/facturapi/probar")
def probar_conexion(db: Session = Depends(get_db)):
    api_key = fapi.get_api_key(db)
    if not api_key:
        raise HTTPException(status_code=400, detail="No hay API key configurada")
    try:
        with fapi.http_client(api_key) as client:
            r = client.get("/customers?limit=1")
        if r.status_code == 401:
            raise HTTPException(status_code=400, detail="API key inválida")
        if not r.is_success:
            raise HTTPException(status_code=400, detail=f"Error de Facturapi: {r.text}")
        return {"ok": True, "modo": fapi.get_modo(db)}
    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi. Verifica tu internet.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
