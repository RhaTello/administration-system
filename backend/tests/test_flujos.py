import json
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from unittest.mock import patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.migrations import migrar
from app.routers import ventas, cotizaciones, facturas, configuracion, estadisticas


class FlujosTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_engine(f"sqlite:///{Path(self.temp.name) / 'pruebas.db'}", connect_args={'check_same_thread': False})
        migrar(self.engine)
        app = FastAPI()
        for router in (ventas, cotizaciones, facturas, configuracion, estadisticas):
            app.include_router(router.router, prefix='/api')

        def db_pruebas():
            with Session(self.engine) as db:
                yield db
        app.dependency_overrides[get_db] = db_pruebas
        self.client = TestClient(app)
        with Session(self.engine) as db:
            db.add(models.Categoria(id=1, nombre='Tornillos'))
            db.add(models.Familia(id=1, nombre='Hexagonal', categoria_id=1))
            db.add(models.Producto(id=1, sku='T-1', familia_id=1, precio=11.60, costo=5, stock=0))
            db.add(models.ClienteFiscal(id=1, razon_social='Cliente de prueba', rfc='XAXX010101000', facturapi_id='cliente-prueba'))
            db.commit()
        self.key = patch.object(facturas.fapi, 'get_api_key', return_value='clave-de-prueba')
        self.key.start()
        self.addCleanup(self.key.stop)
        self.requests = []

    def tearDown(self):
        self.client.close()
        self.engine.dispose()
        self.temp.cleanup()

    def stock(self):
        with Session(self.engine) as db:
            return db.get(models.Producto, 1).stock

    def controlar(self, stock=0):
        with Session(self.engine) as db:
            db.get(models.Producto, 1).stock = stock
            db.commit()
        r = self.client.post('/api/configuracion/', json={'bloquear_sin_stock': True})
        self.assertEqual(r.status_code, 200)

    def payload_factura(self):
        return {'solicitud_id': 'solicitud-prueba-0001', 'cliente_id': 1,
                'uso_cfdi': 'G03', 'forma_pago': '01', 'metodo_pago': 'PUE',
                'items': [{'producto_id': 1, 'descripcion': 'Tornillo', 'clave_prod_serv': '31161500',
                           'clave_unidad': 'H87', 'cantidad': 2, 'precio_unitario': 11.60}]}

    def proveedor(self, respuesta=None, fallo=False):
        def responder(request):
            self.requests.append(request)
            if fallo:
                raise httpx.ReadTimeout('tiempo agotado', request=request)
            return httpx.Response(200, json=respuesta or {
                'id': 'factura-prueba', 'folio_number': 1, 'total': 23.20,
                'subtotal': 20, 'status': 'valid', 'uuid': 'uuid-prueba',
            })
        return patch.object(facturas.fapi, 'http_client', side_effect=lambda: httpx.Client(
            base_url='https://facturapi.test', transport=httpx.MockTransport(responder)))

    def cotizacion(self):
        r = self.client.post('/api/cotizaciones/', json={'cliente': 'Cliente', 'descuento': 10,
            'items': [{'producto_id': 1, 'cantidad': 2, 'precio_unitario': 10}]})
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()['id']

    def test_venta_permite_negativos_y_conserva_costo_y_descuento(self):
        self.assertFalse(self.client.get('/api/configuracion/').json()['bloquear_sin_stock'])
        r = self.client.post('/api/ventas/', json={'descuento': 10, 'items': [{'producto_id': 1, 'cantidad': 2}]})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(self.stock(), -2)
        self.assertEqual(r.json()['items'][0]['costo_unitario'], 5)
        self.assertEqual(r.json()['total'], 20.88)
        with Session(self.engine) as db:
            db.get(models.Producto, 1).costo = 9
            db.commit()
        self.assertEqual(self.client.get(f"/api/ventas/{r.json()['id']}").json()['items'][0]['costo_unitario'], 5)
        top = self.client.get('/api/estadisticas/productos-mas-vendidos').json()
        self.assertEqual(top[0]['total_monto'], 20.88)

    def test_control_stock_acumula_lineas_repetidas_y_permite_llegar_a_cero(self):
        self.controlar(3)
        r = self.client.post('/api/ventas/', json={'items': [{'producto_id': 1, 'cantidad': 2}] * 2})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.stock(), 3)
        r = self.client.post('/api/ventas/', json={'items': [{'producto_id': 1, 'cantidad': 3}]})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.stock(), 0)
        self.assertEqual(self.client.post('/api/ventas/', json={'items': [{'producto_id': 1, 'cantidad': 1}]}).status_code, 400)

    def test_cotizacion_convertida_una_sola_vez(self):
        cid = self.cotizacion()
        primero = self.client.post(f'/api/cotizaciones/{cid}/convertir')
        segundo = self.client.post(f'/api/cotizaciones/{cid}/convertir')
        self.assertEqual(primero.status_code, 200, primero.text)
        self.assertEqual(primero.json()['id'], segundo.json()['id'])
        self.assertEqual(self.stock(), -2)
        self.assertEqual(self.client.get(f'/api/cotizaciones/{cid}').json()['venta_id'], primero.json()['id'])
        self.assertEqual(self.client.delete(f'/api/cotizaciones/{cid}').status_code, 400)

    def test_control_aplica_a_cotizacion_y_factura_antes_de_timbrar(self):
        cid = self.cotizacion()
        self.controlar(1)
        self.assertEqual(self.client.post(f'/api/cotizaciones/{cid}/convertir').status_code, 400)
        with self.proveedor():
            r = self.client.post('/api/facturas/', json=self.payload_factura())
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.requests, [])
        self.assertEqual(self.stock(), 1)

    def test_factura_crea_venta_y_reintento_no_duplica(self):
        with self.proveedor():
            r = self.client.post('/api/facturas/', json=self.payload_factura())
            repetida = self.client.post('/api/facturas/', json=self.payload_factura())
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(repetida.json()['id'], r.json()['id'])
        self.assertEqual(len(self.requests), 1)
        self.assertEqual(json.loads(self.requests[0].content)['idempotency_key'], 'solicitud-prueba-0001')
        self.assertEqual(self.stock(), -2)
        venta = self.client.get(f"/api/ventas/{r.json()['venta_id']}").json()
        self.assertEqual(venta['total'], r.json()['total'])
        self.assertEqual(venta['items'][0]['costo_unitario'], 5)

    def test_timeout_no_registra_venta_y_reintento_usa_misma_clave(self):
        with self.proveedor(fallo=True):
            r = self.client.post('/api/facturas/', json=self.payload_factura())
        self.assertEqual(r.status_code, 502, r.text)
        self.assertEqual(self.stock(), 0)
        self.assertEqual(self.client.get('/api/ventas/').json(), [])
        cambiado = self.payload_factura()
        cambiado['items'][0]['cantidad'] = 3
        self.assertEqual(self.client.post('/api/facturas/', json=cambiado).status_code, 409)
        with self.proveedor():
            r = self.client.post('/api/facturas/', json=self.payload_factura())
        self.assertEqual(r.status_code, 201, r.text)
        claves = [json.loads(r.content)['idempotency_key'] for r in self.requests]
        self.assertEqual(claves[0], claves[1])
        self.assertEqual(self.stock(), -2)

    def test_cancelacion_pendiente_y_actualizacion_no_reponen_inventario(self):
        with self.proveedor():
            fid = self.client.post('/api/facturas/', json=self.payload_factura()).json()['id']
        self.assertEqual(self.client.post(f'/api/facturas/{fid}/cancelar', json={'motivo': '01'}).status_code, 400)
        with self.proveedor({'status': 'valid', 'cancellation_status': 'pending'}):
            r = self.client.post(f'/api/facturas/{fid}/cancelar', json={'motivo': '01', 'sustitucion': 'uuid-sustituto'})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()['status'], 'valid')
        self.assertEqual(self.requests[-1].url.params['motive'], '01')
        self.assertEqual(self.requests[-1].url.params['substitution'], 'uuid-sustituto')
        with self.proveedor({'status': 'canceled', 'cancellation_status': 'accepted'}):
            r = self.client.post(f'/api/facturas/{fid}/actualizar')
        self.assertEqual(r.json()['status'], 'canceled')
        self.assertEqual(self.stock(), -2)

    def test_migracion_repetible_preserva_configuracion_e_historia(self):
        self.controlar(4)
        cid = self.cotizacion()
        self.client.post(f'/api/cotizaciones/{cid}/convertir')
        with self.engine.begin() as conn:
            conn.execute(text('UPDATE cotizaciones SET venta_id = NULL'))
            conn.execute(text('UPDATE venta_items SET total_neto = NULL, costo_unitario = NULL'))
        migrar(self.engine)
        migrar(self.engine)
        self.assertEqual(self.stock(), 2)
        self.assertTrue(self.client.get('/api/configuracion/').json()['bloquear_sin_stock'])
        self.assertIsNotNone(self.client.get(f'/api/cotizaciones/{cid}').json()['venta_id'])
        item = self.client.get('/api/ventas/').json()[0]['items'][0]
        self.assertEqual(item['total_neto'], 18)
        self.assertIsNone(item['costo_unitario'])

    def test_dos_ventas_simultaneas_no_rebasan_stock(self):
        self.controlar(1)
        def vender(_):
            return self.client.post('/api/ventas/', json={'items': [{'producto_id': 1, 'cantidad': 1}]}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            estados = list(pool.map(vender, range(2)))
        self.assertEqual(sorted(estados), [201, 400])
        self.assertEqual(self.stock(), 0)

    def test_migracion_agrega_columnas_a_tabla_anterior(self):
        with self.engine.begin() as conn:
            conn.execute(text('DROP TABLE venta_items'))
            conn.execute(text('''CREATE TABLE venta_items (
                id INTEGER PRIMARY KEY, venta_id INTEGER NOT NULL,
                producto_id INTEGER NOT NULL, sku TEXT NOT NULL,
                descripcion TEXT NOT NULL, cantidad INTEGER NOT NULL,
                precio_unitario REAL NOT NULL, subtotal REAL NOT NULL)'''))
            conn.execute(text("INSERT INTO ventas (id, fecha, descuento, total) VALUES (1, '2026-01-01 12:00:00', 10, 9)"))
            conn.execute(text("INSERT INTO venta_items VALUES (1, 1, 1, 'T-1', 'Tornillo', 1, 10, 10)"))
        migrar(self.engine)
        migrar(self.engine)
        venta = self.client.get('/api/ventas/1').json()
        self.assertEqual(venta['total'], 9)
        self.assertEqual(venta['items'][0]['total_neto'], 9)
        self.assertIsNone(venta['items'][0]['costo_unitario'])

    def test_reposicion_incluye_cero_y_negativos(self):
        self.assertEqual(len(self.client.get('/api/estadisticas/stock-critico').json()), 1)
        self.client.post('/api/ventas/', json={'items': [{'producto_id': 1, 'cantidad': 2}]})
        self.assertEqual(self.client.get('/api/estadisticas/stock-critico').json()[0]['stock'], -2)
        self.controlar(1)
        self.assertEqual(self.client.get('/api/estadisticas/stock-critico').json(), [])

    def test_reparto_centavos_coincide_con_total(self):
        from app.services.inventario import asignar_netos
        items = [models.VentaItem(subtotal=0.01) for _ in range(4)]
        asignar_netos(items, 0.02)
        self.assertEqual(sum(round(i.total_neto * 100) for i in items), 2)
        self.assertTrue(all(i.total_neto >= 0 for i in items))

    def test_respaldo_conserva_base_original(self):
        import sqlite3
        import mantenimiento
        with patch.object(mantenimiento, 'BASE', Path(self.temp.name)):
            original = Path(self.temp.name) / 'systema.db'
            with closing(sqlite3.connect(original)) as db:
                db.execute('CREATE TABLE prueba (valor TEXT)')
                db.execute("INSERT INTO prueba VALUES ('conservar')")
                db.commit()
            mantenimiento.respaldar()
            copias = list((Path(self.temp.name) / 'respaldos').glob('*.db'))
            self.assertEqual(len(copias), 1)
            for ruta in [original, copias[0]]:
                with closing(sqlite3.connect(ruta)) as db:
                    self.assertEqual(db.execute('SELECT valor FROM prueba').fetchone()[0], 'conservar')

    def test_actualizador_se_detiene_si_git_falla(self):
        import actualizar
        import subprocess
        with patch.object(actualizar, 'comprobar_cerrado'), patch.object(actualizar, 'respaldar') as backup:
            with patch.object(actualizar.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'git')) as ejecutar:
                with self.assertRaises(subprocess.CalledProcessError):
                    actualizar.actualizar()
                backup.assert_called_once()
                self.assertEqual(ejecutar.call_count, 1)

    def test_cancelar_nota_restaura_stock_una_vez_y_excluye_estadisticas(self):
        r = self.client.post('/api/ventas/', json={'items': [{'producto_id': 1, 'cantidad': 2}] * 2})
        vid = r.json()['id']
        self.assertEqual(self.stock(), -4)
        with ThreadPoolExecutor(max_workers=2) as pool:
            respuestas = list(pool.map(lambda _: self.client.post(f'/api/ventas/{vid}/cancelar'), range(2)))
        self.assertTrue(all(r.status_code == 200 for r in respuestas))
        self.assertEqual(self.stock(), 0)
        venta = self.client.get(f'/api/ventas/{vid}').json()
        self.assertEqual(venta['estado'], 'cancelada')
        self.assertIsNotNone(venta['fecha_cancelacion'])
        self.assertEqual(len(venta['items']), 2)
        self.assertEqual(self.client.get('/api/estadisticas/ventas-por-dia').json(), [])
        self.assertEqual(self.client.get('/api/estadisticas/productos-mas-vendidos').json(), [])

    def test_cancelacion_requiere_factura_cancelada(self):
        with self.proveedor():
            factura = self.client.post('/api/facturas/', json=self.payload_factura()).json()
        vid = factura['venta_id']
        self.assertEqual(self.client.post(f'/api/ventas/{vid}/cancelar').status_code, 400)
        self.assertEqual(self.stock(), -2)
        with self.proveedor({'status': 'canceled', 'cancellation_status': 'accepted'}):
            self.client.post(f"/api/facturas/{factura['id']}/cancelar", json={'motivo': '03'})
        self.assertEqual(self.client.post(f'/api/ventas/{vid}/cancelar').status_code, 200)
        self.assertEqual(self.stock(), 0)

    def test_cancelacion_producto_eliminado_no_cancela_parcialmente(self):
        with Session(self.engine) as db:
            db.add(models.Producto(id=2, sku='T-2', familia_id=1, precio=10, stock=5))
            db.commit()
        r = self.client.post('/api/ventas/', json={'items': [
            {'producto_id': 1, 'cantidad': 2}, {'producto_id': 2, 'cantidad': 1}]})
        vid = r.json()['id']
        with Session(self.engine) as db:
            db.delete(db.get(models.Producto, 2))
            db.commit()
        self.assertEqual(self.client.post(f'/api/ventas/{vid}/cancelar').status_code, 400)
        self.assertEqual(self.stock(), -2)
        self.assertEqual(self.client.get(f'/api/ventas/{vid}').json()['estado'], 'vigente')

    def test_cotizacion_cancelada_no_se_convierte_de_nuevo(self):
        cid = self.cotizacion()
        venta = self.client.post(f'/api/cotizaciones/{cid}/convertir').json()
        self.client.post(f"/api/ventas/{venta['id']}/cancelar")
        repetida = self.client.post(f'/api/cotizaciones/{cid}/convertir').json()
        self.assertEqual(repetida['id'], venta['id'])
        self.assertEqual(repetida['estado'], 'cancelada')
        self.assertEqual(self.stock(), 0)

    def test_configuracion_legacy_no_impide_guardar_nota(self):
        with self.engine.begin() as conn:
            conn.execute(text('DROP TABLE configuracion_inventario'))
            conn.execute(text('CREATE TABLE configuracion (clave VARCHAR PRIMARY KEY, valor VARCHAR)'))
            conn.execute(text("INSERT INTO configuracion VALUES ('negocio', 'dato-anterior')"))
        migrar(self.engine)
        migrar(self.engine)
        self.assertFalse(self.client.get('/api/configuracion/').json()['bloquear_sin_stock'])
        r = self.client.post('/api/ventas/', json={'items': [{'producto_id': 1, 'cantidad': 2}]})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(self.stock(), -2)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT valor FROM configuracion WHERE clave = 'negocio'")).scalar(), 'dato-anterior')

    def test_migracion_conserva_control_de_version_reciente(self):
        with self.engine.begin() as conn:
            conn.execute(text('DROP TABLE configuracion_inventario'))
            conn.execute(text('CREATE TABLE configuracion (id INTEGER PRIMARY KEY, bloquear_sin_stock INTEGER NOT NULL)'))
            conn.execute(text('INSERT INTO configuracion VALUES (1, 1)'))
        migrar(self.engine)
        self.assertTrue(self.client.get('/api/configuracion/').json()['bloquear_sin_stock'])
        self.client.post('/api/configuracion/', json={'bloquear_sin_stock': False})
        migrar(self.engine)
        self.assertFalse(self.client.get('/api/configuracion/').json()['bloquear_sin_stock'])

    def test_actualizador_respalda_y_ejecuta_migracion_al_final(self):
        import actualizar
        orden = []
        with patch.object(actualizar, 'comprobar_cerrado', side_effect=lambda: orden.append('cerrado')):
            with patch.object(actualizar, 'respaldar', side_effect=lambda: orden.append('respaldo')):
                with patch.object(actualizar.subprocess, 'run', side_effect=lambda cmd, **kw: orden.append(cmd)):
                    actualizar.actualizar()
        self.assertEqual(orden[:2], ['cerrado', 'respaldo'])
        self.assertEqual(orden[2], ['git', 'pull', '--ff-only'])
        self.assertEqual(orden[-1][-1], 'migrar')


if __name__ == '__main__':
    unittest.main()
