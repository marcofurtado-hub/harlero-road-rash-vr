#!/usr/bin/env python3
"""Servidor local do Harlero Road Rash.

WebXR só funciona em HTTPS (ou localhost). Este script gera um certificado
autoassinado na primeira execução e serve o jogo em https://<seu-ip>:8443
pra você abrir direto no navegador do Quest (mesma rede Wi-Fi).

  python3 serve.py            -> HTTPS na porta 8443 (pro Quest)
  python3 serve.py --http     -> HTTP na porta 8000 (só pra testar no PC)
"""
import http.server
import os
import socket
import ssl
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CERT_DIR = os.path.join(ROOT, ".cert")
CERT = os.path.join(CERT_DIR, "cert.pem")
KEY = os.path.join(CERT_DIR, "key.pem")


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def ensure_cert(ip):
    if os.path.exists(CERT) and os.path.exists(KEY):
        return
    os.makedirs(CERT_DIR, exist_ok=True)
    print("Gerando certificado autoassinado...")
    subprocess.run(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", KEY, "-out", CERT, "-days", "825",
            "-subj", "/CN=harlero.local",
            "-addext", f"subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{ip}",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def main():
    use_http = "--http" in sys.argv
    ip = lan_ip()
    port = 8000 if use_http else 8443
    httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), Handler)
    if not use_http:
        ensure_cert(ip)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT, KEY)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    scheme = "http" if use_http else "https"
    print("\n  HARLERO ROAD RASH 66 rodando!\n")
    print(f"  No PC:    {scheme}://localhost:{port}")
    if not use_http:
        print(f"  No Quest: https://{ip}:{port}")
        print("            (o navegador vai avisar do certificado -> Avançado -> Prosseguir)")
    print("\n  Ctrl+C pra parar.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
