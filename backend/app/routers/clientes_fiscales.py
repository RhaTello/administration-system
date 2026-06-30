import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app import models
from app.schemas import ClienteFiscalCreate, ClienteFiscalUpdate, ClienteFiscalResponse
from app.services import facturapi as fapi

router = APIRouter(prefix="/clientes-fiscales", tags=["clientes-fiscales"])


@router.get("/", response_model=list[ClienteFiscalResponse])
def listar_clientes(
    buscar: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.ClienteFiscal)
    if buscar:
        like = f"%{buscar}%"
        query = query.filter(
            models.ClienteFiscal.razon_social.ilike(like) |
            models.ClienteFiscal.rfc.ilike(like) |
            models.ClienteFiscal.nombre_comercial.ilike(like)
        )
    return query.order_by(models.ClienteFiscal.razon_social).all()


@router.get("/{cliente_id}", response_model=ClienteFiscalResponse)
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    c = db.query(models.ClienteFiscal).filter(models.ClienteFiscal.id == cliente_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return c


@router.post("/", response_model=ClienteFiscalResponse, status_code=201)
def crear_cliente(datos: ClienteFiscalCreate, db: Session = Depends(get_db)):
    rfc = datos.rfc.strip().upper()
    if db.query(models.ClienteFiscal).filter(models.ClienteFiscal.rfc == rfc).first():
        raise HTTPException(status_code=400, detail=f"Ya existe un cliente con RFC '{rfc}'")
    cliente = models.ClienteFiscal(**{**datos.model_dump(), "rfc": rfc})
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.put("/{cliente_id}", response_model=ClienteFiscalResponse)
def actualizar_cliente(cliente_id: int, datos: ClienteFiscalUpdate, db: Session = Depends(get_db)):
    cliente = db.query(models.ClienteFiscal).filter(models.ClienteFiscal.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    cambios = datos.model_dump(exclude_unset=True)

    if "rfc" in cambios:
        cambios["rfc"] = cambios["rfc"].strip().upper()
        duplicado = db.query(models.ClienteFiscal).filter(
            models.ClienteFiscal.rfc == cambios["rfc"],
            models.ClienteFiscal.id != cliente_id,
        ).first()
        if duplicado:
            raise HTTPException(status_code=400, detail=f"Ya existe un cliente con RFC '{cambios['rfc']}'")

    for campo, valor in cambios.items():
        setattr(cliente, campo, valor)

    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=204)
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(models.ClienteFiscal).filter(models.ClienteFiscal.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(cliente)
    db.commit()


@router.post("/{cliente_id}/sincronizar", response_model=ClienteFiscalResponse)
def sincronizar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(models.ClienteFiscal).filter(models.ClienteFiscal.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if not (cliente.rfc and cliente.regimen_fiscal and cliente.cp):
        raise HTTPException(
            status_code=400,
            detail="El cliente necesita RFC, régimen fiscal y C.P. para sincronizar con Facturapi",
        )

    if not fapi.get_api_key():
        raise HTTPException(status_code=400, detail="FACTURAPI_API_KEY no está configurada en el .env")

    payload = fapi.cliente_a_facturapi(cliente)
    try:
        with fapi.http_client() as http:
            if cliente.facturapi_id:
                r = http.put(f"/customers/{cliente.facturapi_id}", json=payload)
            else:
                r = http.post("/customers", json=payload)

        if not r.is_success:
            detalle = r.json().get("message", r.text) if r.content else r.text
            raise HTTPException(status_code=400, detail=f"Facturapi: {detalle}")

        cliente.facturapi_id = r.json()["id"]
        db.commit()
        db.refresh(cliente)
        return cliente
    except httpx.ConnectError:
        raise HTTPException(status_code=400, detail="No se pudo conectar a Facturapi")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
