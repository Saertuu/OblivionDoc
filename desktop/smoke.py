"""End-to-end checks executed against the actual frozen Windows executable."""
import json
from datetime import datetime, timedelta, timezone
from io import BytesIO
from zipfile import ZipFile
from .client import ApiError

EMAIL = "windows-build-check@example.invalid"
PASSWORD = "Build-check-Only-4815"
CONTENT = "OblivionDoc: проверка сохранения исходного файла.\n".encode("utf-8")


def run(api, phase, report_path, data_dir, with_ui=True):
    checks = []
    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        checks.append(name)
    check("database_connected", api.request("GET", "/health")["database"] == "connected")
    if phase == "create":
        api.authenticate("register", EMAIL, PASSWORD)
        check("new_account_is_empty", api.request("GET", "/documents") == [])
        check("new_audit_is_empty", api.request("GET", "/audit-log") == [])
        expires = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        doc = api.upload_bytes("проверка.txt", CONTENT, "Проверка Windows EXE", expires, "archive")
        check("original_bytes_downloaded", api.request("GET", f'/documents/{doc["id"]}/download', raw=True) == CONTENT)
        try:
            api.authenticate("register", EMAIL.upper(), "Another-password-451")
            raise AssertionError("duplicate_account_accepted")
        except ApiError as error:
            check("duplicate_account_rejected", error.status == 400)
        api.logout()
        try:
            api.authenticate("login", EMAIL, "incorrect-password")
            raise AssertionError("wrong_password_accepted")
        except ApiError as error:
            check("wrong_password_rejected", error.status == 401)
        api.authenticate("register", "second-build@example.invalid", "Second-check-4815")
        check("second_account_is_empty", api.request("GET", "/documents") == [])
        try:
            api.request("GET", f'/documents/{doc["id"]}/download', raw=True)
            raise AssertionError("other_account_file_accessible")
        except ApiError as error:
            check("cross_account_access_rejected", error.status == 404)
        api.logout()
    else:
        api.authenticate("login", EMAIL, PASSWORD)
        documents = api.request("GET", "/documents")
        check("account_and_metadata_survive_restart", len(documents) == 1 and documents[0]["name"] == "Проверка Windows EXE")
        check("file_survives_restart", api.request("GET", f'/documents/{documents[0]["id"]}/download', raw=True) == CONTENT)
        for kind in ["documents", "audit"]:
            with ZipFile(BytesIO(api.request("GET", f"/exports/{kind}.xlsx", raw=True))) as archive:
                check(f"{kind}_xlsx_export", "xl/worksheets/sheet1.xml" in archive.namelist())
        check("audit_persisted", len(api.request("GET", "/audit-log")) >= 1)
    if with_ui:
        import tkinter as tk
        from .window import Window
        root = tk.Tk()
        root.withdraw()
        window = Window(root, api, data_dir, lambda: None)
        root.update_idletasks()
        check("native_window_and_tcl_loaded", bool(root.winfo_exists()))
        if api.user:
            # Construct the workspace without starting an asynchronous request.
            real_navigate = window.navigate
            window.navigate = lambda page: None
            window.show_workspace()
            window.navigate = real_navigate
            window.render_documents()
            window.set_documents(api.request("GET", "/documents"))
            root.update_idletasks()
            check("native_document_table_loaded", window.tree.winfo_exists())
            window.tree.destroy()
        window.closed = True
        root.destroy()
        window.preview_dir.cleanup()
    report_path.write_text(json.dumps({"ok": True, "phase": phase, "checks": checks}, ensure_ascii=False, indent=2), encoding="utf-8")
