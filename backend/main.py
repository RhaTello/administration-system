from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import engine
from app import models
from app.routers import health, productos, categorias, familias, ventas, estadisticas, catalogos

models.Base.metadata.create_all(bind=engine)

# Migraciones manuales para columnas nuevas en tablas existentes
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE ventas ADD COLUMN descuento REAL NOT NULL DEFAULT 0"))
        conn.commit()
    except Exception:
        pass  # La columna ya existe

# Seed de catálogos iniciales (solo si las tablas están vacías)
with Session(engine) as session:
    if session.query(models.Material).count() == 0:
        for nombre in ['Gr-8', 'Gr-5', 'Galvanizado', 'Inoxidable']:
            session.add(models.Material(nombre=nombre))
        session.commit()
    if session.query(models.TipoMedida).count() == 0:
        for nombre in ['fraccional', 'milimétrico']:
            session.add(models.TipoMedida(nombre=nombre))
        session.commit()

app = FastAPI(title="Systema API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(productos.router, prefix="/api")
app.include_router(categorias.router, prefix="/api")
app.include_router(familias.router, prefix="/api")
app.include_router(ventas.router, prefix="/api")
app.include_router(estadisticas.router, prefix="/api")
app.include_router(catalogos.router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
