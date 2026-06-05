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
