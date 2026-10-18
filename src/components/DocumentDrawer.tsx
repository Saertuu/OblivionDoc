import { lazy, Suspense, useEffect, useState } from "react";
import {
  Archive,
  Download,
  FileText,
  LoaderCircle,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { canEdit, type ArchiveDocument, type Role } from "../archive/types";
import { type ArchiveDatabase } from "../archive/database";
import { formatBytes, formatDate, retention } from "../archive/format";

const PdfPreview = lazy(() => import("./PdfPreview"));

export function DocumentDrawer({
  database,
  record,
  role,
  onClose,
  onEdit,
  onDownload,
  onStatus,
  onDelete,
  onActivity,
  busy,
}: {
  database: ArchiveDatabase;
  record: ArchiveDocument;
  role: Role;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onStatus: () => void;
  onDelete: () => void;
  onActivity: () => Promise<void>;
  busy: boolean;
}) {
  const [preview, setPreview] = useState<{
    url: string;
    text?: string;
    blob: Blob;
    kind: "text" | "image" | "pdf" | "file";
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false,
      url = "";
    setPreview(undefined);
    setError("");
    (async () => {
      try {
        const blob = await database.fileFor(record, role, "viewed");
        const ext = record.fileName.split(".").at(-1)?.toLowerCase();
        const text = ["txt", "csv"].includes(ext || "")
          ? await blob.slice(0, 200000).text()
          : undefined;
        const kind =
          text !== undefined
            ? "text"
            : ["png", "jpg", "jpeg", "webp"].includes(ext || "") &&
                blob.type.startsWith("image/")
              ? "image"
              : ext === "pdf" && blob.type === "application/pdf"
                ? "pdf"
                : "file";
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview({ url, text, blob, kind });
        await onActivity();
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [database, record.id, record.updatedAt, role, onActivity]);
  const term = retention(record.retainUntil);
  return (
    <Dialog
      title={record.title}
      eyebrow={
        record.number ? `КАРТОЧКА · № ${record.number}` : "КАРТОЧКА ДОКУМЕНТА"
      }
      onClose={onClose}
      drawer
      busy={busy}
    >
      <div className="drawer-body">
        <div className="drawer-badges">
          <span className={`status-badge ${record.status}`}>
            {record.status === "active" ? "Действующий" : "В архиве"}
          </span>
          <span className={`term-badge ${term.tone}`}>{term.label}</span>
          {record.example && <span className="example-badge">Пример</span>}
        </div>
        <div className="file-meta">
          <span className="file-symbol">
            <FileText size={24} />
          </span>
          <div>
            <strong>{record.fileName}</strong>
            <span>{formatBytes(record.size)}</span>
          </div>
          <button
            className="icon-button"
            disabled={busy}
            aria-label="Скачать файл"
            onClick={onDownload}
          >
            <Download size={18} />
          </button>
        </div>
        <div
          className={`document-preview ${preview?.kind || ""}`}
          aria-label="Предпросмотр файла"
        >
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : !preview ? (
            <span className="preview-placeholder">
              <LoaderCircle size={22} className="spin" />
              Загружаем файл…
            </span>
          ) : preview.kind === "text" ? (
            <pre>
              {preview.text}
              {record.size > 200000 &&
                "\n… Показаны первые 200 КБ. Скачайте файл целиком."}
            </pre>
          ) : preview.kind === "image" ? (
            <img src={preview.url} alt={`Предпросмотр: ${record.title}`} />
          ) : preview.kind === "pdf" ? (
            <Suspense
              fallback={
                <div className="preview-placeholder">
                  <LoaderCircle size={22} className="spin" />
                  Загружаем просмотр PDF…
                </div>
              }
            >
              <PdfPreview blob={preview.blob} fileName={record.fileName} />
            </Suspense>
          ) : (
            <div className="preview-placeholder">
              <FileText size={38} />
              <strong>Файл готов к скачиванию</strong>
              <p>
                Для этого формата предпросмотр недоступен.
                <br />
                Откройте файл в соответствующей программе.
              </p>
              <button className="button button-secondary" onClick={onDownload}>
                <Download size={16} />
                Скачать файл
              </button>
            </div>
          )}
        </div>
        <h3 className="drawer-section-title">Реквизиты документа</h3>
        <dl className="metadata">
          <div>
            <dt>Категория</dt>
            <dd>{record.category}</dd>
          </div>
          <div>
            <dt>Подразделение</dt>
            <dd>{record.department}</dd>
          </div>
          <div>
            <dt>Ответственный</dt>
            <dd>{record.author}</dd>
          </div>
          <div>
            <dt>Дата документа</dt>
            <dd>{formatDate(record.documentDate)}</dd>
          </div>
          <div>
            <dt>Хранить до</dt>
            <dd>{formatDate(record.retainUntil)}</dd>
          </div>
          <div>
            <dt>Добавлен в реестр</dt>
            <dd>{new Date(record.createdAt).toLocaleString("ru-RU")}</dd>
          </div>
        </dl>
        <p className="access-note">
          <ShieldCheck size={17} />
          {record.visibility === "all"
            ? "Доступен всем демо-ролям"
            : "Для архивариуса и администратора"}
        </p>
        {canEdit(role) && (
          <div className="drawer-edit-actions">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={onEdit}
            >
              <Pencil size={16} />
              Изменить карточку
            </button>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={onStatus}
            >
              {record.status === "active" ? (
                <Archive size={16} />
              ) : (
                <RotateCcw size={16} />
              )}
              {record.status === "active"
                ? "Перенести в архив"
                : "Вернуть в работу"}
            </button>
          </div>
        )}
        {role === "admin" && (
          <button className="delete-link" disabled={busy} onClick={onDelete}>
            <Trash2 size={15} />
            Удалить документ
          </button>
        )}
      </div>
    </Dialog>
  );
}
