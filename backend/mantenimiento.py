"""Herramientas locales para actualizar sin sobrescribir datos del negocio."""
import argparse
from contextlib import closing
from datetime import datetime
from pathlib import Path
import socket
import sqlite3

BASE = Path(__file__).resolve().parent


def respaldar():
    origen = BASE / 'systema.db'
    if not origen.exists():
        print('No hay base de datos que respaldar todavia.')
        return
    carpeta = BASE / 'respaldos'
    carpeta.mkdir(exist_ok=True)
    destino = carpeta / f"systema_{datetime.now():%Y%m%d_%H%M%S_%f}.db"
    with closing(sqlite3.connect(origen.as_uri() + '?mode=ro', uri=True)) as fuente:
        with closing(sqlite3.connect(destino)) as copia:
            fuente.backup(copia)
    print(f'Respaldo creado: {destino}')


def comprobar_cerrado():
    for puerto in (8000, 5173):
        with socket.socket() as conexion:
            conexion.settimeout(1)
            if conexion.connect_ex(('127.0.0.1', puerto)) == 0:
                raise SystemExit('Cierra las ventanas Backend y Frontend antes de actualizar o volver a iniciar.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('accion', choices=['respaldar', 'comprobar-cerrado', 'migrar'])
    accion = parser.parse_args().accion
    if accion == 'respaldar':
        respaldar()
    elif accion == 'comprobar-cerrado':
        comprobar_cerrado()
    else:
        from app.database import engine
        from app.migrations import migrar
        migrar(engine)
        print('Base de datos actualizada.')
