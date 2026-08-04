import { expect, test } from '@playwright/test';

test.describe('app smoke', () => {
  test('home, player, queue, search, and album work without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto('/#/');
    await expect(page.getByText('今日更新').first()).toBeVisible();

    await page.locator('.primary-button').first().click();
    const queueTrigger = page.getByRole('button', { name: '打开播放列表' });
    await expect(queueTrigger).toBeVisible();

    await queueTrigger.click();
    const dialog = page.getByRole('dialog', { name: '播放列表' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.goto('/#/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: '搜索专辑' })).toBeVisible();

    await page.goto('/#/album/5');
    await expect(page.getByRole('heading', { name: '节目列表' })).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('route, queue, and player animations collapse under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const seconds = value => {
      const match = String(value).match(/^([\d.e+-]+)(ms|s)?$/);
      if (!match) return Number.POSITIVE_INFINITY;
      const amount = Number(match[1]);
      return match[2] === 'ms' ? amount / 1000 : amount;
    };

    await page.goto('/#/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    const routeDuration = await page.evaluate(() => getComputedStyle(document.querySelector('.route-view')).animationDuration);
    expect(seconds(routeDuration)).toBeLessThanOrEqual(0.001);

    await page.goto('/#/');
    await page.locator('.primary-button').first().click();
    await expect(page.getByRole('region', { name: '当前播放' })).toBeVisible();
    const playerDuration = await page.evaluate(() => getComputedStyle(document.querySelector('.mini-player')).animationDuration);
    expect(seconds(playerDuration)).toBeLessThanOrEqual(0.001);

    await page.getByRole('button', { name: '打开播放列表' }).click();
    await expect(page.getByRole('dialog', { name: '播放列表' })).toBeVisible();
    const queueDuration = await page.evaluate(() => getComputedStyle(document.querySelector('.queue-sheet')).animationDuration);
    expect(seconds(queueDuration)).toBeLessThanOrEqual(0.001);
  });

  test('album grid covers align at the top of each row', async ({ page }) => {
    await page.goto('/#/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    const columns = await page.locator('.album-results.is-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    const tops = await page.locator('.album-results.is-grid .album-row').evaluateAll((elements, count) => elements.slice(0, count).map(element => Math.round(element.querySelector('.album-art').getBoundingClientRect().top)), columns);
    expect(new Set(tops).size).toBe(1);
  });

  test('grid card action sits below the artwork beside the title', async ({ page }) => {
    await page.goto('/#/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    const first = page.locator('.album-results.is-grid .album-row').first();
    const artBottom = await first.locator('.album-art').evaluate(element => element.getBoundingClientRect().bottom);
    const actionTop = await first.locator('.album-action').evaluate(element => element.getBoundingClientRect().top);
    expect(actionTop).toBeGreaterThanOrEqual(artBottom - 1);

    const star = page.locator('.album-results.is-grid .album-action button').first();
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
  });

  test('desktop favorites page renders', async ({ page }) => {
    await page.goto('/#/favorites');
    await expect(page.getByRole('heading', { name: '我的收藏' })).toBeVisible();
  });
});
