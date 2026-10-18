"""Small same-process loopback client. Tokens are kept in memory only."""
import json
import mimetypes
import secrets
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, ProxyHandler


class ApiError(Exception):
    def __init__(self, message, status=0):
        super().__init__(message)
        self.status = status


class Client:
    def __init__(self, base_url, key):
        self.base_url = base_url
        self.key = key
        self.token = None
        self.user = None
        # Local requests must never be forwarded through a system proxy.
        self.opener = build_opener(ProxyHandler({}))

    def request(self, method, path, data=None, *, raw=False, content_type=None):
        headers = {"X-Oblivion-Key": self.key}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if isinstance(data, dict):
            data = json.dumps(data, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if content_type:
            headers["Content-Type"] = content_type
        request = Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=45) as response:
                body = response.read()
            return body if raw else json.loads(body) if body else None
        except HTTPError as error:
            try:
                detail = json.loads(error.read()).get("detail", "Не удалось выполнить операцию.")
                if isinstance(detail, list):
                    detail = "Проверьте заполнение полей. " + "; ".join(str(item.get("msg", "")) for item in detail)
            except (ValueError, AttributeError):
                detail = "Не удалось выполнить операцию."
            raise ApiError(str(detail), error.code) from error
        except (URLError, TimeoutError, OSError) as error:
            raise ApiError("Локальная служба недоступна. Перезапустите приложение.") from error

    def authenticate(self, mode, email, password):
        result = self.request("POST", f"/auth/{mode}", {"email": email.strip(), "password": password})
        self.token = result["session_token"]
        self.user = result["user"]
        return result

    def logout(self):
        try:
            self.request("POST", "/auth/logout")
        finally:
            self.token = self.user = None

    def upload(self, path, name, expires_at, action):
        path = Path(path)
        return self.upload_bytes(path.name, path.read_bytes(), name, expires_at, action)

    def upload_bytes(self, filename, content, name, expires_at, action):
        boundary = "OblivionDoc" + secrets.token_hex(16)
        chunks = []
        for field, value in {"name": name, "expires_at": expires_at, "action": action}.items():
            chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"\r\n\r\n{value}\r\n'.encode("utf-8"))
        safe_filename = Path(filename).name.replace('"', "_").replace("\r", "").replace("\n", "")
        mime = mimetypes.guess_type(safe_filename)[0] or "application/octet-stream"
        chunks.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{safe_filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode("utf-8"))
        chunks.extend([content, f"\r\n--{boundary}--\r\n".encode()])
        return self.request("POST", "/documents/upload", b"".join(chunks), content_type=f"multipart/form-data; boundary={boundary}")
