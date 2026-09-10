from datetime import datetime
from contextlib import closing
from pathlib import Path
import sqlite3
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, joinedload
from app import models
from app.services.inventario import asignar_netos


def migrar(engine):
    columnas = {
        "ventas": {"descuento": "REAL NOT NULL DEFAULT 0"},
        "productos": {"clave_prod_serv": "TEXT", "clave_unidad": "TEXT"},
        "facturas": {"uuid": "TEXT", "venta_id": "INTEGER REFERENCES ventas(id)",
                     "solicitud_id": "TEXT", "cancellation_status": "TEXT"},
        "cotizaciones": {"venta_id": "INTEGER REFERENCES ventas(id)"},
        "venta_items": {"costo_unitario": "REAL", "total_neto": "REAL"},
    }
    inspector = inspect(engine)
    tablas = set(inspector.get_table_names())
    hay_cambios = bool(tablas) and (
        bool(set(models.Base.metadata.tables) - tablas) or any(
            set(nuevas) - {c['name'] for c in inspector.get_columns(tabla)}
            for tabla, nuevas in columnas.items() if tabla in tablas
        )
    )
    # También protege la primera apertura tras actualizar con el .bat antiguo.
    if hay_cambios and engine.url.database and engine.url.database != ':memory:':
        origen = Path(engine.url.database).resolve()
        carpeta = origen.parent / 'respaldos'
        carpeta.mkdir(exist_ok=True)
        destino = carpeta / f"antes_migracion_{datetime.now():%Y%m%d_%H%M%S_%f}.db"
        with closing(sqlite3.connect(origen.as_uri() + '?mode=ro', uri=True)) as fuente:
            with closing(sqlite3.connect(destino)) as copia:
                fuente.backup(copia)
    models.Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        # Algunas instalaciones ya tenían configuracion(clave, valor).
        # Conservarla; importar el interruptor solo si proviene del esquema reciente.
        if 'configuracion' in tablas:
            anteriores = {c['name'] for c in inspect(conn).get_columns('configuracion')}
            if {'id', 'bloquear_sin_stock'}.issubset(anteriores):
                conn.execute(text('''INSERT OR IGNORE INTO configuracion_inventario (id, bloquear_sin_stock)
                    SELECT id, bloquear_sin_stock FROM configuracion WHERE id = 1'''))
        for tabla, nuevas in columnas.items():
            existentes = {c["name"] for c in inspect(conn).get_columns(tabla)}
            for nombre, tipo in nuevas.items():
                if nombre not in existentes:
                    conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {nombre} {tipo}"))
        for tabla, campo in [("facturas", "venta_id"), ("facturas", "solicitud_id"), ("cotizaciones", "venta_id")]:
            conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS ux_{tabla}_{campo} ON {tabla} ({campo})"))
    with Session(engine) as db:
        ventas = db.query(models.Venta).options(joinedload(models.Venta.items)).filter(
            models.Venta.items.any(models.VentaItem.total_neto.is_(None))
        ).all()
        for venta in ventas:
            asignar_netos(sorted(venta.items, key=lambda i: i.id), venta.total)
        # Las conversiones anteriores se identificaban únicamente en las notas.
        # Si hubo varias, conservar la primera sin borrar ventas históricas.
        for cotizacion in db.query(models.Cotizacion).filter(models.Cotizacion.venta_id.is_(None)):
            prefijo = f"De cotización #{str(cotizacion.id).zfill(4)} — "
            venta = db.query(models.Venta).filter(models.Venta.notas.startswith(prefijo)).order_by(models.Venta.id).first()
            if venta:
                cotizacion.venta_id = venta.id
        db.commit()
