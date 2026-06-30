from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CategoriaSimple(BaseModel):
    id: int
    nombre: str
    model_config = ConfigDict(from_attributes=True)


class FamiliaSimple(BaseModel):
    id: int
    nombre: str
    categoria: CategoriaSimple
    model_config = ConfigDict(from_attributes=True)


class CategoriaCreate(BaseModel):
    nombre: str
    padre_id: int | None = None


class CategoriaUpdate(BaseModel):
    nombre: str | None = None
    padre_id: int | None = None


class CategoriaResponse(BaseModel):
    id: int
    nombre: str
    padre_id: int | None = None
    model_config = ConfigDict(from_attributes=True)


class FamiliaCreate(BaseModel):
    nombre: str
    categoria_id: int


class FamiliaUpdate(BaseModel):
    nombre: str | None = None
    categoria_id: int | None = None


class FamiliaResponse(BaseModel):
    id: int
    nombre: str
    categoria: CategoriaSimple
    model_config = ConfigDict(from_attributes=True)


class ProductoBase(BaseModel):
    sku: str
    familia_id: int
    medida: str | None = None
    material: str | None = None
    tipo_medida: str | None = None
    precio: float | None = None
    costo: float | None = None
    stock: int = 0
    clave_prod_serv: str | None = None
    clave_unidad: str | None = None


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    sku: str | None = None
    familia_id: int | None = None
    medida: str | None = None
    material: str | None = None
    tipo_medida: str | None = None
    precio: float | None = None
    costo: float | None = None
    stock: int | None = None
    clave_prod_serv: str | None = None
    clave_unidad: str | None = None


class ProductoResponse(ProductoBase):
    id: int
    familia: FamiliaSimple
    model_config = ConfigDict(from_attributes=True)


class VentaItemCreate(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)


class VentaCreate(BaseModel):
    items: list[VentaItemCreate] = Field(min_length=1)
    descuento: float = Field(default=0, ge=0, le=100)
    notas: str | None = None


class VentaItemResponse(BaseModel):
    id: int
    producto_id: int
    sku: str
    descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float
    model_config = ConfigDict(from_attributes=True)


class VentaResponse(BaseModel):
    id: int
    fecha: datetime
    descuento: float
    total: float
    notas: str | None
    items: list[VentaItemResponse]
    model_config = ConfigDict(from_attributes=True)


class ClienteFiscalCreate(BaseModel):
    razon_social: str
    rfc: str
    nombre_comercial: str | None = None
    regimen_fiscal: str | None = None
    uso_cfdi: str | None = None
    forma_pago: str | None = None
    correo: str | None = None
    telefono: str | None = None
    contacto: str | None = None
    calle: str | None = None
    num_exterior: str | None = None
    num_interior: str | None = None
    entre_calle: str | None = None
    colonia: str | None = None
    municipio: str | None = None
    estado: str | None = None
    cp: str | None = None
    manejo_credito: int = 0
    dias_credito: int = 0
    limite_credito: float = 0
    descuento: float = 0


class ClienteFiscalUpdate(ClienteFiscalCreate):
    razon_social: str | None = None
    rfc: str | None = None


class ClienteFiscalResponse(BaseModel):
    id: int
    razon_social: str
    rfc: str
    nombre_comercial: str | None
    regimen_fiscal: str | None
    uso_cfdi: str | None
    forma_pago: str | None
    correo: str | None
    telefono: str | None
    contacto: str | None
    calle: str | None
    num_exterior: str | None
    num_interior: str | None
    entre_calle: str | None
    colonia: str | None
    municipio: str | None
    estado: str | None
    cp: str | None
    manejo_credito: int
    dias_credito: int
    limite_credito: float
    descuento: float
    facturapi_id: str | None
    model_config = ConfigDict(from_attributes=True)


class CotizacionItemCreate(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)
    precio_unitario: float = Field(gt=0)


class CotizacionCreate(BaseModel):
    cliente: str
    items: list[CotizacionItemCreate] = Field(min_length=1)
    descuento: float = Field(default=0, ge=0, le=100)
    notas: str | None = None


class CotizacionItemResponse(BaseModel):
    id: int
    producto_id: int
    sku: str
    descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float
    model_config = ConfigDict(from_attributes=True)


class CotizacionResponse(BaseModel):
    id: int
    fecha: datetime
    cliente: str
    descuento: float
    total: float
    notas: str | None
    items: list[CotizacionItemResponse]
    model_config = ConfigDict(from_attributes=True)


class FacturaItemCreate(BaseModel):
    descripcion: str
    clave_prod_serv: str
    clave_unidad: str
    unidad: str = "Pieza"
    cantidad: float = Field(gt=0)
    precio_unitario: float = Field(gt=0)


class FacturaCreate(BaseModel):
    cliente_id: int
    items: list[FacturaItemCreate] = Field(min_length=1)
    uso_cfdi: str
    forma_pago: str
    metodo_pago: str = "PUE"


class FacturaResponse(BaseModel):
    id: int
    facturapi_id: str
    folio: str | None
    fecha: datetime
    cliente_id: int | None
    cliente_razon_social: str
    cliente_rfc: str
    subtotal: float
    iva: float
    total: float
    uso_cfdi: str | None
    forma_pago: str | None
    metodo_pago: str | None
    status: str
    model_config = ConfigDict(from_attributes=True)


class MaterialCreate(BaseModel):
    nombre: str


class MaterialResponse(BaseModel):
    id: int
    nombre: str
    model_config = ConfigDict(from_attributes=True)


class TipoMedidaCreate(BaseModel):
    nombre: str


class TipoMedidaResponse(BaseModel):
    id: int
    nombre: str
    model_config = ConfigDict(from_attributes=True)
