// These records personalize a local demonstration. They are not credentials.
const PROFILE_KEY = "obliviondoc-demo-profile";
const SESSION_KEY = "obliviondoc-demo-session";

export type DemoProfile = {
  id: string;
  name: string;
  email: string;
  organization: string;
};
export type DemoSession =
  | { kind: "guest" }
  | { kind: "profile"; profile: DemoProfile };

export function readDemoProfile(): DemoProfile | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    if (
      !saved ||
      saved.version !== 1 ||
      typeof saved.id !== "string" ||
      typeof saved.name !== "string" ||
      typeof saved.email !== "string" ||
      typeof saved.organization !== "string"
    )
      return null;
    if (
      !saved.id ||
      saved.name.trim().length < 2 ||
      saved.name.length > 80 ||
      saved.email.length > 254 ||
      !saved.email.includes("@") ||
      saved.organization.trim().length < 2 ||
      saved.organization.length > 120
    )
      return null;
    return {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      organization: saved.organization,
    };
  } catch {
    return null;
  }
}

export function readDemoSession(): DemoSession | null {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    if (id === "guest") return { kind: "guest" };
    const profile = readDemoProfile();
    return profile && id === profile.id ? { kind: "profile", profile } : null;
  } catch {
    return null;
  }
}

export function rememberDemoSession(session: DemoSession) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      session.kind === "guest" ? "guest" : session.profile.id,
    );
  } catch {
    /* The demo can still run in this tab without a retained session. */
  }
}

export function endDemoSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* No server session exists. */
  }
}

export function registerDemoProfile(input: {
  name: string;
  email: string;
  organization: string;
}): DemoProfile {
  if (readDemoProfile())
    throw new Error(
      "В этом браузере уже есть демо-профиль. Откройте вкладку «Вход».",
    );
  const name = input.name.trim(),
    email = input.email.trim().toLowerCase(),
    organization = input.organization.trim();
  if (name.length < 2 || name.length > 80)
    throw new Error("Укажите имя: от 2 до 80 символов.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Проверьте адрес электронной почты.");
  if (organization.length < 2 || organization.length > 120)
    throw new Error("Укажите название организации: от 2 до 120 символов.");
  const profile = { id: crypto.randomUUID(), name, email, organization };
  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ version: 1, ...profile }),
    );
  } catch {
    throw new Error(
      "Не удалось сохранить демо-профиль. Разрешите локальное хранилище браузера или откройте гостевое демо.",
    );
  }
  return profile;
}

export function enterDemoProfile(email: string): DemoProfile {
  const profile = readDemoProfile();
  if (!profile || profile.email !== email.trim().toLowerCase())
    throw new Error(
      "Демо-профиль с такой почтой в этом браузере не найден. Зарегистрируйтесь или откройте демоархив без регистрации.",
    );
  return profile;
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase("ru-RU");
}
