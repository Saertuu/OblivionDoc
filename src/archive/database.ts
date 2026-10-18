import {
  CATEGORIES,
  DEPARTMENTS,
  ROLES,
  canEdit,
  visibleTo,
  type ArchiveDocument,
  type AuditAction,
  type AuditEvent,
  type DocumentInput,
  type Role,
  type Snapshot,
} from "./types";
import { offsetDate, today } from "./format";

const NAME = "obliviondoc-archive";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);
let connection: Promise<IDBDatabase> | undefined;
function open() {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(
          new Error(
            "Браузер не поддерживает локальное хранилище. Откройте сайт в современном браузере.",
          ),
        );
        return;
      }
      const request = indexedDB.open(NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("documents", { keyPath: "id" });
        db.createObjectStore("files", { keyPath: "id" });
        db.createObjectStore("events", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("meta", { keyPath: "id" });
      };
      request.onerror = () => {
        connection = undefined;
        reject(
          new Error(
            "Не удалось открыть локальное хранилище. Проверьте настройки браузера.",
          ),
        );
      };
      request.onblocked = () => {
        connection = undefined;
        reject(
          new Error("Закройте другие вкладки OblivionDoc и повторите попытку."),
        );
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
    });
  return connection;
}
function complete(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(
        tx.error?.name === "QuotaExceededError"
          ? new Error(
              "В браузере недостаточно свободного места. Файл не сохранён.",
            )
          : new Error("Не удалось сохранить изменения. Попробуйте ещё раз."),
      );
  });
}
function read<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function event(
  tx: IDBTransaction,
  action: AuditAction,
  title: string,
  role: Role,
) {
  tx.objectStore("events").add({
    action,
    title,
    actor: `Демо · ${ROLES[role]}`,
    at: new Date().toISOString(),
  });
}
function seeds() {
  const rows: [
    string,
    string,
    number,
    number,
    number,
    string | null,
    "all" | "staff",
    boolean,
  ][] = [
    [
      "Об организации учебного процесса",
      "УЧ-014",
      0,
      0,
      -2,
      offsetDate(12),
      "all",
      false,
    ],
    [
      "Учебный план на новый учебный год",
      "УП-028",
      1,
      0,
      -4,
      null,
      "all",
      false,
    ],
    [
      "Договор об оказании образовательных услуг",
      "ДГ-106",
      2,
      2,
      -6,
      offsetDate(8),
      "staff",
      false,
    ],
    [
      "Отчёт о методической работе",
      "ОТ-009",
      3,
      3,
      -8,
      offsetDate(26),
      "all",
      false,
    ],
    [
      "Положение об электронном архиве",
      "ЛА-003",
      4,
      1,
      -10,
      null,
      "all",
      false,
    ],
    [
      "Приказ об утверждении расписания",
      "УЧ-008",
      0,
      0,
      -12,
      offsetDate(120),
      "all",
      false,
    ],
    [
      "Отчёт по внутренней проверке",
      "ОТ-004",
      3,
      1,
      -20,
      offsetDate(-3),
      "staff",
      false,
    ],
    [
      "Программа учебной практики",
      "УМ-017",
      1,
      3,
      -35,
      offsetDate(240),
      "all",
      true,
    ],
  ];
  return rows.map(
    (
      [title, number, cat, dep, days, retainUntil, visibility, archived],
      index,
    ) => {
      const content = `ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ\n\n${title}\nРегистрационный номер: ${number}\nДата: ${offsetDate(days)}\nПодразделение: ${DEPARTMENTS[dep]}\n\nЭто учебный пример для знакомства с OblivionDoc.\nДокумент не является официальным приказом, договором или отчётом.\nДанные и реквизиты вымышлены.\n\nЗагрузите собственный тестовый файл, чтобы проверить работу архива.\n`;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const date = new Date(`${offsetDate(days)}T10:30:00`).toISOString();
      const document: ArchiveDocument = {
        id: `demo-${index + 1}`,
        title,
        number,
        category: CATEGORIES[cat],
        department: DEPARTMENTS[dep],
        author: "Демо-пользователь",
        documentDate: offsetDate(days),
        retainUntil,
        visibility,
        status: archived ? "archived" : "active",
        fileName: `${number}.txt`,
        mimeType: blob.type,
        size: blob.size,
        createdAt: date,
        updatedAt: date,
        example: true,
      };
      return { document, blob };
    },
  );
}
export async function initialize() {
  const db = await open();
  const tx = db.transaction(
    ["documents", "files", "events", "meta"],
    "readwrite",
  );
  const finished = complete(tx);
  const flag = tx.objectStore("meta").get("initialized");
  flag.onsuccess = () => {
    if (flag.result) return;
    for (const { document, blob } of seeds()) {
      tx.objectStore("documents").add(document);
      tx.objectStore("files").add({ id: document.id, blob });
    }
    tx.objectStore("events").add({
      action: "created",
      title: "Добавлены 8 примеров документов",
      actor: "Демо-система",
      at: new Date().toISOString(),
    });
    tx.objectStore("meta").add({ id: "initialized", date: today() });
  };
  await finished;
  return snapshot();
}
export async function snapshot(): Promise<Snapshot> {
  const db = await open();
  const tx = db.transaction(["documents", "events"], "readonly");
  const [documents, events] = await Promise.all([
    read<ArchiveDocument[]>(tx.objectStore("documents").getAll()),
    read<AuditEvent[]>(tx.objectStore("events").getAll()),
  ]);
  return {
    documents,
    events: events.sort((a, b) => (b.id || 0) - (a.id || 0)),
  };
}
export function validateFile(file: File) {
  if (!EXTENSIONS.has(file.name.split(".").at(-1)?.toLowerCase() || ""))
    throw new Error(
      "Поддерживаются PDF, DOC/DOCX, XLS/XLSX, TXT, CSV, PNG, JPG и WebP.",
    );
  if (file.size === 0)
    throw new Error("Выбранный файл пуст. Выберите другой файл.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error(
      "Размер файла превышает 20 МБ. Выберите файл меньшего размера.",
    );
}
export async function saveDocument(
  input: DocumentInput,
  file: File | undefined,
  role: Role,
  existing?: ArchiveDocument,
) {
  if (!canEdit(role))
    throw new Error("Эта демо-роль позволяет только просматривать документы.");
  if (
    !input.title.trim() ||
    !input.author.trim() ||
    !input.documentDate ||
    (!input.retainUntil && input.retainUntil !== null)
  )
    throw new Error("Заполните обязательные поля карточки.");
  if (
    !CATEGORIES.includes(input.category) ||
    !DEPARTMENTS.includes(input.department as (typeof DEPARTMENTS)[number]) ||
    !["all", "staff"].includes(input.visibility)
  )
    throw new Error("Проверьте раздел, подразделение и доступ.");
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00`));
  if (
    !validDate(input.documentDate) ||
    (input.retainUntil &&
      (!validDate(input.retainUntil) || input.retainUntil < input.documentDate))
  )
    throw new Error("Срок хранения не может быть раньше даты документа.");
  if (!file && !existing) throw new Error("Выберите файл для загрузки.");
  if (file) validateFile(file);
  const db = await open();
  const tx = db.transaction(["documents", "files", "events"], "readwrite");
  const finished = complete(tx);
  let issue = "";
  const all = tx.objectStore("documents").getAll();
  let saved: ArchiveDocument;
  all.onsuccess = () => {
    const documents = all.result as ArchiveDocument[];
    if (existing && !documents.some((d) => d.id === existing.id)) {
      issue = "Документ уже удалён в другой вкладке.";
      tx.abort();
      return;
    }
    const bytes =
      documents
        .filter((d) => d.id !== existing?.id)
        .reduce((sum, d) => sum + d.size, 0) +
      (file?.size ?? existing?.size ?? 0);
    if (bytes > MAX_TOTAL_BYTES) {
      issue =
        "Демо-архив ограничен 100 МБ. Удалите ненужные тестовые файлы или выберите файл меньшего размера.";
      tx.abort();
      return;
    }
    const now = new Date().toISOString();
    saved = {
      ...existing,
      ...input,
      title: input.title.trim(),
      number: input.number.trim(),
      author: input.author.trim(),
      id: existing?.id || crypto.randomUUID(),
      status: existing?.status || "active",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      fileName: file?.name || existing!.fileName,
      mimeType: file?.type || existing?.mimeType || "application/octet-stream",
      size: file?.size ?? existing!.size,
      example: existing?.example && !file,
    };
    tx.objectStore("documents").put(saved);
    if (file) tx.objectStore("files").put({ id: saved.id, blob: file });
    event(tx, existing ? "updated" : "created", saved.title, role);
  };
  try {
    await finished;
  } catch (error) {
    throw issue ? new Error(issue) : error;
  }
  return saved!;
}
export async function fileFor(
  document: ArchiveDocument,
  role: Role,
  action: "viewed" | "downloaded",
) {
  if (!visibleTo(document, role))
    throw new Error("Документ недоступен для выбранной демо-роли.");
  const db = await open();
  const tx = db.transaction(["files", "events"], "readwrite");
  const finished = complete(tx);
  const stored = await read<{ id: string; blob: Blob } | undefined>(
    tx.objectStore("files").get(document.id),
  );
  if (stored) event(tx, action, document.title, role);
  await finished;
  if (!stored) throw new Error("Файл не найден в этом браузере.");
  return stored.blob;
}
export async function changeStatus(document: ArchiveDocument, role: Role) {
  if (!canEdit(role)) throw new Error("Недостаточно прав выбранной демо-роли.");
  const db = await open();
  const tx = db.transaction(["documents", "events"], "readwrite");
  const finished = complete(tx);
  const request = tx.objectStore("documents").get(document.id);
  request.onsuccess = () => {
    const current = request.result as ArchiveDocument | undefined;
    if (!current) {
      tx.abort();
      return;
    }
    const archived = current.status === "active";
    tx.objectStore("documents").put({
      ...current,
      status: archived ? "archived" : "active",
      updatedAt: new Date().toISOString(),
    });
    event(tx, archived ? "archived" : "restored", current.title, role);
  };
  await finished;
}
export async function removeDocument(document: ArchiveDocument, role: Role) {
  if (role !== "admin")
    throw new Error("Удаление доступно только демо-администратору.");
  const db = await open();
  const tx = db.transaction(["documents", "files", "events"], "readwrite");
  const finished = complete(tx);
  tx.objectStore("documents").delete(document.id);
  tx.objectStore("files").delete(document.id);
  event(tx, "deleted", document.title, role);
  await finished;
}
export async function recordExport(count: number, role: Role) {
  const db = await open();
  const tx = db.transaction("events", "readwrite");
  const finished = complete(tx);
  event(tx, "exported", `Экспорт реестра: ${count} записей`, role);
  await finished;
}
