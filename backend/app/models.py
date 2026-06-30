from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    padre_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)

    padre = relationship("Categoria", remote_side=[id], back_populates="subcategorias")
    subcategorias = relationship("Categoria", back_populates="padre")
    familias = relationship("Familia", back_populates="categoria")


class Familia(Base):
    __tablename__ = "familias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)

    categoria = relationship("Categoria", back_populates="familias")
    productos = relationship("Producto", back_populates="familia")


class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, nullable=False, index=True)
    familia_id = Column(Integer, ForeignKey("familias.id"), nullable=False)
    medida = Column(String, nullable=True)
    material = Column(String, nullable=True)
    tipo_medida = Column(String, nullable=True)  # "fraccional" | "milimétrico"
    precio = Column(Float, nullable=True)
    costo = Column(Float, nullable=True)
    stock = Column(Integer, default=0, nullable=False)
    clave_prod_serv = Column(String, nullable=True)  # clave SAT ej. "31161500"
    clave_unidad = Column(String, nullable=True)      # clave SAT ej. "H87"

    familia = relationship("Familia", back_populates="productos")


class ClienteFiscal(Base):
    __tablename__ = "clientes_fiscales"

    id = Column(Integer, primary_key=True, index=True)
    razon_social = Column(String, nullable=False)
    rfc = Column(String, nullable=False, unique=True, index=True)
    nombre_comercial = Column(String, nullable=True)
    regimen_fiscal = Column(String, nullable=True)   # clave SAT ej. "612"
    uso_cfdi = Column(String, nullable=True)         # clave SAT ej. "G03"
    forma_pago = Column(String, nullable=True)       # clave SAT ej. "03"

    # Contacto
    correo = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    contacto = Column(String, nullable=True)

    # Dirección fiscal
    calle = Column(String, nullable=True)
    num_exterior = Column(String, nullable=True)
    num_interior = Column(String, nullable=True)
    entre_calle = Column(String, nullable=True)
    colonia = Column(String, nullable=True)
    municipio = Column(String, nullable=True)
    estado = Column(String, nullable=True)
    cp = Column(String, nullable=True)               # obligatorio CFDI 4.0

    # Datos comerciales
    manejo_credito = Column(Integer, default=0, nullable=False)  # 0=No 1=Sí
    dias_credito = Column(Integer, default=0, nullable=False)
    limite_credito = Column(Float, default=0, nullable=False)
    descuento = Column(Float, default=0, nullable=False)

    # Referencia Facturapi (se llena después al integrar)
    facturapi_id = Column(String, nullable=True)


class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.now, nullable=False)
    cliente = Column(String, nullable=False)
    descuento = Column(Float, default=0, nullable=False)
    total = Column(Float, nullable=False)
    notas = Column(String, nullable=True)

    items = relationship("CotizacionItem", back_populates="cotizacion", cascade="all, delete-orphan")


class CotizacionItem(Base):
    __tablename__ = "cotizacion_items"

    id = Column(Integer, primary_key=True, index=True)
    cotizacion_id = Column(Integer, ForeignKey("cotizaciones.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    sku = Column(String, nullable=False)
    descripcion = Column(String, nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)

    cotizacion = relationship("Cotizacion", back_populates="items")


class Factura(Base):
    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, index=True)
    facturapi_id = Column(String, unique=True, nullable=False)
    folio = Column(String, nullable=True)
    fecha = Column(DateTime, default=datetime.now, nullable=False)
    cliente_id = Column(Integer, ForeignKey("clientes_fiscales.id"), nullable=True)
    cliente_razon_social = Column(String, nullable=False)
    cliente_rfc = Column(String, nullable=False)
    subtotal = Column(Float, nullable=False)
    iva = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    uso_cfdi = Column(String, nullable=True)
    forma_pago = Column(String, nullable=True)
    metodo_pago = Column(String, nullable=True)
    status = Column(String, nullable=False, default="valid")


class Material(Base):
    __tablename__ = "materiales"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, unique=True)


class TipoMedida(Base):
    __tablename__ = "tipos_medida"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False, unique=True)


class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.now, nullable=False)
    descuento = Column(Float, default=0, nullable=False)
    total = Column(Float, nullable=False)
    notas = Column(String, nullable=True)

    items = relationship("VentaItem", back_populates="venta")


class VentaItem(Base):
    __tablename__ = "venta_items"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    sku = Column(String, nullable=False)
    descripcion = Column(String, nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)

    venta = relationship("Venta", back_populates="items")
