"""Native Windows interface: no browser, external assets or WebView installation."""
import json
import os
import queue
import subprocess
import sys
import tempfile
import threading
import tkinter as tk
from datetime import datetime, timedelta
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from .client import ApiError

BG = "#F4F6F1"
PANEL = "#FFFFFF"
TEXT = "#20392D"
MUTED = "#637367"
GREEN = "#285B45"
DARK = "#183B2D"
ACCENT = "#D6EDAB"
STATUS = {"active": "На хранении", "archived": "В архиве", "deleted": "Удалён"}
ACTIONS = {"archive": "Архивировать", "delete": "Удалить по сроку"}
AUDIT = {"create": "Добавлен", "update": "Изменён", "delete": "Удалён", "archive": "Архивирован", "auto_delete": "Удалён по сроку", "auto_archive": "Архивирован по сроку"}


def date_text(value):
    if not value:
        return "—"
    try:
        return datetime.fromisoformat(value).replace(tzinfo=__import__("datetime").timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M")
    except ValueError:
        return str(value)


def open_path(path):
    if sys.platform == "win32":
        os.startfile(str(path))
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


class Window:
    def __init__(self, root, api, data_dir, on_close):
        self.root, self.api, self.data_dir = root, api, data_dir
        self.on_close = on_close
        self.busy = False
        self.closed = False
        self.events = queue.Queue()
        self.documents = []
        self.page = "documents"
        self.preview_dir = tempfile.TemporaryDirectory(prefix="OblivionDoc-preview-")
        self.preferences_file = data_dir / "preferences.json"
        try:
            self.preferences = json.loads(self.preferences_file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.preferences = {}
        root.title("OblivionDoc — электронный архив")
        root.geometry("1180x760")
        root.minsize(920, 640)
        root.configure(bg=BG)
        root.option_add("*Font", ("Segoe UI", 10))
        root.protocol("WM_DELETE_WINDOW", self.close)
        style = ttk.Style(root)
        style.theme_use("clam")
        style.configure("TFrame", background=BG)
        style.configure("Card.TFrame", background=PANEL)
        style.configure("TLabel", background=BG, foreground=TEXT, font=("Segoe UI", 10))
        style.configure("Card.TLabel", background=PANEL)
        style.configure("Muted.TLabel", foreground=MUTED)
        style.configure("Title.TLabel", font=("Segoe UI", 24, "bold"))
        style.configure("Subtitle.TLabel", font=("Segoe UI", 12), foreground=MUTED)
        style.configure("TButton", padding=(13, 9), background=PANEL, foreground=TEXT, borderwidth=1)
        style.map("TButton", background=[("active", "#E5EDDF")])
        style.configure("Primary.TButton", background=GREEN, foreground="white", borderwidth=0)
        style.map("Primary.TButton", background=[("active", DARK), ("disabled", "#7C9582")], foreground=[("disabled", "white")])
        style.configure("Danger.TButton", foreground="#A23C32")
        style.configure("TEntry", padding=9, fieldbackground=PANEL)
        style.configure("TCombobox", padding=7, fieldbackground=PANEL)
        style.configure("Treeview", rowheight=37, background=PANEL, fieldbackground=PANEL, foreground=TEXT, borderwidth=0)
        style.configure("Treeview.Heading", font=("Segoe UI", 10, "bold"), padding=(10, 11), background="#E9EFDF", foreground=TEXT)
        style.map("Treeview", background=[("selected", "#D9EACB")], foreground=[("selected", TEXT)])
        self.status = tk.StringVar(value="Все изменения сохраняются на этом компьютере")
        self.show_login()
        root.after(50, self.drain)
        root.after(15000, self.periodic_refresh)

    def clear(self):
        for child in self.root.winfo_children():
            child.destroy()

    def run(self, task, success=None):
        if self.busy or self.closed:
            return
        self.busy = True
        self.root.configure(cursor="watch")
        self.status.set("Выполняется…")
        def work():
            try:
                self.events.put((True, task(), success))
            except Exception as error:
                self.events.put((False, error, None))
        threading.Thread(target=work, daemon=True).start()

    def drain(self):
        if self.closed:
            return
        try:
            ok, result, success = self.events.get_nowait()
            self.busy = False
            self.root.configure(cursor="")
            if ok:
                self.status.set("Сохранено на этом компьютере")
                if success:
                    success(result)
            else:
                self.status.set("Операция не выполнена")
                if isinstance(result, ApiError) and result.status == 401 and self.api.user:
                    self.api.token = self.api.user = None
                    self.show_login()
                messagebox.showerror("OblivionDoc", str(result), parent=self.root)
        except queue.Empty:
            pass
        self.root.after(50, self.drain)

    def save_preferences(self):
        temp = self.preferences_file.with_suffix(".tmp")
        try:
            temp.write_text(json.dumps(self.preferences, ensure_ascii=False), encoding="utf-8")
            temp.replace(self.preferences_file)
        except OSError:
            self.status.set("Не удалось сохранить настройки интерфейса")

    def show_login(self, register=False):
        self.clear()
        self.root.geometry("1060x720")
        story = tk.Frame(self.root, bg=DARK, width=390)
        story.pack(side="left", fill="y")
        story.pack_propagate(False)
        tk.Label(story, text="O / OblivionDoc", bg=DARK, fg=ACCENT, font=("Segoe UI", 21, "bold")).pack(anchor="w", padx=36, pady=(45, 70))
        tk.Label(story, text="Важное —\nна своём месте.", bg=DARK, fg="white", justify="left", font=("Segoe UI", 31, "bold")).pack(anchor="w", padx=36)
        tk.Label(story, text="Документы, сроки хранения\nи история действий.\n\nВаш архив на вашем компьютере.", bg=DARK, fg="#CDDDCC", justify="left", font=("Segoe UI", 12), pady=30).pack(anchor="w", padx=36)
        tk.Label(story, text="WINDOWS / ЛОКАЛЬНОЕ ПРИЛОЖЕНИЕ", bg=DARK, fg=ACCENT, font=("Segoe UI", 9)).pack(side="bottom", anchor="w", padx=36, pady=32)
        area = ttk.Frame(self.root, padding=(48, 36))
        area.pack(side="left", fill="both", expand=True)
        ttk.Label(area, text="Создать аккаунт" if register else "С возвращением", style="Title.TLabel").pack(anchor="w", pady=(36, 12))
        ttk.Label(area, text="Начните с пустого личного архива." if register else "Войдите в сохранённый аккаунт.", style="Subtitle.TLabel").pack(anchor="w", pady=(0, 26))
        email = tk.StringVar(value=self.preferences.get("email", ""))
        password, confirmation = tk.StringVar(), tk.StringVar()
        def field(label, variable, secret=False):
            ttk.Label(area, text=label).pack(anchor="w", pady=(8, 6))
            entry = ttk.Entry(area, textvariable=variable, show="●" if secret else "")
            entry.pack(fill="x", pady=(0, 8))
            return entry
        email_entry = field("Электронная почта", email)
        field("Пароль — от 8 символов" if register else "Пароль", password, True)
        if register:
            field("Повторите пароль", confirmation, True)
        def submit():
            if not email.get().strip() or not password.get():
                messagebox.showinfo("Заполните поля", "Укажите почту и пароль.", parent=self.root)
                return
            if register and password.get() != confirmation.get():
                messagebox.showerror("Пароли не совпадают", "Повторите пароль ещё раз.", parent=self.root)
                return
            def done(_):
                self.preferences["email"] = email.get().strip().lower()
                self.save_preferences()
                password.set("")
                confirmation.set("")
                self.show_workspace()
            email_value, password_value = email.get(), password.get()
            self.run(lambda: self.api.authenticate("register" if register else "login", email_value, password_value), done)
        ttk.Button(area, text="Создать аккаунт" if register else "Войти", style="Primary.TButton", command=submit).pack(fill="x", pady=(18, 12))
        ttk.Button(area, text="Уже есть аккаунт? Войти" if register else "Нет аккаунта? Зарегистрироваться", command=lambda: self.show_login(not register) if not self.busy else None).pack(fill="x")
        ttk.Label(area, text="Почта используется как логин. Интернет не требуется.\nПароли хранятся в виде хешей scrypt.\nАккаунты и файлы не загружаются на сайт.", style="Muted.TLabel", justify="left").pack(anchor="w", pady=24)
        ttk.Label(area, textvariable=self.status, style="Muted.TLabel", wraplength=440).pack(side="bottom", anchor="w")
        email_entry.focus_set()
        self.root.bind("<Return>", lambda _: submit())

    def show_workspace(self):
        self.root.unbind("<Return>")
        self.clear()
        self.root.geometry("1180x760")
        sidebar = tk.Frame(self.root, bg=DARK, width=228)
        sidebar.pack(side="left", fill="y")
        sidebar.pack_propagate(False)
        tk.Label(sidebar, text="O / OblivionDoc", bg=DARK, fg=ACCENT, font=("Segoe UI", 18, "bold")).pack(anchor="w", padx=22, pady=(30, 38))
        tk.Label(sidebar, text="РАБОЧЕЕ ПРОСТРАНСТВО", bg=DARK, fg="#9CB49D", font=("Segoe UI", 8, "bold")).pack(anchor="w", padx=22, pady=(0, 15))
        self.nav_buttons = {}
        for value, label in [("documents", "Все документы"), ("archive", "Архив"), ("audit", "Журнал действий"), ("settings", "Профиль и настройки")]:
            button = tk.Button(sidebar, text=label, anchor="w", relief="flat", bd=0, bg=DARK, fg="white", activebackground=ACCENT, activeforeground=TEXT, padx=18, pady=13, cursor="hand2", command=lambda v=value: self.navigate(v))
            button.pack(fill="x", padx=12, pady=3)
            self.nav_buttons[value] = button
        ttk.Button(sidebar, text="Выйти из аккаунта", command=self.logout).pack(side="bottom", fill="x", padx=18, pady=(10, 26))
        tk.Label(sidebar, text=self.api.user["email"], bg=DARK, fg="#CDDDCC", wraplength=190, justify="left").pack(side="bottom", anchor="w", padx=22, pady=12)
        self.main = ttk.Frame(self.root, padding=(26, 24))
        self.main.pack(fill="both", expand=True)
        ttk.Label(self.root, textvariable=self.status, style="Muted.TLabel", padding=(12, 5)).pack(side="bottom", fill="x")
        self.navigate("documents")

    def navigate(self, page):
        if self.busy:
            return
        self.page = page
        for key, button in self.nav_buttons.items():
            button.configure(bg=ACCENT if key == page else DARK, fg=TEXT if key == page else "white")
        for child in self.main.winfo_children():
            child.destroy()
        if page == "settings":
            self.run(lambda: (self.api.request("GET", "/profile"), self.api.request("GET", "/settings/organization")), self.render_settings)
        elif page == "audit":
            self.run(lambda: self.api.request("GET", "/audit-log"), self.render_audit)
        else:
            self.render_documents()
            self.refresh()

    def render_documents(self):
        ttk.Label(self.main, text="Архив" if self.page == "archive" else "Архив документов", style="Title.TLabel").pack(anchor="w", pady=(0, 6))
        ttk.Label(self.main, text="Порядок в документах начинается здесь.", style="Subtitle.TLabel").pack(anchor="w", pady=(0, 23))
        toolbar = ttk.Frame(self.main)
        toolbar.pack(fill="x", pady=(0, 16))
        ttk.Button(toolbar, text="+ Добавить документ", style="Primary.TButton", command=lambda: self.edit_document()).pack(side="left")
        ttk.Button(toolbar, text="Экспорт XLSX", command=lambda: self.export("documents")).pack(side="right")
        ttk.Button(toolbar, text="Обновить", command=self.refresh).pack(side="right", padx=8)
        filters = ttk.Frame(self.main)
        filters.pack(fill="x", pady=(0, 12))
        self.search = tk.StringVar()
        search = ttk.Entry(filters, textvariable=self.search)
        search.pack(side="left", fill="x", expand=True)
        ttk.Label(filters, text=" Поиск по названию или имени файла", style="Muted.TLabel").pack(side="left")
        self.search.trace_add("write", lambda *_: self.filter_documents())
        holder = ttk.Frame(self.main)
        holder.pack(fill="both", expand=True)
        columns = ("name", "file", "expires", "status", "action")
        self.tree = ttk.Treeview(holder, columns=columns, show="headings", selectmode="browse")
        for name, label, width in [("name", "Документ", 270), ("file", "Файл", 150), ("expires", "Срок хранения", 140), ("status", "Статус", 110), ("action", "По окончании срока", 150)]:
            self.tree.heading(name, text=label)
            self.tree.column(name, width=width, minwidth=90, stretch=name in ("name", "file"))
        scroll = ttk.Scrollbar(holder, orient="vertical", command=self.tree.yview)
        horizontal = ttk.Scrollbar(holder, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=scroll.set, xscrollcommand=horizontal.set)
        holder.rowconfigure(0, weight=1)
        holder.columnconfigure(0, weight=1)
        self.tree.grid(row=0, column=0, sticky="nsew")
        scroll.grid(row=0, column=1, sticky="ns")
        horizontal.grid(row=1, column=0, sticky="ew")
        self.tree.bind("<Double-1>", lambda _: self.open_document())
        self.count = tk.StringVar(value="Загрузка…")
        ttk.Label(self.main, textvariable=self.count, style="Muted.TLabel").pack(anchor="w", pady=12)
        actions = ttk.Frame(self.main)
        actions.pack(fill="x")
        for label, command in [("Открыть", self.open_document), ("Сохранить файл…", self.download), ("Изменить", self.edit_selected), ("Удалить", self.delete)]:
            ttk.Button(actions, text=label, style="Danger.TButton" if label == "Удалить" else "TButton", command=command).pack(side="left", padx=(0, 8))

    def refresh(self):
        if self.page not in ("documents", "archive") or self.busy:
            return
        self.run(lambda: self.api.request("GET", "/documents"), self.set_documents)

    def set_documents(self, documents):
        self.documents = documents
        if self.page in ("documents", "archive"):
            self.filter_documents()

    def filter_documents(self):
        previous = self.tree.selection()
        self.tree.delete(*self.tree.get_children())
        query = self.search.get().casefold().strip()
        visible = [d for d in self.documents if d["status"] != "deleted" and (self.page != "archive" or d["status"] == "archived") and (not query or query in (d["name"] + " " + (d["file_name"] or "")).casefold())]
        for d in visible:
            self.tree.insert("", "end", iid=str(d["id"]), values=(d["name"], d["file_name"] or "—", date_text(d["expires_at"]), STATUS.get(d["status"], d["status"]), ACTIONS.get(d["action"], d["action"])))
        if previous and self.tree.exists(previous[0]):
            self.tree.selection_set(previous[0])
        self.count.set(f"Документов: {len(visible)}" if visible else "Пока пусто. Добавьте первый документ." if not query else "По вашему запросу ничего не найдено.")

    def selected(self):
        selection = self.tree.selection()
        if not selection:
            messagebox.showinfo("Выберите документ", "Нажмите на документ в списке.", parent=self.root)
            return None
        return next((d for d in self.documents if str(d["id"]) == selection[0]), None)

    def edit_selected(self):
        document = self.selected()
        if document:
            self.edit_document(document)

    def edit_document(self, document=None):
        if self.busy:
            return
        # A selection-less Edit must not create a new record.
        dialog = tk.Toplevel(self.root)
        dialog.title("Изменить документ" if document else "Добавить документ")
        dialog.geometry("600x510")
        dialog.resizable(False, False)
        dialog.configure(bg=BG)
        dialog.transient(self.root)
        dialog.grab_set()
        frame = ttk.Frame(dialog, padding=26)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Карточка документа", font=("Segoe UI", 19, "bold")).pack(anchor="w", pady=(0, 20))
        name = tk.StringVar(value=document["name"] if document else "")
        expiry = tk.StringVar(value=date_text(document["expires_at"]) if document else (datetime.now() + timedelta(days=365)).strftime("%d.%m.%Y %H:%M"))
        action = tk.StringVar(value=ACTIONS[document["action"]] if document else ACTIONS["archive"])
        file_path = tk.StringVar()
        for label, variable in [("Название документа", name), ("Хранить до · ДД.ММ.ГГГГ ЧЧ:ММ", expiry)]:
            ttk.Label(frame, text=label).pack(anchor="w", pady=(8, 5))
            ttk.Entry(frame, textvariable=variable).pack(fill="x")
        ttk.Label(frame, text="После окончания срока").pack(anchor="w", pady=(16, 5))
        ttk.Combobox(frame, textvariable=action, values=list(ACTIONS.values()), state="readonly").pack(fill="x")
        if not document:
            def choose():
                value = filedialog.askopenfilename(parent=dialog, title="Выберите документ", filetypes=[("Документы", "*.pdf *.doc *.docx *.txt *.png *.jpg *.jpeg"), ("Все файлы", "*.*")])
                if value:
                    file_path.set(value)
                    if not name.get().strip():
                        name.set(Path(value).stem)
            ttk.Button(frame, text="Выбрать файл…", command=choose).pack(anchor="w", pady=(18, 6))
            ttk.Label(frame, textvariable=file_path, style="Muted.TLabel", wraplength=530).pack(anchor="w")
        ttk.Label(frame, text="До 10 МБ. Автоматическая обработка выполняется,\nпока приложение открыто. Удаление по сроку необратимо.", style="Muted.TLabel").pack(anchor="w", pady=18)
        def save():
            try:
                title = name.get().strip()
                if not title or len(title) > 180:
                    raise ValueError("Укажите название: от 1 до 180 символов.")
                expires = datetime.strptime(expiry.get().strip(), "%d.%m.%Y %H:%M").astimezone().isoformat()
                operation = next(k for k, v in ACTIONS.items() if v == action.get())
                if operation == "delete" and not messagebox.askyesno("Удаление по сроку", "После указанного срока файл будет удалён без восстановления. Сохранить такое правило?", parent=dialog):
                    return
                if not document:
                    if not file_path.get():
                        raise ValueError("Прикрепите файл документа.")
                    path = Path(file_path.get())
                    if not path.is_file() or path.stat().st_size == 0 or path.stat().st_size > 10 * 1024 * 1024:
                        raise ValueError("Выберите непустой файл размером до 10 МБ.")
                    task = lambda: self.api.upload(path, title, expires, operation)
                else:
                    task = lambda: self.api.request("PUT", f'/documents/{document["id"]}', {"name": title, "expires_at": expires, "action": operation})
                self.run(task, lambda _: (dialog.destroy(), self.refresh()))
            except (ValueError, OSError) as error:
                messagebox.showerror("Проверьте карточку", str(error), parent=dialog)
        buttons = ttk.Frame(frame)
        buttons.pack(side="bottom", fill="x")
        ttk.Button(buttons, text="Сохранить", style="Primary.TButton", command=save).pack(side="right")
        ttk.Button(buttons, text="Отмена", command=lambda: dialog.destroy() if not self.busy else None).pack(side="right", padx=8)
        dialog.protocol("WM_DELETE_WINDOW", lambda: dialog.destroy() if not self.busy else None)

    def download(self):
        document = self.selected()
        if not document or self.busy:
            return
        target = filedialog.asksaveasfilename(parent=self.root, title="Сохранить файл", initialfile=document["file_name"] or document["name"])
        if target:
            self.run(lambda: self.write_download(document, Path(target)), lambda _: self.status.set("Файл сохранён: " + target))

    def write_download(self, document, target):
        content = self.api.request("GET", f'/documents/{document["id"]}/download', raw=True)
        temp = target.with_name(target.name + ".obliviondoc.tmp")
        try:
            temp.write_bytes(content)
            temp.replace(target)
        finally:
            temp.unlink(missing_ok=True)
        return target

    def open_document(self):
        document = self.selected()
        if not document or self.busy:
            return
        filename = Path(document["file_name"] or "document.txt").name
        target = Path(self.preview_dir.name) / str(document["id"]) / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        self.run(lambda: self.write_download(document, target), lambda path: open_path(path))

    def delete(self):
        document = self.selected()
        if not document or self.busy:
            return
        if messagebox.askyesno("Удалить документ?", f'«{document["name"]}» и файл будут удалены. Запись в журнале сохранится.', parent=self.root):
            self.run(lambda: self.api.request("DELETE", f'/documents/{document["id"]}'), lambda _: self.refresh())

    def export(self, kind):
        if self.busy:
            return
        target = filedialog.asksaveasfilename(parent=self.root, title="Экспорт в Excel", initialfile=f"OblivionDoc-{kind}.xlsx", defaultextension=".xlsx", filetypes=[("Excel", "*.xlsx")])
        if target:
            def save():
                content = self.api.request("GET", f"/exports/{kind}.xlsx", raw=True)
                Path(target).write_bytes(content)
            self.run(save, lambda _: self.status.set("Таблица сохранена: " + target))

    def render_audit(self, logs):
        ttk.Label(self.main, text="Журнал действий", style="Title.TLabel").pack(anchor="w", pady=(0, 12))
        ttk.Label(self.main, text="История операций вашего аккаунта.", style="Subtitle.TLabel").pack(anchor="w", pady=(0, 22))
        ttk.Button(self.main, text="Экспорт XLSX", command=lambda: self.export("audit")).pack(anchor="e", pady=(0, 15))
        holder = ttk.Frame(self.main)
        holder.pack(fill="both", expand=True)
        tree = ttk.Treeview(holder, columns=("date", "name", "action", "result"), show="headings")
        for key, label, width in [("date", "Дата и время", 160), ("name", "Документ", 310), ("action", "Действие", 150), ("result", "Результат", 160)]:
            tree.heading(key, text=label)
            tree.column(key, width=width, minwidth=80)
        scrollbar = ttk.Scrollbar(holder, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        tree.pack(fill="both", expand=True)
        for log in logs:
            result = "Выполнено" if log["result"].startswith("success") else "Ошибка обработки"
            tree.insert("", "end", values=(date_text(log["created_at"]), log["document_name"], AUDIT.get(log["action"], log["action"]), result))
        ttk.Label(self.main, text=f"Записей: {len(logs)}", style="Muted.TLabel").pack(anchor="w", pady=12)

    def render_settings(self, result):
        profile, organization = result
        ttk.Label(self.main, text="Профиль и настройки", style="Title.TLabel").pack(anchor="w", pady=(0, 20))
        form = ttk.Frame(self.main)
        form.pack(fill="x")
        fields = {}
        definitions = [("first_name", "Имя", profile), ("last_name", "Фамилия", profile), ("organization_name", "Организация", organization), ("subdivision", "Подразделение", organization), ("responsible_person", "Ответственный за документы", organization), ("retention_policy", "Правила хранения", organization)]
        for index, (key, label, source) in enumerate(definitions):
            row, col = divmod(index, 2)
            group = ttk.Frame(form, padding=(0, 0, 18, 14))
            group.grid(row=row, column=col, sticky="ew")
            ttk.Label(group, text=label).pack(anchor="w", pady=(0, 5))
            fields[key] = tk.StringVar(value=source.get(key, ""))
            ttk.Entry(group, textvariable=fields[key]).pack(fill="x")
        form.columnconfigure(0, weight=1)
        form.columnconfigure(1, weight=1)
        def save():
            values = {key: variable.get() for key, variable in fields.items()}
            def task():
                self.api.request("PUT", "/settings/organization", {k: values[k] for k in organization})
                self.api.request("PUT", "/profile", {"first_name": values["first_name"], "last_name": values["last_name"]})
            self.run(task, lambda _: self.status.set("Профиль и настройки организации сохранены"))
        ttk.Button(self.main, text="Сохранить изменения", style="Primary.TButton", command=save).pack(anchor="w", pady=(0, 25))
        ttk.Separator(self.main).pack(fill="x", pady=8)
        ttk.Label(self.main, text="Хранилище на этом компьютере", font=("Segoe UI", 13, "bold")).pack(anchor="w", pady=12)
        ttk.Label(self.main, text=str(self.data_dir), style="Muted.TLabel", wraplength=720).pack(anchor="w")
        ttk.Button(self.main, text="Открыть папку данных", command=lambda: open_path(self.data_dir)).pack(anchor="w", pady=12)
        ttk.Label(self.main, text="База, файлы и аккаунты сохраняются после закрытия приложения.\nДля резервной копии закройте приложение и скопируйте всю папку данных.\nСроки проверяются раз в минуту, пока окно открыто.\nВосстановление пароля по почте в автономной версии не настроено.", style="Muted.TLabel", wraplength=760).pack(anchor="w", pady=12)

    def logout(self):
        if not self.busy:
            self.run(self.api.logout, lambda _: self.show_login())

    def periodic_refresh(self):
        if self.closed:
            return
        if self.api.user and self.page in ("documents", "archive") and not self.busy and not any(isinstance(child, tk.Toplevel) for child in self.root.winfo_children()):
            self.refresh()
        self.root.after(15000, self.periodic_refresh)

    def close(self):
        if self.busy:
            messagebox.showinfo("Подождите", "Дождитесь завершения текущей операции.", parent=self.root)
            return
        self.closed = True
        self.on_close()
        self.root.destroy()
        try:
            self.preview_dir.cleanup()
        except OSError:
            pass
