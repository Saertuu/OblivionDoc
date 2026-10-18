import hashlib
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from backend.database import SessionLocal
from backend.main import process_expired_documents
from backend.models import Document, User


def register(client, email="user@example.org", password="Correct-password-321"):
    result = client.post("/auth/register", json={"email": email, "password": password})
    assert result.status_code == 200, result.text
    token = result.json()["session_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return result.json()


def upload(client, name="Тестовый приказ", *, content=b"original document bytes", filename="document.txt", action="archive", expires=None):
    return client.post("/documents/upload", data={"name": name, "action": action, "expires_at": (expires or datetime.now(timezone.utc) + timedelta(days=10)).isoformat()}, files={"file": (filename, content, "text/plain")})


def test_passwords_duplicates_and_logout(client):
    account = register(client, "USER@example.org")
    assert client.get("/documents").json() == []
    assert client.get("/audit-log").json() == []
    with SessionLocal() as db:
        user = db.query(User).one()
        assert user.email == "user@example.org"
        assert user.password_hash.startswith("scrypt$")
        assert "Correct-password" not in user.password_hash
        assert user.session_token == hashlib.sha256(account["session_token"].encode()).hexdigest()
    assert client.post("/auth/register", json={"email": "user@example.org", "password": "Other-password-321"}).status_code == 400
    assert client.post("/auth/login", json={"email": "user@example.org", "password": "wrong-password"}).status_code == 401
    assert client.post("/auth/logout").status_code == 200
    assert client.get("/documents").status_code == 401
    assert client.post("/auth/login", json={"email": "USER@example.org", "password": "Correct-password-321"}).status_code == 200


def test_accounts_cannot_read_modify_delete_or_export_each_others_files(client):
    register(client)
    own = upload(client).json()
    register(client, "other@example.org")
    assert client.get("/documents").json() == []
    assert client.get("/audit-log").json() == []
    assert client.get(f'/documents/{own["id"]}/download').status_code == 404
    assert client.delete(f'/documents/{own["id"]}').status_code == 404
    assert client.put(f'/documents/{own["id"]}', json={"name": "Stolen", "expires_at": "2030-01-01T12:00:00Z", "action": "archive"}).status_code == 404
    with ZipFile(BytesIO(client.get("/exports/documents.xlsx").content)) as archive:
        assert "Тестовый приказ" not in archive.read("xl/worksheets/sheet1.xml").decode()


def test_upload_download_edit_delete_and_audit(client):
    register(client)
    content = "Настоящие байты документа ✓".encode()
    response = upload(client, filename="приказ.txt", content=content)
    assert response.status_code == 200, response.text
    doc = response.json()
    assert client.get(f'/documents/{doc["id"]}/download').content == content
    # The database copy remains usable if a cache file disappears.
    Path(doc["file_path"]).unlink()
    assert client.get(f'/documents/{doc["id"]}/download').content == content
    edited = client.put(f'/documents/{doc["id"]}', json={"name": "Новое название", "expires_at": "2030-01-01T12:00:00Z", "action": "archive"})
    assert edited.status_code == 200
    assert edited.json()["name"] == "Новое название"
    assert client.delete(f'/documents/{doc["id"]}').status_code == 200
    assert client.get(f'/documents/{doc["id"]}/download').status_code == 404
    assert [row["action"] for row in client.get("/audit-log").json()] == ["delete", "update", "create"]
    with SessionLocal() as db:
        stored = db.get(Document, doc["id"])
        assert stored.file_content is None and stored.status == "deleted"


def test_rejects_empty_unsupported_oversize_and_missing_name(client):
    register(client)
    assert upload(client, content=b"").status_code == 400
    assert upload(client, filename="file.exe").status_code == 400
    assert upload(client, content=b"x" * (10 * 1024 * 1024 + 1)).status_code == 400
    assert upload(client, name="   ").status_code == 422
    assert client.get("/documents").json() == []


def test_retention_archives_or_deletes_and_preserves_history(client):
    register(client)
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    archived = upload(client, "Архивный", expires=past).json()
    deleted = upload(client, "Удалённый", expires=past, action="delete").json()
    process_expired_documents()
    documents = {d["id"]: d for d in client.get("/documents").json()}
    assert documents[archived["id"]]["status"] == "archived"
    assert documents[deleted["id"]]["status"] == "deleted"
    assert client.get(f'/documents/{archived["id"]}/download').content == b"original document bytes"
    assert client.get(f'/documents/{deleted["id"]}/download').status_code == 404
    assert len(client.get("/audit-log").json()) == 4
    process_expired_documents()
    assert len(client.get("/audit-log").json()) == 4


def test_edit_to_expired_delete_removes_file_and_cannot_be_undone(client):
    register(client)
    doc = upload(client).json()
    result = client.put(f'/documents/{doc["id"]}', json={"name": "Удаление по сроку", "expires_at": "2020-01-01T00:00:00Z", "action": "delete"})
    assert result.status_code == 200
    assert result.json()["status"] == "deleted"
    assert not Path(doc["file_path"]).exists()
    assert client.get(f'/documents/{doc["id"]}/download').status_code == 404
    assert client.put(f'/documents/{doc["id"]}', json={"name": "Вернуть", "expires_at": "2030-01-01T00:00:00Z", "action": "archive"}).status_code == 409


def test_profile_organization_and_excel_exports(client):
    register(client)
    assert client.put("/profile", json={"first_name": "Анна", "last_name": "Пример"}).status_code == 200
    assert client.get("/profile").json()["first_name"] == "Анна"
    settings = {"organization_name": "Учебный центр", "subdivision": "Архив", "responsible_person": "Анна", "retention_policy": "По номенклатуре"}
    assert client.put("/settings/organization", json=settings).status_code == 200
    assert client.get("/settings/organization").json() == settings
    upload(client, name="=1+1")
    for kind in ["documents", "audit"]:
        response = client.get(f"/exports/{kind}.xlsx")
        assert response.status_code == 200
        with ZipFile(BytesIO(response.content)) as archive:
            sheet = archive.read("xl/worksheets/sheet1.xml").decode()
            assert 't="inlineStr"' in sheet and "=1+1" in sheet
            assert "<f>" not in sheet


def test_requests_from_other_local_clients_require_the_launch_key(client):
    assert client.get("/health", headers={"X-Oblivion-Key": "wrong-key"}).status_code == 403
