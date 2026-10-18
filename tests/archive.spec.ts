import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

const FIRST = "Об организации учебного процесса";
async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Архив документов",
  );
  await expect(
    page.getByRole("region", { name: "Реестр документов" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function add(page: Page, title: string, visibility = "all") {
  await page
    .getByRole("button", { name: "Добавить документ", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Файл документа", { exact: true }).setInputFiles({
    name: "test-archive.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Тестовый файл OblivionDoc. Проверка сохранности содержимого.\n",
      "utf8",
    ),
  });
  await dialog.getByLabel("Название документа").fill(title);
  await dialog.getByLabel("Регистрационный номер").fill("ПР-2026-009");
  await dialog
    .getByRole("combobox", { name: "Доступ", exact: true })
    .selectOption(visibility);
  await dialog
    .getByRole("button", { name: "Сохранить документ", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
}

test("archive loads sample records without runtime or asset failures", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await ready(page);
  await expect(page.locator(".document-table tbody tr")).toHaveCount(6);
  await expect(page.locator(".table-footer")).toContainText("из 8 документов");
  await page.getByRole("button", { name: "Следующая страница" }).click();
  await expect(page.locator(".document-table tbody tr")).toHaveCount(2);
  expect(failures).toEqual([]);
});

test("uploaded bytes and metadata survive reload and can be downloaded", async ({
  page,
}) => {
  await ready(page);
  await add(page, "Протокол заседания тестовой комиссии");
  await page.reload();
  await page
    .getByRole("textbox", { name: "Поиск документов" })
    .fill("ПР-2026-009");
  await expect(page.locator(".document-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Протокол заседания тестовой комиссии",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("pre")).toContainText(
    "Проверка сохранности содержимого.",
  );
  const pending = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Скачать файл", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("test-archive.txt");
  expect(await readFile((await download.path())!, "utf8")).toBe(
    "Тестовый файл OblivionDoc. Проверка сохранности содержимого.\n",
  );
});

for (const extension of ["pdf", "docx"])
  test(`${extension.toUpperCase()} upload preserves original bytes and shows the appropriate preview`, async ({
    page,
  }) => {
    await ready(page);
    await page
      .getByRole("button", { name: "Добавить документ", exact: true })
      .click();
    const fixture = `tests/fixtures/sample.${extension}`;
    const title = `Тестовый документ ${extension.toUpperCase()}`;
    await page
      .getByLabel("Файл документа", { exact: true })
      .setInputFiles(fixture);
    await page.getByLabel("Название документа").fill(title);
    await page
      .getByRole("button", { name: "Сохранить документ", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: title, exact: true }).click();
    const drawer = page.getByRole("dialog");
    if (extension === "pdf") {
      await expect(drawer.locator("canvas")).toHaveAttribute(
        "data-rendered",
        "true",
      );
      await expect(drawer.locator(".pdf-viewer .sr-only")).toContainText(
        "OblivionDoc demo document",
      );
      await drawer.screenshot({
        path: "test-results/pdf-preview.png",
        animations: "disabled",
      });
    } else {
      await expect(
        drawer.getByText("Для этого формата предпросмотр недоступен."),
      ).toBeVisible();
    }
    const pending = page.waitForEvent("download");
    await drawer
      .getByRole("button", { name: "Скачать файл", exact: true })
      .first()
      .click();
    const download = await pending;
    expect(await readFile((await download.path())!)).toEqual(
      await readFile(fixture),
    );
  });

test("metadata edits keep the file and support indefinite retention", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: FIRST, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Изменить карточку" })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Название документа").fill("Изменённый учебный приказ");
  await form.getByLabel("Бессрочное хранение").check();
  await form
    .getByRole("combobox", { name: "Категория", exact: true })
    .selectOption("Локальные акты");
  await form.getByRole("button", { name: "Сохранить изменения" }).click();
  await page
    .getByRole("button", { name: "Изменённый учебный приказ", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator("pre")).toContainText(
    "ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ",
  );
  await expect(page.getByRole("dialog").locator(".metadata")).toContainText(
    "Бессрочно",
  );
  await expect(page.getByRole("dialog").locator(".metadata")).toContainText(
    "Локальные акты",
  );
});

test("archiving and restoration persist and appear in the audit trail", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: FIRST, exact: true }).click();
  await page
    .getByRole("button", { name: "Перенести в архив", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator(".status-badge")).toHaveText(
    "В архиве",
  );
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page.reload();
  await page
    .getByRole("group", { name: "Статус документов" })
    .getByRole("button", { name: /^В архиве/ })
    .click();
  await page.getByRole("button", { name: FIRST, exact: true }).click();
  await page.getByRole("button", { name: "Вернуть в работу" }).click();
  await expect(page.getByRole("dialog").locator(".status-badge")).toHaveText(
    "Действующий",
  );
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Журнал действий" })
    .click();
  await expect(page.locator(".activity-list")).toContainText(
    "Перенесён в архив",
  );
  await expect(page.locator(".activity-list")).toContainText(
    "Возвращён в работу",
  );
});

test("reader demo role hides restricted documents and modifying controls", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Демонстрационная роль").selectOption("reader");
  await expect(
    page.getByRole("button", { name: "Добавить документ" }),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "Поиск документов" }).fill("ДГ-106");
  await expect(
    page.getByRole("heading", { name: "Документы не найдены" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Поиск документов" }).fill("УЧ-014");
  await page.getByRole("button", { name: FIRST, exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Изменить карточку" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Перенести в архив" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Закрыть окно" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Журнал действий" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Журнал доступен сотрудникам архива" }),
  ).toBeVisible();
});

test("administrator deletion removes the file but retains the audit record", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Демонстрационная роль").selectOption("admin");
  await page.getByRole("button", { name: FIRST, exact: true }).click();
  await page
    .getByRole("button", { name: "Удалить документ", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Удалить документ?" })
    .getByRole("button", { name: "Удалить навсегда" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("obliviondoc-archive");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise<unknown>((resolve) => {
      const request = db
        .transaction("files")
        .objectStore("files")
        .get("demo-1");
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return value === undefined;
  });
  expect(stored).toBe(true);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Журнал действий" })
    .click();
  const row = page
    .locator(".activity-row")
    .filter({ hasText: "Удалён документ" });
  await expect(row).toContainText(FIRST);
});

test("search, category and department filters combine and CSV exports matching records", async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel("Категория документов").selectOption("Приказы");
  await page
    .getByLabel("Подразделение документов")
    .selectOption("Учебный отдел");
  await expect(page.locator(".document-table tbody tr")).toHaveCount(2);
  await page.getByRole("textbox", { name: "Поиск документов" }).fill("уч-014");
  await expect(page.locator(".document-table tbody tr")).toHaveCount(1);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт CSV" }).click();
  const file = await pending,
    csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain(FIRST);
  expect(csv).not.toContain("Приказ об утверждении расписания");
});

test("spreadsheet formula prefixes are escaped in CSV exports", async ({
  page,
}) => {
  await ready(page);
  await add(page, "=1+1");
  await page.getByRole("textbox", { name: "Поиск документов" }).fill("=1+1");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт CSV" }).click();
  const file = await pending;
  expect(await readFile((await file.path())!, "utf8")).toContain('"\'=1+1"');
});

test("invalid files are rejected and retention dates cannot precede document dates", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Добавить документ" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Файл документа", { exact: true }).setInputFiles({
    name: "program.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("bad"),
  });
  await expect(dialog.getByRole("alert")).toContainText("Поддерживаются");
  await dialog.getByLabel("Файл документа", { exact: true }).setInputFiles({
    name: "empty.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(""),
  });
  await expect(dialog.getByRole("alert")).toContainText("пуст");
  await dialog.getByLabel("Файл документа", { exact: true }).setInputFiles({
    name: "valid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("valid"),
  });
  await dialog.getByLabel("Дата документа").fill("2026-10-18");
  await dialog.getByLabel("Хранить до").fill("2026-10-17");
  expect(
    await dialog
      .getByLabel("Хранить до")
      .evaluate((element: HTMLInputElement) => element.validity.rangeUnderflow),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Сохранить документ" }).click();
  await expect(dialog).toBeVisible();
});

test("retention view includes overdue records without automatically deleting them", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /^Сроки хранения/ })
    .click();
  await expect(page.locator(".retention-row")).toHaveCount(4);
  await expect(page.locator(".retention-list")).toContainText("Срок истёк");
  await page
    .getByRole("button", { name: /Отчёт по внутренней проверке/ })
    .click();
  await expect(page.getByRole("dialog").locator("pre")).toContainText(
    "ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ",
  );
});

test("theme, keyboard shortcut and modal focus behavior work", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("/");
  await expect(
    page.getByRole("textbox", { name: "Поиск документов" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Добавить документ" }).click();
  const focusIsInside = await page
    .getByRole("dialog")
    .evaluate((element) => element.contains(document.activeElement));
  expect(focusIsInside).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("storage failure is shown with recovery guidance", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Локальное хранилище недоступно в этом браузере.");
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Архив пока недоступен" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Повторить попытку" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Добавить документ" }),
  ).toBeDisabled();
});

test("skip navigation focuses content without changing the current archive section", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Разделы архива" })
    .click();
  await page.getByRole("link", { name: "Перейти к содержимому" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveURL(/#\/folders$/);
});

test("mobile sidebar navigates and dismisses", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Разделы архива" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Разделы архива",
  );
  await expect(page.locator(".sidebar")).not.toHaveClass(/is-open/);
  await page.getByRole("button", { name: "Открыть меню" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar")).not.toHaveClass(/is-open/);
});

test("archive and upload dialog meet automated accessibility checks", async ({
  page,
}) => {
  await ready(page);
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
  await page.getByRole("button", { name: "Добавить документ" }).click();
  await page
    .getByRole("dialog")
    .evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
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
});

test("dark theme meets automated accessibility checks", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Включить тёмную тему" }).click();
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
});

for (const width of [360, 390, 768, 1440])
  test(`responsive archive at ${width}px respects reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ready(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      await page
        .locator(".paper-front")
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: `test-results/archive-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
  });
