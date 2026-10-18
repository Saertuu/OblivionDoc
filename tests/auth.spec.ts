import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
    await page.evaluate(() => localStorage.getItem("obliviondoc-demo-profile")),
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

test("a guest can register without losing previously uploaded documents", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть демоархив" }).click();
  await page.getByRole("button", { name: "Добавить документ" }).click();
  await page
    .getByLabel("Файл документа", { exact: true })
    .setInputFiles({
      name: "guest-note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Документ гостя остаётся после регистрации."),
    });
  await page.getByLabel("Название документа").fill("Документ гостевого архива");
  await page
    .getByRole("button", { name: "Сохранить документ", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Выйти из демоархива" }).click();
  await page
    .getByRole("group", { name: "Регистрация или вход" })
    .getByRole("button", { name: "Регистрация", exact: true })
    .click();
  await page.getByLabel("Ваше имя").fill("Тестовый Пользователь");
  await page.getByLabel("Электронная почта").fill("demo@example.org");
  await page.getByLabel("Название организации").fill("Учебная организация");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await page
    .getByRole("button", { name: "Документ гостевого архива", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("pre")).toContainText(
    "Документ гостя остаётся после регистрации.",
  );
});

test("an existing profile cannot be silently overwritten by registration", async ({
  page,
}) => {
  await register(page);
  await page.getByRole("button", { name: "Выйти из демоархива" }).click();
  await page
    .getByRole("group", { name: "Регистрация или вход" })
    .getByRole("button", { name: "Регистрация", exact: true })
    .click();
  await page.getByLabel("Ваше имя").fill("Другое Имя");
  await page.getByLabel("Электронная почта").fill("other@example.org");
  await page.getByLabel("Название организации").fill("Другая организация");
  await page.getByRole("button", { name: "Создать демо-профиль" }).click();
  await expect(page.getByRole("alert")).toContainText("уже есть демо-профиль");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("obliviondoc-demo-profile")!).email,
    ),
  ).toBe("demo@example.org");
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
