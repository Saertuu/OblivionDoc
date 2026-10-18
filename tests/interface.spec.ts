import { expect, test } from '@playwright/test';

test('the concept loads without script or asset errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('OblivionDoc.');
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  expect(errors).toEqual([]);
});

test('theme selection persists after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Включить светлую тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Включить тёмную тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('mobile navigation opens, follows a section and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Детали' }).click();
  await expect(page).toHaveURL(/#details$/);
  await expect(page.getByRole('navigation')).toBeHidden();
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toHaveAttribute('aria-expanded', 'false');
});

test('reduced motion removes decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.locator('.orb').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior)).toBe('auto');
});

for (const width of [360, 390, 768, 1440]) {
  test(`content fits the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const measurements = await page.evaluate(() => {
      const title = document.querySelector('h1')!.getBoundingClientRect();
      return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, title: { left: title.left, right: title.right }, cards: [...document.querySelectorAll('.design-card')].map(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })) };
    });
    expect(measurements.scroll).toBeLessThanOrEqual(width);
    expect(measurements.title.left).toBeGreaterThanOrEqual(0);
    expect(measurements.title.right).toBeLessThanOrEqual(width);
    for (const card of measurements.cards) { expect(card.left).toBeGreaterThanOrEqual(0); expect(card.right).toBeLessThanOrEqual(width); }
    const footerLinks = page.locator('.footer > a');
    const brandBox = await footerLinks.nth(0).boundingBox();
    const backBox = await footerLinks.nth(1).boundingBox();
    expect(brandBox!.x + brandBox!.width).toBeLessThanOrEqual(backBox!.x);
    if (width === 1440 || width === 390) await page.screenshot({ path: `test-results/concept-${width}.png`, fullPage: true, animations: 'disabled' });
  });
}
