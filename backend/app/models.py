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

    familia = relationship("Familia", back_populates="productos")


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
