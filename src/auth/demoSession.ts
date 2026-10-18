// These records personalize a local demonstration. They are not credentials.
const LEGACY_PROFILE_KEY = "obliviondoc-demo-profile";
const PROFILES_KEY = "obliviondoc-demo-profiles";
const SESSION_KEY = "obliviondoc-demo-session";

export type DemoProfile = {
  id: string;
  name: string;
  email: string;
  organization: string;
  legacyArchive?: true;
};
export type DemoSession =
  | { kind: "guest" }
  | { kind: "profile"; profile: DemoProfile };

function validProfile(saved: unknown): saved is DemoProfile {
  if (!saved || typeof saved !== "object") return false;
  const p = saved as DemoProfile;
  return (
    typeof p.id === "string" &&
    /^[a-zA-Z0-9-]{1,80}$/.test(p.id) &&
    typeof p.name === "string" &&
    p.name.trim().length >= 2 &&
    p.name.length <= 80 &&
    typeof p.email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) &&
    p.email.length <= 254 &&
    typeof p.organization === "string" &&
    p.organization.trim().length >= 2 &&
    p.organization.length <= 120 &&
    (p.legacyArchive === undefined || p.legacyArchive === true)
  );
}

export function readDemoProfiles(): DemoProfile[] {
  const corrupt = () =>
    new Error(
      "Не удалось прочитать сохранённые профили. Не очищайте данные браузера: сохраните резервную копию и обратитесь за помощью.",
    );
  const parse = (raw: string) => {
    try {
      return JSON.parse(raw);
    } catch {
      throw corrupt();
    }
  };
  const raw = localStorage.getItem(PROFILES_KEY);
  if (raw !== null) {
    const saved = parse(raw);
    if (
      saved?.version !== 2 ||
      !Array.isArray(saved.profiles) ||
      !saved.profiles.every(validProfile) ||
      new Set(saved.profiles.map((p: DemoProfile) => p.email.toLowerCase()))
        .size !== saved.profiles.length ||
      new Set(saved.profiles.map((p: DemoProfile) => p.id)).size !==
        saved.profiles.length
    )
      throw new Error(
        "Не удалось прочитать сохранённые профили. Не очищайте данные браузера: сохраните резервную копию и обратитесь за помощью.",
      );
    return saved.profiles;
  }
  const legacy = parse(localStorage.getItem(LEGACY_PROFILE_KEY) || "null");
  if (legacy?.version === 1 && validProfile(legacy))
    return [
      {
        id: legacy.id,
        name: legacy.name,
        email: legacy.email.trim().toLowerCase(),
        organization: legacy.organization,
        legacyArchive: true,
      },
    ];
  if (legacy !== null) throw corrupt();
  return [];
}

export function hasDemoProfiles() {
  try {
    return readDemoProfiles().length > 0;
  } catch {
    return false;
  }
}

export function archiveForSession(session: DemoSession) {
  if (session.kind === "profile")
    return session.profile.legacyArchive
      ? "obliviondoc-archive"
      : `obliviondoc-archive-profile-${session.profile.id}`;
  try {
    if (readDemoProfiles().some((p) => p.legacyArchive))
      return "obliviondoc-archive-guest";
  } catch {
    return "obliviondoc-archive-guest";
  }
  return "obliviondoc-archive";
}

export function readDemoSession(): DemoSession | null {
  try {
    const id = sessionStorage.getItem(SESSION_KEY);
    if (id === "guest") return { kind: "guest" };
    const profile = readDemoProfiles().find((p) => p.id === id);
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
  const name = input.name.trim(),
    email = input.email.trim().toLowerCase(),
    organization = input.organization.trim();
  if (name.length < 2 || name.length > 80)
    throw new Error("Укажите имя: от 2 до 80 символов.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Проверьте адрес электронной почты.");
  if (organization.length < 2 || organization.length > 120)
    throw new Error("Укажите название организации: от 2 до 120 символов.");
  let profiles: DemoProfile[];
  try {
    profiles = readDemoProfiles();
  } catch (error) {
    if (error instanceof Error && error.message.includes("сохранённые профили"))
      throw error;
    throw new Error(
      "Не удалось сохранить демо-профиль. Разрешите локальное хранилище браузера или откройте гостевое демо.",
    );
  }
  if (profiles.some((p) => p.email.toLowerCase() === email))
    throw new Error(
      "Профиль с такой почтой уже зарегистрирован в этом браузере. Откройте вкладку «Вход».",
    );
  const profile = { id: crypto.randomUUID(), name, email, organization };
  try {
    localStorage.setItem(
      PROFILES_KEY,
      JSON.stringify({ version: 2, profiles: [...profiles, profile] }),
    );
  } catch {
    throw new Error(
      "Не удалось сохранить демо-профиль. Разрешите локальное хранилище браузера или откройте гостевое демо.",
    );
  }
  return profile;
}

export function enterDemoProfile(email: string): DemoProfile {
  const profile = readDemoProfiles().find(
    (p) => p.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!profile)
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
