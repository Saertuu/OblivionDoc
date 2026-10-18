import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function register(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Ваше имя", { exact: true })
    .fill("Тестовый Пользователь");
  await page
    .getByLabel("Электронная почта", { exact: true })
    .fill("demo@example.org");
  await page
    .getByLabel("Название организации", { exact: true })
    .fill("Учебный центр «Пример»");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Архив документов",
  );
}

test("first visit shows registration, validated fields and an explicit demo notice", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Начните с регистрации",
  );
  await expect(page.locator(".auth-local-note")).toContainText(
    "Вход без пароля и проверки личности",
  );
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Начните с регистрации",
  );
  await page.getByLabel("Ваше имя").fill("  ");
  await page.getByLabel("Электронная почта").fill("demo@example.org");
  await page.getByLabel("Название организации").fill("Пример организации");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expect(page.getByRole("alert")).toContainText("Укажите имя");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("obliviondoc-demo-profiles"),
    ),
  ).toBeNull();
});

test("registration personalizes the archive and retains the profile on reload", async ({
  page,
}) => {
  const outbound: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") outbound.push(request.url());
  });
  await register(page);
  await expect(page.locator(".workspace-label")).toContainText(
    "Учебный центр «Пример»",
  );
  await expect(page.locator(".demo-profile")).toContainText(
    "Тестовый Пользователь",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Архив документов",
  );
  await page.getByRole("button", { name: "Добавить документ" }).click();
  await expect(page.getByLabel("Автор / ответственный")).toHaveValue(
    "Тестовый Пользователь",
  );
  expect(outbound).toEqual([]);
});

test("logout returns to login and only the saved local profile can be selected", async ({
  page,
}) => {
  await register(page);
  await page.getByRole("button", { name: "Выйти из демоархива" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "С возвращением",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "С возвращением",
  );
  await page.getByLabel("Электронная почта").fill("other@example.org");
  await page.getByRole("button", { name: "Войти в демо-профиль" }).click();
  await expect(page.getByRole("alert")).toContainText("не найден");
  await page.getByLabel("Электронная почта").fill("DEMO@example.org");
  await page.getByRole("button", { name: "Войти в демо-профиль" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Архив документов",
  );
});

async function upload(page: Page, title: string, content: string) {
  await page.getByRole("button", { name: "Добавить документ" }).click();
  await page.getByLabel("Файл документа", { exact: true }).setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(content),
  });
  await page.getByLabel("Название документа").fill(title);
  await page
    .getByRole("button", { name: "Сохранить документ", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Выйти из демоархива" }).click();
}
async function login(page: Page, email = "demo@example.org") {
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByRole("button", { name: "Войти в демо-профиль" }).click();
  await expect(
    page.getByRole("region", { name: "Реестр документов" }),
  ).toBeVisible();
}
async function registrationMode(page: Page) {
  await page
    .getByRole("group", { name: "Регистрация или вход" })
    .getByRole("button", { name: "Регистрация", exact: true })
    .click();
}
async function expectEmpty(page: Page) {
  await expect(
    page.getByRole("region", { name: "Реестр документов" }),
  ).toBeVisible();
  await expect(page.locator(".table-footer")).toContainText("0 документов");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Журнал действий" })
    .click();
  await expect(page.locator(".activity-row")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /^Все документы/ })
    .click();
}

test("new profiles are empty and never inherit guest files", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть демоархив" }).click();
  await upload(page, "Документ гостевого архива", "Только гостевой документ.");
  await logout(page);
  await registrationMode(page);
  await page.getByLabel("Ваше имя").fill("Тестовый Пользователь");
  await page.getByLabel("Электронная почта").fill("demo@example.org");
  await page.getByLabel("Название организации").fill("Учебная организация");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expectEmpty(page);
  await page.reload();
  await expect(page.locator(".table-footer")).toContainText("0 документов");
  await logout(page);
  await page.getByRole("button", { name: "Открыть демоархив" }).click();
  await page
    .getByRole("button", { name: "Документ гостевого архива", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("pre")).toContainText(
    "Только гостевой документ.",
  );
});

test("multiple accounts retain separate files and audit trails after logout and browser restart", async ({
  playwright,
}, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), "obliviondoc-accounts-"));
  const options = {
    ...testInfo.project.use.launchOptions,
    baseURL: testInfo.project.use.baseURL,
    headless: true,
  };
  let context = await playwright.chromium.launchPersistentContext(
    directory,
    options,
  );
  try {
    const page = context.pages()[0];
    await register(page);
    await expectEmpty(page);
    await upload(
      page,
      "Личный документ первого аккаунта",
      "Содержимое первого аккаунта",
    );
    await logout(page);
    await registrationMode(page);
    await page.getByLabel("Ваше имя").fill("Второй Пользователь");
    await page.getByLabel("Электронная почта").fill("second@example.org");
    await page.getByLabel("Название организации").fill("Вторая организация");
    await page.getByRole("button", { name: "Создать демо-профиль" }).click();
    await expectEmpty(page);
    await upload(
      page,
      "Личный документ второго аккаунта",
      "Содержимое второго аккаунта",
    );
    await logout(page);
    await context.close();
    context = await playwright.chromium.launchPersistentContext(
      directory,
      options,
    );
    const restored = context.pages()[0];
    await restored.goto("/");
    await expect(restored.getByRole("heading", { level: 1 })).toHaveText(
      "С возвращением",
    );
    await login(restored);
    await expect(restored.locator(".table-footer")).toContainText(
      "из 1 документ",
    );
    await expect(
      restored.getByRole("button", {
        name: "Личный документ второго аккаунта",
        exact: true,
      }),
    ).toHaveCount(0);
    await restored
      .getByRole("button", {
        name: "Личный документ первого аккаунта",
        exact: true,
      })
      .click();
    await expect(restored.getByRole("dialog").locator("pre")).toHaveText(
      "Содержимое первого аккаунта",
    );
    await restored.getByRole("button", { name: "Закрыть окно" }).click();
    await restored
      .getByRole("navigation")
      .getByRole("link", { name: "Журнал действий" })
      .click();
    await expect(restored.locator(".activity-list")).not.toContainText(
      "второго аккаунта",
    );
    await logout(restored);
    await login(restored, "second@example.org");
    await restored
      .getByRole("navigation")
      .getByRole("link", { name: /^Все документы/ })
      .click();
    await restored
      .getByRole("button", {
        name: "Личный документ второго аккаунта",
        exact: true,
      })
      .click();
    await expect(restored.getByRole("dialog").locator("pre")).toHaveText(
      "Содержимое второго аккаунта",
    );
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("duplicate email is rejected ignoring case and whitespace, without overwriting the account", async ({
  page,
}) => {
  await register(page);
  await logout(page);
  await registrationMode(page);
  await page.getByLabel("Ваше имя").fill("Другое Имя");
  await page.getByLabel("Электронная почта").fill("DEMO@example.org");
  await page.getByLabel("Название организации").fill("Другая организация");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expect(page.getByRole("alert")).toContainText("уже зарегистрирован");
  const profiles = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("obliviondoc-demo-profiles")!).profiles,
  );
  expect(profiles).toHaveLength(1);
  expect(profiles[0].name).toBe("Тестовый Пользователь");
});

