import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FilePlus2,
  Files,
  FolderClosed,
  History,
  Info,
  LoaderCircle,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { Brand } from "./components/Brand";
import { AuthScreen } from "./components/AuthScreen";
import {
  archiveForSession,
  endDemoSession,
  initials,
  readDemoSession,
  rememberDemoSession,
  type DemoSession,
} from "./auth/demoSession";
import { Dialog } from "./components/Dialog";
import { DocumentForm } from "./components/DocumentForms";
import { DocumentDrawer } from "./components/DocumentDrawer";
import {
  ActivityView,
  DocumentTable,
  FoldersView,
  RetentionView,
  SettingsView,
} from "./components/ArchiveViews";
import { createArchiveDatabase } from "./archive/database";
import {
  CATEGORIES,
  DEPARTMENTS,
  ROLES,
  canEdit,
  visibleTo,
  type ArchiveDocument,
  type Role,
  type Snapshot,
  type View,
} from "./archive/types";
import {
  csvCell,
  daysLeft,
  downloadBlob,
  formatBytes,
  formatDate,
  normalize,
  plural,
  today,
} from "./archive/format";

const NAV = [
  { id: "documents", label: "Все документы", icon: Files },
  { id: "folders", label: "Разделы архива", icon: FolderClosed },
  { id: "retention", label: "Сроки хранения", icon: CalendarClock },
  { id: "activity", label: "Журнал действий", icon: History },
] as const;
const TITLES: Record<View, string> = {
  documents: "Архив документов",
  folders: "Разделы архива",
  retention: "Сроки хранения",
  activity: "Журнал действий",
  settings: "Настройки",
};
function currentView(): View {
  const value = location.hash.replace("#/", "");
  return Object.hasOwn(TITLES, value) ? (value as View) : "documents";
}
function storedRole(key: string): Role {
  try {
    const value = localStorage.getItem(key);
    return value && Object.hasOwn(ROLES, value) ? (value as Role) : "archivist";
  } catch {
    return "archivist";
  }
}

export function App() {
  const [session, setSession] = useState<DemoSession | null>(readDemoSession);
  if (!session)
    return (
      <AuthScreen
        onEnter={(next) => {
          rememberDemoSession(next);
          location.hash = `/${currentView()}`;
          setSession(next);
        }}
      />
    );
  return (
    <ArchiveWorkspace
      key={session.kind === "profile" ? session.profile.id : "guest"}
      session={session}
      onLogout={() => {
        endDemoSession();
        location.hash = "/login";
        setSession(null);
      }}
    />
  );
}

