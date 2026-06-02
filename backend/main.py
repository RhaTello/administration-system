from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import engine
from app import models
from app.routers import health, productos, categorias, familias, ventas, estadisticas

models.Base.metadata.create_all(bind=engine)

# Migraciones manuales para columnas nuevas en tablas existentes
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE ventas ADD COLUMN descuento REAL NOT NULL DEFAULT 0"))
        conn.commit()
    except Exception:
        pass  # La columna ya existe

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