test("legacy account retains its previous archive and remains available after a second registration", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть демоархив" }).click();
  await upload(page, "Документ до обновления", "Исходный файл старого профиля");
  await logout(page);
  await page.evaluate(() =>
    localStorage.setItem(
      "obliviondoc-demo-profile",
      JSON.stringify({
        version: 1,
        id: "legacy-profile",
        name: "Старый Пользователь",
        email: "old@example.org",
        organization: "Прежняя организация",
      }),
    ),
  );
  await page.reload();
  await login(page, "old@example.org");
  await page
    .getByRole("button", { name: "Документ до обновления", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("pre")).toHaveText(
    "Исходный файл старого профиля",
  );
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await logout(page);
  await registrationMode(page);
  await page.getByLabel("Ваше имя").fill("Новый Пользователь");
  await page.getByLabel("Электронная почта").fill("new@example.org");
  await page.getByLabel("Название организации").fill("Новая организация");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expectEmpty(page);
  await logout(page);
  await login(page, "old@example.org");
  await expect(
    page.getByRole("button", { name: "Документ до обновления", exact: true }),
  ).toBeVisible();
  await logout(page);
  await page.getByRole("button", { name: "Открыть демоархив" }).click();
  await expect(
    page.getByRole("region", { name: "Реестр документов" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Документ до обновления", exact: true }),
  ).toHaveCount(0);
});

test("registration handles unavailable profile storage and still offers guest access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Ваше имя").fill("Тестовый Пользователь");
  await page.getByLabel("Электронная почта").fill("demo@example.org");
  await page.getByLabel("Название организации").fill("Учебная организация");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось сохранить демо-профиль",
  );
  await page.getByRole("button", { name: "Открыть демоархив" }).click();
  await expect(
    page.getByRole("region", { name: "Реестр документов" }),
  ).toBeVisible();
});

test("registration and login have no automated accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const scan = async () =>
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  await scan();
  await page
    .getByRole("group", { name: "Регистрация или вход" })
    .getByRole("button", { name: "Вход", exact: true })
    .click();
  await scan();
  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
  await page.locator(".auth-submit").evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  await scan();
});

for (const width of [360, 390, 1440])
  test(`registration is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.getByLabel("Ваше имя").fill("Демо Пользователь");
    await expect(
      page.getByRole("button", { name: "Создать демо-профиль" }),
    ).toBeVisible();
    if (width !== 360)
      await page.screenshot({
        path: `test-results/registration-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
  });

test("simultaneous tabs keep writes and refresh notifications in their own archive", async ({
  page,
}) => {
  await register(page);
  await upload(page, "Документ профиля", "Личные данные");
  const guest = await page.context().newPage();
  await guest.goto("/");
  await guest.getByRole("button", { name: "Открыть демоархив" }).click();
  await upload(guest, "Документ в другой вкладке", "Гостевые данные");
  await upload(page, "Второй документ профиля", "Личные данные 2");
  await page.reload();
  await guest.reload();
  await expect(
    page.getByRole("region", { name: "Реестр документов" }),
  ).toBeVisible();
  await expect(
    guest.getByRole("region", { name: "Реестр документов" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Документ в другой вкладке",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    guest.getByRole("button", { name: "Второй документ профиля", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".document-table tbody tr")).toHaveCount(2);
});

test("invalid saved profile records cannot be overwritten by a new registration", async ({
  page,
}) => {
  await page.goto("/");
  const original = JSON.stringify({
    version: 2,
    profiles: [{ id: "damaged-record" }],
  });
  await page.evaluate(
    (raw) => localStorage.setItem("obliviondoc-demo-profiles", raw),
    original,
  );
  await page.getByLabel("Ваше имя").fill("Тестовый Пользователь");
  await page.getByLabel("Электронная почта").fill("demo@example.org");
  await page.getByLabel("Название организации").fill("Учебная организация");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось прочитать сохранённые профили",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("obliviondoc-demo-profiles"),
    ),
  ).toBe(original);
});
