import os
import httpx
from app import models

FACTURAPI_BASE = "https://www.facturapi.io/v2"


def get_api_key() -> str | None:
    return os.getenv("FACTURAPI_API_KEY")


def http_client() -> httpx.Client:
    api_key = get_api_key()
    if not api_key:
        raise RuntimeError("FACTURAPI_API_KEY no está configurada en el .env")
    return httpx.Client(
        base_url=FACTURAPI_BASE,
        auth=(api_key, ""),
        headers={"Content-Type": "application/json"},
        timeout=30,
    )


def cliente_a_facturapi(cliente: models.ClienteFiscal) -> dict:
    payload: dict = {
        "legal_name": cliente.razon_social,
        "tax_id": cliente.rfc,
        "tax_system": cliente.regimen_fiscal,
    }
    if cliente.correo:
        payload["email"] = cliente.correo
    if cliente.telefono:
        payload["phone"] = cliente.telefono

    address: dict = {}
    if cliente.cp:
        address["zip"] = cliente.cp
    if cliente.calle:
        address["street"] = cliente.calle
    if cliente.num_exterior:
        address["exterior"] = cliente.num_exterior
    if cliente.num_interior:
        address["interior"] = cliente.num_interior
    if cliente.colonia:
        address["neighborhood"] = cliente.colonia
    if cliente.municipio:
        address["city"] = cliente.municipio
    if cliente.estado:
        address["state"] = cliente.estado
    if address:
        payload["address"] = address

    return payload
