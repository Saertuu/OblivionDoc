import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CircleHelp,
  Clock3,
  FileText,
  Mail,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { Brand } from "./Brand";
import {
  enterDemoProfile,
  hasDemoProfiles,
  registerDemoProfile,
  type DemoSession,
} from "../auth/demoSession";

export function AuthScreen({
  onEnter,
}: {
  onEnter: (session: DemoSession) => void;
}) {
  const [mode, setMode] = useState<"register" | "login">(() =>
    hasDemoProfiles() || location.hash === "#/login" ? "login" : "register",
  );
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [organization, setOrganization] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme || "light",
  );
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("obliviondoc-theme", next);
    } catch {
      /* Optional preference. */
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const profile =
        mode === "register"
          ? registerDemoProfile({ name, email, organization })
          : enterDemoProfile(email);
      onEnter({ kind: "profile", profile });
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story" aria-label="Об OblivionDoc">
        <Brand />
        <div className="auth-story-copy">
          <span className="auth-story-eyebrow">
            <span />
            АРХИВ ОБРАЗОВАТЕЛЬНОЙ ОРГАНИЗАЦИИ
          </span>
          <p className="auth-slogan">
            Важное —<br /> на своём <span>месте.</span>
          </p>
          <p className="auth-story-description">
            От первого приказа до последнего отчёта.
            <br /> Один архив, в котором легко найти главное.
          </p>
        </div>
        <div className="auth-art" aria-hidden="true">
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
            <FileText size={15} />
            Документы. В порядке.
          </div>
          <span className="art-spark spark-one">+</span>
          <span className="art-spark spark-two">+</span>
        </div>
        <div className="auth-benefits">
          <div>
            <FileText size={18} />
            <span>Единый реестр документов</span>
          </div>
          <div>
            <Clock3 size={18} />
            <span>Сроки хранения под контролем</span>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>OBLIVIONDOC</span>
          <span>
            Для тех, кто ценит порядок{" "}
            <ArrowRight size={11} className="auth-footer-arrow" />
          </span>
        </div>
      </aside>
      <main className="auth-main">
        <button
          className="icon-button auth-theme"
          aria-label={
            theme === "light" ? "Включить тёмную тему" : "Включить светлую тему"
          }
          onClick={toggleTheme}
        >
          {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
        </button>
        <div className="auth-content">
          <div className="auth-topline">
            <span className="auth-demo-tag">
              <span />
              Демонстрационная версия
            </span>
            <span>01 / НАЧАЛО РАБОТЫ</span>
          </div>
          <div
            className="auth-switch"
            role="group"
            aria-label="Регистрация или вход"
          >
            <button
              aria-pressed={mode === "register"}
              className={mode === "register" ? "selected" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Регистрация
            </button>
            <button
              aria-pressed={mode === "login"}
              className={mode === "login" ? "selected" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Вход
            </button>
          </div>
          <div className="auth-heading">
            <span className="auth-form-symbol">
              {mode === "register" ? (
                <UserRound size={21} />
              ) : (
                <FileText size={21} />
              )}
            </span>
            <h1>
              {mode === "register" ? "Начните с регистрации" : "С возвращением"}
            </h1>
            <p>
              {mode === "register"
                ? "Создайте демо-профиль и начните свой архив с чистого листа."
                : "Продолжите работу с демо-профилем этого браузера."}
            </p>
          </div>
          <form
            onSubmit={submit}
            className="auth-form"
            aria-label={
              mode === "register"
                ? "Регистрация демо-профиля"
                : "Вход в демо-профиль"
            }
          >
            {mode === "register" && (
              <label className="auth-field">
                Ваше имя
                <div>
                  <UserRound size={17} />
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Как к вам обращаться"
                  />
                </div>
              </label>
            )}
            <label className="auth-field">
              Электронная почта
              <div>
                <Mail size={17} />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@university.ru"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </label>
            {mode === "register" && (
              <label className="auth-field">
                Название организации
                <div>
                  <Building2 size={17} />
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="organization"
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                    placeholder="Учебное заведение или подразделение"
                  />
                </div>
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary auth-submit" type="submit">
              {mode === "register"
                ? "Создать демо-профиль"
                : "Войти в демо-профиль"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-local-note">
            <CircleHelp size={16} />
            <p>
              Демо-профиль хранится только в этом браузере. Вход без пароля и
              проверки личности. Подтверждение почты и настоящая авторизация
              пока не подключены.
            </p>
          </div>
          <div className="auth-divider">
            <span />
            или начните без регистрации
            <span />
          </div>
          <button
            className="button button-secondary auth-guest"
            onClick={() => onEnter({ kind: "guest" })}
          >
            Открыть демоархив
            <ArrowRight size={16} />
          </button>
          <p className="auth-storage-caption">
            Каждый новый профиль получает пустой архив. Документы сохраняются
            отдельно для каждого профиля; учебные примеры доступны гостю. Выход
            не удаляет ваши данные.
          </p>
          <footer className="auth-footer">
            <span>© {new Date().getFullYear()} OblivionDoc</span>
            <span>Документы. В порядке.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
