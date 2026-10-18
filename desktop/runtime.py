"""Start the uploaded API on a private loopback socket and stop it with the window."""
import os
import secrets
import socket
import threading
import time
import uvicorn
from .client import Client


class Runtime:
    def __init__(self):
        os.environ["OBLIVION_DESKTOP_KEY"] = secrets.token_urlsafe(32)
        from backend.main import app, DESKTOP_KEY
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.bind(("127.0.0.1", 0))
        self.socket.listen(128)
        port = self.socket.getsockname()[1]
        self.client = Client(f"http://127.0.0.1:{port}", DESKTOP_KEY)
        self.server = uvicorn.Server(uvicorn.Config(
            app, host="127.0.0.1", port=port, log_config=None,
            access_log=False, loop="asyncio", http="h11", ws="none",
        ))
        self.thread = threading.Thread(target=self.server.run, kwargs={"sockets": [self.socket]}, daemon=True)

    def start(self):
        self.thread.start()
        deadline = time.monotonic() + 30
        while not self.server.started:
            if not self.thread.is_alive() or time.monotonic() >= deadline:
                self.close()
                raise RuntimeError("Не удалось запустить локальную службу OblivionDoc.")
            time.sleep(0.05)
        self.client.request("GET", "/health")
        return self.client

    def close(self):
        self.server.should_exit = True
        if self.thread.is_alive():
            self.thread.join(timeout=10)
        self.socket.close()
