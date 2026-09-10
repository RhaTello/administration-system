"""El proceso se carga antes de git pull para poder actualizar los propios .bat."""
from pathlib import Path
import subprocess
import sys

from mantenimiento import comprobar_cerrado, respaldar

RAIZ = Path(__file__).resolve().parent.parent


def actualizar():
    comprobar_cerrado()
    respaldar()
    pasos = [
        (RAIZ, ['git', 'pull', '--ff-only']),
        (RAIZ, [sys.executable, '-m', 'pip', 'install', '-r', str(RAIZ / 'backend' / 'requirements.txt')]),
        (RAIZ / 'frontend', ['npm.cmd', 'ci']),
        (RAIZ / 'frontend', ['npm.cmd', 'run', 'build']),
        (RAIZ, [sys.executable, str(RAIZ / 'backend' / 'mantenimiento.py'), 'migrar']),
    ]
    for carpeta, comando in pasos:
        print(f"Ejecutando: {' '.join(comando)}", flush=True)
        subprocess.run(comando, cwd=carpeta, check=True)
    print('Actualizacion completada. Ejecuta iniciar.bat.')


if __name__ == '__main__':
    codigo = 0
    try:
        actualizar()
    except (OSError, subprocess.CalledProcessError, SystemExit) as error:
        print(f'No se completo la actualizacion: {error}')
        codigo = 1
    input('Presiona Enter para cerrar...')
    sys.exit(codigo)