function ArchiveWorkspace({
  session,
  onLogout,
}: {
  session: DemoSession;
  onLogout: () => void;
}) {
  const [database] = useState(() =>
    createArchiveDatabase(archiveForSession(session), session.kind === "guest"),
  );
  const {
    snapshot,
    initialize,
    fileFor,
    recordExport,
    changeStatus,
    removeDocument,
  } = database;
  const profile = session.kind === "profile" ? session.profile : null;
  const [data, setData] = useState<Snapshot>({ documents: [], events: [] });
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const roleKey = `obliviondoc-demo-role-${archiveForSession(session)}`;
  const [role, setRole] = useState<Role>(() => storedRole(roleKey)),
    [view, setView] = useState<View>(currentView);
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme || "light",
  );
  const [mobileOpen, setMobileOpen] = useState(false),
    [search, setSearch] = useState("");
  const [category, setCategory] = useState("all"),
    [department, setDepartment] = useState("all"),
    [termFilter, setTermFilter] = useState("all");
  const [tab, setTab] = useState("all"),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1),
    [retentionWindow, setRetentionWindow] = useState("30");
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [editing, setEditing] = useState<ArchiveDocument | null | undefined>(),
    [deleting, setDeleting] = useState<ArchiveDocument | null>(null);
  const [help, setHelp] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ text: string; error?: boolean }>();
  const inputRef = useRef<HTMLInputElement>(null),
    channel = useRef<BroadcastChannel | null>(null);
  const refresh = useCallback(async () => {
    setData(await snapshot());
  }, [snapshot]);
  const start = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(await initialize());
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [initialize]);
  useEffect(() => {
    void start();
  }, [start]);
  useEffect(() => {
    const update = () => {
      setView(currentView());
      setMobileOpen(false);
    };
    const shortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !document.querySelector("dialog[open]") &&
        !(
          event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
        )
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("keydown", shortcut);
    };
  }, []);
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const bus = new BroadcastChannel(
      `obliviondoc-changes-${archiveForSession(session)}`,
    );
    channel.current = bus;
    bus.onmessage = () => {
      refresh().catch((error) =>
        setToast({ text: (error as Error).message, error: true }),
      );
    };
    return () => {
      bus.close();
      channel.current = null;
    };
  }, [refresh]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("obliviondoc-theme", theme);
    } catch {
      /* Optional preference. */
    }
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem(roleKey, role);
    } catch {
      /* Optional preference. */
    }
    setSelectedId(null);
    setPage(1);
  }, [role, roleKey]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setPage(1);
  }, [search, category, department, tab, sort, termFilter]);
  const documents = useMemo(
    () => data.documents.filter((record) => visibleTo(record, role)),
    [data.documents, role],
  );
  const active = documents.filter((record) => record.status === "active"),
    archived = documents.filter((record) => record.status === "archived");
  const attention = active.filter(
    (record) => record.retainUntil && daysLeft(record.retainUntil) <= 30,
  );
  const selected = documents.find((record) => record.id === selectedId);
  const filtered = useMemo(() => {
    const query = normalize(search);
    const rows = documents.filter(
      (record) =>
        (tab === "all" || record.status === tab) &&
        (category === "all" || record.category === category) &&
        (department === "all" || record.department === department) &&
        (termFilter === "all" ||
          (termFilter === "permanent" && !record.retainUntil) ||
          (termFilter === "attention" &&
            record.status === "active" &&
            record.retainUntil &&
            daysLeft(record.retainUntil) <= 30)) &&
        (!query ||
          normalize(
            [
              record.title,
              record.number,
              record.author,
              record.department,
              record.category,
              record.fileName,
            ].join(" "),
          ).includes(query)),
    );
    return rows.sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "ru")
        : sort === "term"
          ? (a.retainUntil || "9999").localeCompare(b.retainUntil || "9999")
          : sort === "oldest"
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt),
    );
  }, [documents, search, tab, category, department, termFilter, sort]);
  function navigate(next: View) {
    setView(next);
    setMobileOpen(false);
    location.hash = `/${next}`;
  }
  function resetFilters() {
    setSearch("");
    setCategory("all");
    setDepartment("all");
    setTermFilter("all");
    setTab("all");
    setPage(1);
  }
  function selectStat(nextTab: string) {
    resetFilters();
    setTab(nextTab);
    navigate("documents");
  }
  async function changed() {
    await refresh();
    channel.current?.postMessage("changed");
  }
  async function perform(task: () => Promise<void>, message?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
      await changed();
      if (message) setToast({ text: message });
    } catch (error) {
      setToast({
        text: (error as Error).message || "Не удалось выполнить действие.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  function download(record: ArchiveDocument) {
    void perform(async () => {
      downloadBlob(await fileFor(record, role, "downloaded"), record.fileName);
    }, "Файл подготовлен к скачиванию");
  }
  function exportRegistry() {
    void perform(async () => {
      const columns = [
        "Название",
        "Номер",
        "Категория",
        "Подразделение",
        "Ответственный",
        "Дата документа",
        "Хранить до",
        "Статус",
        "Файл",
      ];
      const rows = filtered.map((r) => [
        r.title,
        r.number,
        r.category,
        r.department,
        r.author,
        r.documentDate,
        r.retainUntil || "Бессрочно",
        r.status === "active" ? "Действующий" : "В архиве",
        r.fileName,
      ]);
      const content =
        "\uFEFF" +
        [columns, ...rows]
          .map((row) => row.map(csvCell).join(";"))
          .join("\r\n");
      await recordExport(rows.length, role);
      downloadBlob(
        new Blob([content], { type: "text/csv;charset=utf-8" }),
        `OblivionDoc-реестр-${today()}.csv`,
      );
    }, "Реестр выгружен в CSV");
  }
  const hasFilters = Boolean(
    search ||
      category !== "all" ||
      department !== "all" ||
      termFilter !== "all",
  );
  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Закрыть боковую панель"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Боковая панель"
      >
        <div className="sidebar-brand">
          <Brand onClick={() => navigate("documents")} />
          <button
            className="icon-button sidebar-close"
            aria-label="Закрыть меню"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">ОУ</span>
          <div>
            <strong title={profile?.organization}>
              {profile?.organization || "Учебная организация"}
            </strong>
            <span>Демонстрационный архив</span>
          </div>
        </div>
        <p className="nav-section-label">РАБОЧЕЕ ПРОСТРАНСТВО</p>
        <nav className="sidebar-nav" aria-label="Основная навигация">
          {NAV.map((item) => (
            <a
              href={`#/${item.id}`}
              key={item.id}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "documents" && (
                <span className="nav-count">{documents.length}</span>
              )}
              {item.id === "retention" && attention.length > 0 && (
                <span className="nav-count attention">{attention.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-separator" />
        <div className="sidebar-category-heading">
          <p className="nav-section-label">КАТЕГОРИИ</p>
          <FolderClosed size={13} />
        </div>
        <div className="sidebar-categories">
          {CATEGORIES.map((item, index) => (
            <button
              key={item}
              onClick={() => {
                resetFilters();
                setCategory(item);
                navigate("documents");
              }}
              className={
                category === item && view === "documents" ? "selected" : ""
              }
            >
              <span className={`category-dot dot-${index}`} />
              <span>{item}</span>
              <small>
                {documents.filter((r) => r.category === item).length}
              </small>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="local-storage">
            <span>
              <span className="storage-dot" />
              Локальное хранилище
              <Info size={13} />
            </span>
            <strong>
              {formatBytes(data.documents.reduce((sum, r) => sum + r.size, 0))}
              <small> из 100 МБ для демо</small>
            </strong>
            <div className="storage-track">
              <span
                style={{
                  width: `${Math.max(3, data.documents.reduce((sum, r) => sum + r.size, 0) / 1048576)}%`,
                }}
              />
            </div>
          </div>
          <a
            href="#/settings"
            className={`sidebar-settings ${view === "settings" ? "selected" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={18} />
            Настройки
          </a>
          <div className="demo-profile">
            <span className="user-avatar">
              {profile ? initials(profile.name) : "ГД"}
            </span>
            <div>
              <strong title={profile?.name}>
                {profile?.name || "Гостевой доступ"}
              </strong>
              <span title={profile?.email}>
                {profile?.email || "Локальная демонстрация"}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Выйти из демоархива"
              title="Выйти"
              onClick={onLogout}
            >
              <LogOut size={17} />
            </button>
          </div>
          <div className="demo-user demo-role-switch">
            <label>
              <span>Демо-роль</span>
              <select
                aria-label="Демонстрационная роль"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {Object.entries(ROLES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <ChevronDown size={14} />
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="global-search">
            <Search size={18} />
            <input
              ref={inputRef}
              aria-label="Поиск документов"
              placeholder="Найти документ, номер или автора…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (view !== "documents") navigate("documents");
              }}
            />
            {search ? (
              <button
                className="icon-button"
                aria-label="Очистить поиск"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </div>
          <div className="topbar-actions">
            <span className="demo-pill">
              <span />
              Демо-версия
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label={
                theme === "light"
                  ? "Включить тёмную тему"
                  : "Включить светлую тему"
              }
              onClick={toggleTheme}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label={`Сроки хранения: ${attention.length} требуют внимания`}
              onClick={() => navigate("retention")}
            >
              <Bell size={19} />
              {attention.length > 0 && <span />}
            </button>
            <button
              className="icon-button help-button"
              aria-label="О демонстрационной версии"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          <div className="breadcrumb">
            <span>Рабочее пространство</span>
            <span>/</span>
            <strong>{TITLES[view]}</strong>
            <time dateTime={today()}>
              {formatDate(today(), {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </div>
          <div className="page-heading">
            <div>
              <div className="heading-eyebrow">
                OBLIVIONDOC · ЭЛЕКТРОННЫЙ АРХИВ
              </div>
              <h1>{TITLES[view]}</h1>
              <p>
                {view === "documents"
                  ? "Важные документы. Понятный порядок."
                  : view === "retention"
                    ? "Ни одной важной даты без внимания."
                    : view === "activity"
                      ? "Прозрачная история работы с документами."
                      : view === "settings"
                        ? "Ваше рабочее пространство — под ваш ритм."
                        : "У каждого документа — своё место."}
              </p>
            </div>
            {view === "documents" && canEdit(role) && (
              <button
                className="button button-primary add-document"
                disabled={loading || !!loadError}
                onClick={() => setEditing(null)}
              >
                <Plus size={18} />
                Добавить документ
              </button>
            )}
          </div>
          {loading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" size={28} />
              <p>Открываем ваш архив…</p>
            </div>
          ) : loadError ? (
            <div className="panel error-state" role="alert">
              <Info size={30} />
              <h2>Архив пока недоступен</h2>
              <p>{loadError}</p>
              <button
                className="button button-primary"
                onClick={() => void start()}
              >
                Повторить попытку
              </button>
            </div>
          ) : (
            <>
              {view === "documents" && (
                <>
                  <section className="archive-welcome" aria-label="Об архиве">
                    <div className="welcome-copy">
                      <span className="welcome-label">
                        <span />
                        ДОКУМЕНТЫ ПОД КОНТРОЛЕМ
                      </span>
                      <h2>
                        Порядок сегодня.
                        <br />
                        <span>Уверенность завтра.</span>
                      </h2>
                      <p>
                        Храните, находите и отслеживайте документы
                        <br className="desktop-break" /> образовательной
                        организации в одном пространстве.
                      </p>
                      <button onClick={() => setHelp(true)}>
                        Познакомиться с архивом
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="archive-art" aria-hidden="true">
                      <div className="art-ring ring-one" />
                      <div className="art-ring ring-two" />
                      <div className="art-paper paper-back">
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="art-paper paper-front">
                        <span className="paper-heading" />
                        <span />
                        <span />
                        <span />
                        <div className="paper-seal">
                          <Check size={22} />
                        </div>
                      </div>
                      <div className="art-tag">
                        <ShieldCheck size={15} />
                        Всё на своём месте
                      </div>
                      <span className="art-spark spark-one">+</span>
                      <span className="art-spark spark-two">+</span>
                    </div>
                    <span className="welcome-edition">OB / ARCHIVE — 01</span>
                  </section>
                  <section
                    className="stats-grid"
                    aria-label="Статистика архива"
                  >
                    {[
                      {
                        label: "Всего документов",
                        value: documents.length,
                        note: "в вашем реестре",
                        icon: Files,
                        color: "sage",
                        action: () => selectStat("all"),
                      },
                      {
                        label: "В работе",
                        value: active.length,
                        note: "действующих",
                        icon: FilePlus2,
                        color: "blue",
                        action: () => selectStat("active"),
                      },
                      {
                        label: "Требуют внимания",
                        value: attention.length,
                        note: "по сроку хранения",
                        icon: CalendarClock,
                        color: "amber",
                        action: () => navigate("retention"),
                      },
                      {
                        label: "В архиве",
                        value: archived.length,
                        note: "завершённых",
                        icon: Archive,
                        color: "lilac",
                        action: () => selectStat("archived"),
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        className="stat-card"
                        onClick={item.action}
                      >
                        <span className={`stat-icon ${item.color}`}>
                          <item.icon size={20} />
                        </span>
                        <span className="stat-body">
                          <span>{item.label}</span>
                          <strong>
                            {item.value}
                            <small>{item.note}</small>
                          </strong>
                        </span>
                        <ArrowRight size={15} />
                      </button>
                    ))}
                  </section>
                  <section
                    className="panel registry-panel"
                    aria-labelledby="registry-title"
                  >
                    <div className="registry-heading">
                      <div>
                        <h2 id="registry-title">Реестр документов</h2>
                        <span>{plural(filtered.length)}</span>
                      </div>
                      <button
                        className="button button-secondary export-button"
                        disabled={busy || !filtered.length}
                        onClick={exportRegistry}
                      >
                        <ArrowDownToLine size={16} />
                        Экспорт CSV
                      </button>
                    </div>
                    <div
                      className="registry-tabs"
                      role="group"
                      aria-label="Статус документов"
                    >
                      {[
                        ["all", "Все документы", documents.length],
                        ["active", "В работе", active.length],
                        ["archived", "В архиве", archived.length],
                      ].map(([key, label, count]) => (
                        <button
                          key={key}
                          aria-pressed={tab === key}
                          className={tab === key ? "is-active" : ""}
                          onClick={() => setTab(String(key))}
                        >
                          {label}
                          <span>{count}</span>
                        </button>
                      ))}
                    </div>
                    <div className="filter-bar">
                      <span className="filter-icon">
                        <SlidersHorizontal size={16} />
                      </span>
                      <label>
                        <span className="sr-only">Категория документов</span>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          <option value="all">Все категории</option>
                          {CATEGORIES.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="sr-only">
                          Подразделение документов
                        </span>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                        >
                          <option value="all">Все подразделения</option>
                          {DEPARTMENTS.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label className="term-filter">
                        <span className="sr-only">Фильтр срока хранения</span>
                        <select
                          value={termFilter}
                          onChange={(e) => setTermFilter(e.target.value)}
                        >
                          <option value="all">Любой срок хранения</option>
                          <option value="attention">Требуют внимания</option>
                          <option value="permanent">Бессрочно</option>
                        </select>
                      </label>
                      {hasFilters && (
                        <button className="filter-reset" onClick={resetFilters}>
                          Сбросить
                          <X size={12} />
                        </button>
                      )}
                      <label className="sort-control">
                        <span className="sr-only">Сортировка документов</span>
                        <Clock3 size={14} />
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="newest">Сначала новые</option>
                          <option value="oldest">Сначала старые</option>
                          <option value="title">По названию</option>
                          <option value="term">По сроку хранения</option>
                        </select>
                      </label>
                    </div>
                    <DocumentTable
                      documents={filtered}
                      emptyArchive={data.documents.length === 0}
                      page={page}
                      setPage={setPage}
                      onOpen={(r) => setSelectedId(r.id)}
                      onDownload={download}
                      busy={busy}
                      onReset={resetFilters}
                    />
                  </section>
                  <div className="bottom-hint">
                    <span>
                      <ShieldCheck size={16} />
                      Демонстрационное пространство · файлы хранятся только в
                      этом браузере
                    </span>
                    <button onClick={() => navigate("settings")}>
                      Подробнее
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </>
              )}
              {view === "folders" && (
                <FoldersView
                  documents={documents}
                  onSelect={(value) => {
                    resetFilters();
                    setCategory(value);
                    navigate("documents");
                  }}
                />
              )}
              {view === "retention" && (
                <RetentionView
                  documents={documents}
                  onOpen={(r) => setSelectedId(r.id)}
                  windowDays={retentionWindow}
                  setWindow={setRetentionWindow}
                />
              )}
              {view === "activity" && (
                <ActivityView events={data.events} role={role} />
              )}
              {view === "settings" && (
                <SettingsView
                  documents={data.documents}
                  events={data.events}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  role={role}
                />
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              OblivionDoc<span className="footer-dot">·</span>Документы. В
              порядке.
            </span>
            <span>Прототип для образовательных организаций</span>
          </footer>
        </main>
      </div>
      {editing !== undefined && (
        <DocumentForm
          database={database}
          defaultAuthor={profile?.name}
          key={editing?.id || "new"}
          existing={editing || undefined}
          role={role}
          onClose={() => setEditing(undefined)}
          onSaved={async (record) => {
            await changed();
            setEditing(undefined);
            resetFilters();
            navigate("documents");
            setToast({
              text: editing
                ? "Карточка обновлена"
                : `Документ «${record.title}» сохранён`,
            });
          }}
        />
      )}
      {selected && (
        <DocumentDrawer
          database={database}
          record={selected}
          role={role}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setSelectedId(null);
            setEditing(selected);
          }}
          onDownload={() => download(selected)}
          onStatus={() =>
            void perform(
              () => changeStatus(selected, role),
              selected.status === "active"
                ? "Документ перенесён в архив"
                : "Документ возвращён в работу",
            )
          }
          onDelete={() => setDeleting(selected)}
          onActivity={refresh}
          busy={busy}
        />
      )}
      {deleting && (
        <Dialog
          title="Удалить документ?"
          eyebrow="УДАЛЕНИЕ ИЗ ЭТОГО БРАУЗЕРА"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <div className="confirmation-body">
            <span className="delete-symbol">
              <Trash2 size={25} />
            </span>
            <p>
              Карточка «{deleting.title}» и её файл будут удалены из локального
              архива. Восстановить их в приложении не получится. Запись об
              удалении останется в журнале.
            </p>
            <div className="confirmation-actions">
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Отмена
              </button>
              <button
                className="button button-danger"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await removeDocument(deleting, role);
                    setDeleting(null);
                    setSelectedId(null);
                  }, "Документ удалён")
                }
              >
                {busy && <LoaderCircle size={16} className="spin" />}Удалить
                навсегда
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {help && (
        <Dialog
          title="Знакомьтесь, OblivionDoc"
          eyebrow="ЭЛЕКТРОННЫЙ АРХИВ"
          onClose={() => setHelp(false)}
        >
          <div className="help-body">
            <p className="help-intro">
              Рабочее пространство для учёта документов образовательной
              организации.
            </p>
            <div>
              <Files size={20} />
              <section>
                <h3>Единый реестр</h3>
                <p>
                  Добавляйте тестовые файлы, заполняйте реквизиты и находите
                  документы по названию, номеру или автору.
                </p>
              </section>
            </div>
            <div>
              <CalendarClock size={20} />
              <section>
                <h3>Сроки хранения</h3>
                <p>
                  Задавайте дату проверки или бессрочное хранение. Список
                  ближайших сроков поможет обратить внимание на важное.
                </p>
              </section>
            </div>
            <div>
              <History size={20} />
              <section>
                <h3>Понятная история</h3>
                <p>
                  Просмотр, скачивание, изменения и архивирование сохраняются в
                  локальном журнале.
                </p>
              </section>
            </div>
            <div className="info-note">
              <Info size={20} />
              <p>
                Это демо: данные хранятся в браузере, роли переключаются для
                знакомства с интерфейсом. Для совместной работы и реальной
                авторизации нужен сервер. Используйте тестовые документы.
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={() => setHelp(false)}
            >
              Начать работу
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <Info size={18} /> : <Check size={18} />}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="Закрыть уведомление"
            onClick={() => setToast(undefined)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
