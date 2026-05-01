#!/usr/bin/env python3
"""Поднять локально HTML-макет split-terminal (откроется в браузере).

Запуск из корня репозитория:

  python mock/serve_mock.py

Нажми Enter в консоли, чтобы остановить сервер.
"""

from __future__ import annotations

import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path

PORT = 8765
DIR = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR), **kwargs)

    def log_message(self, format: str, *args) -> None:
        pass


def main() -> None:
    url = f"http://127.0.0.1:{PORT}/cursor_terminals_mock.html"
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print(f"Макет: {url}")
    webbrowser.open(url)
    try:
        input("Enter — выход и остановка сервера.\n")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
