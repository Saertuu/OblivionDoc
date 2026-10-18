import {
  Archive,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Folder,
  History,
  Info,
  LockKeyhole,
  SearchX,
  ShieldCheck,
} from "lucide-react";
import {
  ACTIONS,
  CATEGORIES,
  ROLES,
  type ArchiveDocument,
  type AuditEvent,
  type Role,
} from "../archive/types";
import {
  daysLeft,
  formatBytes,
  formatDate,
  plural,
  retention,
} from "../archive/format";

export function Term({ date }: { date: string | null }) {
  const term = retention(date);
  return (
    <span className={`term-badge ${term.tone}`}>
      {term.tone !== "neutral" && <span className="badge-dot" />}
      {term.label}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <SearchX size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button button-secondary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
export function DocumentTable({
  documents,
  page,
  setPage,
  onOpen,
  onDownload,
  busy,
  onReset,
}: {
  documents: ArchiveDocument[];
  page: number;
  setPage: (page: number) => void;
  onOpen: (record: ArchiveDocument) => void;
  onDownload: (record: ArchiveDocument) => void;
  busy: boolean;
  onReset: () => void;
}) {
  const pageSize = 6,
    pages = Math.max(1, Math.ceil(documents.length / pageSize)),
    current = Math.min(page, pages);
  const rows = documents.slice((current - 1) * pageSize, current * pageSize);
  return (
    <>
      {!rows.length ? (
        <EmptyState
          title="Документы не найдены"
          description="Измените запрос или сбросьте фильтры. Новые документы можно добавить кнопкой вверху страницы."
          action={{ label: "Сбросить фильтры", onClick: onReset }}
        />
      ) : (
        <div
          className="table-scroll"
          role="region"
          aria-label="Таблица документов"
          tabIndex={0}
        >
          <table className="document-table">
            <thead>
              <tr>
                <th>Название документа</th>
                <th className="category-col">Категория</th>
                <th className="department-col">Подразделение</th>
                <th className="date-col">Дата</th>
                <th>Срок хранения</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => (
                <tr key={record.id}>
                  <td>
                    <button
                      className="document-title-button"
                      aria-label={record.title}
                      onClick={() => onOpen(record)}
                    >
                      <span
                        className={`file-symbol ${record.fileName.endsWith(".pdf") ? "pdf" : ""}`}
                      >
                        <FileText size={20} />
                        <small>
                          {record.fileName
                            .split(".")
                            .at(-1)
                            ?.slice(0, 4)
                            .toUpperCase()}
                        </small>
                      </span>
                      <span className="document-title-text">
                        <strong>{record.title}</strong>
                        <span>
                          {record.number ? `№ ${record.number}` : "Без номера"}
                          <i />
                          {formatBytes(record.size)}
                          {record.status === "archived" && (
                            <>
                              <i />В архиве
                            </>
                          )}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="category-col">
                    <span className="category-badge">{record.category}</span>
                  </td>
                  <td className="department-col">
                    <span className="department-cell">{record.department}</span>
                  </td>
                  <td className="date-col">
                    {formatDate(record.documentDate, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <Term date={record.retainUntil} />
                  </td>
                  <td>
                    <button
                      className="icon-button row-download"
                      aria-label={`Скачать: ${record.title}`}
                      disabled={busy}
                      onClick={() => onDownload(record)}
                    >
                      <Download size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="table-footer">
        <span>
          {documents.length
            ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, documents.length)} из ${plural(documents.length)}`
            : "0 документов"}
        </span>
        <div className="pagination">
          <button
            className="icon-button"
            aria-label="Предыдущая страница"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            className="icon-button"
            aria-label="Следующая страница"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
export function FoldersView({
  documents,
  onSelect,
}: {
  documents: ArchiveDocument[];
  onSelect: (category: string) => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Разделы архива</h2>
          <p>Документы, сгруппированные по назначению</p>
        </div>
        <span className="subtle-pill">{CATEGORIES.length} категорий</span>
      </div>
      <div className="folder-grid">
        {CATEGORIES.map((category, index) => {
          const rows = documents.filter((d) => d.category === category);
          return (
            <button
              className={`folder-card folder-${index}`}
              key={category}
              onClick={() => onSelect(category)}
            >
              <div className="folder-card-top">
                <span className="folder-illustration">
                  <Folder size={44} strokeWidth={1.2} />
                </span>
                <ArrowRight size={17} />
              </div>
              <h3>{category}</h3>
              <p>
                {plural(rows.length)}
                <span>
                  {formatBytes(rows.reduce((sum, d) => sum + d.size, 0))}
                </span>
              </p>
              <div className="folder-card-bottom">
                <span>
                  {rows.filter((d) => d.status === "active").length} в работе
                </span>
                <span>
                  {rows.filter((d) => d.status === "archived").length} в архиве
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
export function RetentionView({
  documents,
  onOpen,
  windowDays,
  setWindow,
}: {
  documents: ArchiveDocument[];
  onOpen: (record: ArchiveDocument) => void;
  windowDays: string;
  setWindow: (value: string) => void;
}) {
  const dated = documents
    .filter(
      (d) =>
        d.status === "active" &&
        d.retainUntil &&
        (windowDays === "all" || daysLeft(d.retainUntil) <= Number(windowDays)),
    )
    .sort((a, b) => a.retainUntil!.localeCompare(b.retainUntil!));
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Контроль сроков хранения</h2>
          <p>Документы, которым требуется ваше внимание</p>
        </div>
        <label className="select-label">
          <span className="sr-only">Период контроля</span>
          <select
            value={windowDays}
            onChange={(e) => setWindow(e.target.value)}
          >
            <option value="30">Ближайшие 30 дней</option>
            <option value="90">Ближайшие 90 дней</option>
            <option value="all">Все сроки</option>
          </select>
        </label>
      </div>
      <div className="info-note">
        <Info size={18} />
        <p>
          Сроки задаются по правилам организации. Истечение срока — повод
          проверить документ; автоматического удаления нет.
        </p>
      </div>
      <div className="panel retention-list">
        {dated.length ? (
          dated.map((record) => (
            <button
              className="retention-row"
              key={record.id}
              onClick={() => onOpen(record)}
            >
              <span
                className={`calendar-tile ${daysLeft(record.retainUntil!) < 0 ? "overdue" : ""}`}
              >
                <strong>
                  {new Date(`${record.retainUntil}T12:00:00`).getDate()}
                </strong>
                <span>
                  {formatDate(record.retainUntil, { month: "short" })}
                </span>
              </span>
              <span className="retention-row-copy">
                <strong>{record.title}</strong>
                <span>
                  {record.category} · {record.department}
                </span>
              </span>
              <Term date={record.retainUntil} />
              <ArrowRight size={17} />
            </button>
          ))
        ) : (
          <EmptyState
            title="Сроки под контролем"
            description="В выбранном периоде нет документов для проверки."
          />
        )}
      </div>
      <p className="view-footnote">
        <Archive size={15} />
        Бессрочное хранение:{" "}
        {plural(documents.filter((d) => d.retainUntil === null).length)}.
        Архивные записи не включены в список проверки.
      </p>
    </>
  );
}
export function ActivityView({
  events,
  role,
}: {
  events: AuditEvent[];
  role: Role;
}) {
  if (role === "reader")
    return (
      <EmptyState
        title="Журнал доступен сотрудникам архива"
        description="Для проверки журнала выберите демо-роль архивариуса или администратора."
      />
    );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>История действий</h2>
          <p>Операции в текущем демонстрационном архиве</p>
        </div>
        <span className="subtle-pill">{events.length} событий</span>
      </div>
      <div className="panel activity-list">
        {events.slice(0, 100).map((event, index) => (
          <div className="activity-row" key={event.id ?? index}>
            <span className={`activity-icon action-${event.action}`}>
              {event.action === "archived" ? (
                <Archive size={17} />
              ) : event.action === "downloaded" ||
                event.action === "exported" ? (
                <Download size={17} />
              ) : event.action === "viewed" ? (
                <FileText size={17} />
              ) : (
                <History size={17} />
              )}
            </span>
            <div>
              <strong>{ACTIONS[event.action]}</strong>
              <p>{event.title}</p>
              <span>{event.actor}</span>
            </div>
            <time dateTime={event.at}>
              {new Date(event.at).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              })}
              <span>
                {new Date(event.at).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </time>
          </div>
        ))}
      </div>
      {events.length > 100 && (
        <p className="view-footnote">
          Показаны последние 100 событий из {events.length}.
        </p>
      )}
    </>
  );
}
export function SettingsView({
  documents,
  events,
  theme,
  toggleTheme,
  role,
}: {
  documents: ArchiveDocument[];
  events: AuditEvent[];
  theme: string;
  toggleTheme: () => void;
  role: Role;
}) {
  const permissions = [
    ["Просмотр открытых документов", true, true, true],
    ["Документы для сотрудников", false, true, true],
    ["Загрузка и изменение карточек", false, true, true],
    ["Архивирование и журнал", false, true, true],
    ["Удаление документов", false, false, true],
  ];
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Настройки пространства</h2>
          <p>Возможности демонстрационной версии</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <span className="settings-symbol">
            <Folder size={23} />
          </span>
          <h3>Локальный архив</h3>
          <p>
            Карточки, файлы и журнал сохраняются в этом браузере. После очистки
            данных браузера они будут удалены. Общего хранилища организации пока
            нет.
          </p>
          <dl className="settings-numbers">
            <div>
              <dt>Документов</dt>
              <dd>{documents.length}</dd>
            </div>
            <div>
              <dt>Размер файлов</dt>
              <dd>
                {formatBytes(documents.reduce((sum, d) => sum + d.size, 0))}
              </dd>
            </div>
            <div>
              <dt>Событий</dt>
              <dd>{events.length}</dd>
            </div>
          </dl>
          <span className="local-status">
            <span />
            Сохранение в браузере включено
          </span>
        </section>
        <section className="panel settings-card">
          <span className="settings-symbol">
            <ShieldCheck size={23} />
          </span>
          <h3>Демонстрационный режим</h3>
          <p>
            Выбрана роль «{ROLES[role]}». Переключатель показывает сценарии
            интерфейса. Реальная регистрация, проверка прав на сервере и
            совместная работа ещё не подключены.
          </p>
          <div className="settings-line">
            <div>
              <strong>Тема интерфейса</strong>
              <span>{theme === "dark" ? "Тёмная" : "Светлая"}</span>
            </div>
            <button className="button button-secondary" onClick={toggleTheme}>
              Переключить тему
            </button>
          </div>
        </section>
      </div>
      <section className="panel roles-panel">
        <div className="section-heading">
          <div>
            <h3>Возможности демо-ролей</h3>
            <p>Выбрать роль можно в нижней части бокового меню</p>
          </div>
          <LockKeyhole size={20} />
        </div>
        <div className="table-scroll">
          <table className="roles-table">
            <thead>
              <tr>
                <th>Действие</th>
                <th>Наблюдатель</th>
                <th>Архивариус</th>
                <th>Администратор</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map(([label, ...values]) => (
                <tr key={String(label)}>
                  <td>{label}</td>
                  {values.map((value, i) => (
                    <td key={i}>
                      {value ? (
                        <Check size={16} aria-label="Доступно" />
                      ) : (
                        <span aria-label="Недоступно">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="view-footnote">
        <Info size={16} />
        Используйте тестовые файлы. Для реальных документов нужен сервер с
        авторизацией и резервным копированием.
      </p>
    </>
  );
}
