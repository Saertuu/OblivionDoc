import { useState, type FormEvent } from "react";
import { Check, FileText, LoaderCircle, UploadCloud, X } from "lucide-react";
import { Dialog } from "./Dialog";
import {
  CATEGORIES,
  DEPARTMENTS,
  type ArchiveDocument,
  type DocumentInput,
  type Role,
} from "../archive/types";
import { saveDocument, validateFile } from "../archive/database";
import { formatBytes, offsetDate, today } from "../archive/format";

export function DocumentForm({
  existing,
  role,
  onClose,
  onSaved,
}: {
  existing?: ArchiveDocument;
  role: Role;
  onClose: () => void;
  onSaved: (record: ArchiveDocument) => Promise<void>;
}) {
  const [input, setInput] = useState<DocumentInput>(() =>
    existing
      ? { ...existing }
      : {
          title: "",
          number: "",
          category: "Приказы",
          department: "Учебный отдел",
          author: "Демо-пользователь",
          documentDate: today(),
          retainUntil: offsetDate(365),
          visibility: "all",
        },
  );
  const [file, setFile] = useState<File>();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof DocumentInput>(
    key: K,
    value: DocumentInput[K],
  ) => setInput((previous) => ({ ...previous, [key]: value }));
  function choose(selected?: File) {
    if (!selected) return;
    try {
      validateFile(selected);
      setFile(selected);
      setError("");
      if (!input.title.trim())
        update("title", selected.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!file && !existing) {
      setError("Выберите файл для загрузки.");
      return;
    }
    setBusy(true);
    try {
      const record = await saveDocument(input, file, role, existing);
      await onSaved(record);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={existing ? "Изменить карточку" : "Добавить документ"}
      eyebrow="РЕЕСТР ДОКУМЕНТОВ"
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="document-form">
        <div
          className={`dropzone ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files[0]);
          }}
        >
          {file ? (
            <div className="selected-file">
              <span className="file-symbol">
                <FileText size={24} />
              </span>
              <div>
                <strong>{file.name}</strong>
                <span>{formatBytes(file.size)} · готов к сохранению</span>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Убрать выбранный файл"
                disabled={busy}
                onClick={() => setFile(undefined)}
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <label className="dropzone-label">
              <input
                type="file"
                aria-label={existing ? "Заменить файл" : "Файл документа"}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp"
                disabled={busy}
                onChange={(event) => {
                  choose(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <span className="upload-symbol">
                <UploadCloud size={25} />
              </span>
              <strong>
                {existing
                  ? "Заменить файл при необходимости"
                  : "Выберите файл или перетащите сюда"}
              </strong>
              <span>
                {existing
                  ? `Текущий файл: ${existing.fileName}`
                  : "PDF, Word, Excel, текст или изображение · до 20 МБ"}
              </span>
            </label>
          )}
        </div>
        <label className="form-field full">
          Название документа <span className="required">*</span>
          <input
            required
            maxLength={180}
            value={input.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Например, приказ об организации учебного процесса"
          />
        </label>
        <div className="form-grid">
          <label className="form-field">
            Регистрационный номер
            <input
              maxLength={60}
              value={input.number}
              onChange={(e) => update("number", e.target.value)}
              placeholder="Например, УЧ-014"
            />
          </label>
          <label className="form-field">
            Дата документа <span className="required">*</span>
            <input
              required
              type="date"
              value={input.documentDate}
              onChange={(e) => update("documentDate", e.target.value)}
            />
          </label>
          <label className="form-field">
            Категория
            <select
              value={input.category}
              onChange={(e) =>
                update("category", e.target.value as DocumentInput["category"])
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Подразделение
            <select
              value={input.department}
              onChange={(e) => update("department", e.target.value)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Автор / ответственный <span className="required">*</span>
            <input
              required
              maxLength={100}
              value={input.author}
              onChange={(e) => update("author", e.target.value)}
            />
          </label>
          <label className="form-field">
            Доступ
            <select
              value={input.visibility}
              onChange={(e) =>
                update("visibility", e.target.value as "all" | "staff")
              }
            >
              <option value="all">Все демо-роли</option>
              <option value="staff">Архивариус и администратор</option>
            </select>
          </label>
        </div>
        <fieldset className="retention-fieldset">
          <legend>Срок хранения</legend>
          <label className="check-label">
            <input
              type="checkbox"
              checked={input.retainUntil === null}
              onChange={(e) =>
                update("retainUntil", e.target.checked ? null : offsetDate(365))
              }
            />
            Бессрочное хранение
          </label>
          {input.retainUntil !== null && (
            <label className="form-field">
              Хранить до{" "}
              <input
                required
                type="date"
                min={input.documentDate}
                value={input.retainUntil}
                onChange={(e) => update("retainUntil", e.target.value)}
              />
            </label>
          )}
          <p>
            Укажите дату по номенклатуре дел вашей организации. Истечение срока
            не удаляет документ автоматически.
          </p>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <span>Файл сохранится в этом браузере</span>
          <div>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Check size={17} />
              )}
              {existing ? "Сохранить изменения" : "Сохранить документ"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
