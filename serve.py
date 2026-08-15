#!/usr/bin/env python3
"""Sirve la demo estática Campo Norte (SPA) en 0.0.0.0:8080."""

from __future__ import annotations

import mimetypes
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "dist"
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8080"))


class SpaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        candidate = ROOT / path.lstrip("/")
        if path == "/" or not candidate.is_file():
            # SPA fallback
            index = ROOT / "index.html"
            data = index.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        return super().do_GET()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[camponorte] {self.address_string()} - {fmt % args}")


def main() -> None:
    if not ROOT.is_dir():
        raise SystemExit(f"No existe {ROOT}. Ejecuta npm run build primero.")
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    server = ThreadingHTTPServer((HOST, PORT), SpaHandler)
    print(f"Campo Norte CRM demo → http://{HOST}:{PORT}")
    print(f"Root: {ROOT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nParado.")


if __name__ == "__main__":
    main()
