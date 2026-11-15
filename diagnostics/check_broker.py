"""Verifica TCP e CONNACK sem publicar ou assinar tópicos."""
import socket
import struct
import time
import uuid
from concurrent.futures import ThreadPoolExecutor


def check(host):
    client_id = ('cp2-diag-' + uuid.uuid4().hex[:12]).encode()
    body = b'\x00\x04MQTT\x04\x02\x00\x0f' + struct.pack('!H', len(client_id)) + client_id
    start = time.monotonic()
    try:
        with socket.create_connection((host, 1883), timeout=10) as connection:
            connection.settimeout(10)
            connection.sendall(b'\x10' + bytes([len(body)]) + body)
            response = b''
            while len(response) < 4:
                data = connection.recv(4 - len(response))
                if not data:
                    break
                response += data
            print(f'{host}: CONNACK={response.hex()} tempo={time.monotonic()-start:.2f}s', flush=True)
            connection.sendall(b'\xe0\x00')
    except OSError as error:
        print(f'{host}: {type(error).__name__}: {error}', flush=True)


with ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(check, ['127.0.0.1', 'test.mosquitto.org']))
