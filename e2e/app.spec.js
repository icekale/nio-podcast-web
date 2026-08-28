import { expect, test } from '@playwright/test';

test.describe('app smoke', () => {
  test('home, player, queue, search, and album work without console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto('/');
    // 日间成功为“日间”；否则目录有新节目时为“今日更新”，跨日后为“最新更新”
    await expect(page.getByRole('heading', { name: /日间|今日更新|最新更新/ }).first()).toBeVisible();

    await page.locator('.primary-button').first().click();
    const queueTrigger = page.getByRole('button', { name: '打开播放列表' });
    await expect(queueTrigger).toBeVisible();

    await queueTrigger.click();
    const dialog = page.getByRole('dialog', { name: '播放列表' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.goto('/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: '搜索专辑' })).toBeVisible();

    await page.goto('/album/5');
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

    await page.goto('/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    const routeDuration = await page.evaluate(() => getComputedStyle(document.querySelector('.route-view')).animationDuration);
    expect(seconds(routeDuration)).toBeLessThanOrEqual(0.001);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /日间|今日更新|最新更新/ }).first()).toBeVisible();
    await page.getByRole('heading', { name: '日间' }).waitFor({ timeout: 8000 }).catch(() => {});
    const homePlay = page.locator('.primary-button').first();
    const homePlayPath = await homePlay.locator('path').getAttribute('d');
    await homePlay.click();
    await expect(homePlay).toContainText('暂停');
    const homePausePath = await homePlay.locator('path').getAttribute('d');
    expect(homePausePath).not.toBe(homePlayPath);
    await page.waitForTimeout(50);
    expect(await homePlay.locator('path').getAttribute('d')).toBe(homePausePath);

    const miniToggle = page.locator('.mini-toggle');
    await expect(miniToggle).toBeVisible();
    const playerDuration = await page.evaluate(() => getComputedStyle(document.querySelector('.mini-player')).animationDuration);
    expect(seconds(playerDuration)).toBeLessThanOrEqual(0.001);
    const miniPausePath = await miniToggle.locator('path').getAttribute('d');
    await miniToggle.click();
    await expect(miniToggle).toHaveAttribute('aria-label', '播放');
    const miniPlayPath = await miniToggle.locator('path').getAttribute('d');
    expect(miniPlayPath).not.toBe(miniPausePath);
    await page.waitForTimeout(50);
    expect(await miniToggle.locator('path').getAttribute('d')).toBe(miniPlayPath);

    await page.goto('/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    const favorite = page.locator('.album-results.is-grid .album-action button').first();
    const unfavoritedPath = await favorite.locator('path').getAttribute('d');
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    const favoritedPath = await favorite.locator('path').getAttribute('d');
    expect(favoritedPath).not.toBe(unfavoritedPath);
    await page.waitForTimeout(50);
    expect(await favorite.locator('path').getAttribute('d')).toBe(favoritedPath);

    await page.getByRole('button', { name: '打开播放列表' }).click();
    await expect(page.getByRole('dialog', { name: '播放列表' })).toBeVisible();
    const queueDuration = await page.evaluate(() => getComputedStyle(document.querySelector('.queue-sheet')).animationDuration);
    expect(seconds(queueDuration)).toBeLessThanOrEqual(0.001);
  });

  test('album grid covers align at the top of each row', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    const grid = page.locator('.album-results.is-grid').first();
    const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    const tops = await grid.locator('.album-row').evaluateAll((elements, count) => elements.slice(0, count).map(element => Math.round(element.querySelector('.album-art').getBoundingClientRect().top)), columns);
    expect(new Set(tops).size).toBe(1);
  });

  test('grid card action sits below the artwork beside the title', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    const first = page.locator('.album-results.is-grid .album-row').first();
    const artBottom = await first.locator('.album-art').evaluate(element => element.getBoundingClientRect().bottom);
    const actionTop = await first.locator('.album-action').evaluate(element => element.getBoundingClientRect().top);
    expect(actionTop).toBeGreaterThanOrEqual(artBottom - 1);

    const star = page.locator('.album-results.is-grid .album-action button').first();
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
  });

  test('mobile album favorite actions meet the minimum touch target', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto('/albums');
    const star = page.locator('.album-results.is-grid .album-action button').first();
    await expect(star).toBeVisible();

    const box = await star.boundingBox();
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
  });

  test('mobile dark-mode favorite controls stay visible and focusable', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto('/albums');
    const star = page.locator('.album-results.is-grid .album-action button').first();
    await expect(star).toBeVisible();
    await star.focus();
    await expect(star).toBeFocused();

    const box = await star.boundingBox();
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    await expect(star.locator('svg')).toBeVisible();
  });

  test('mobile album content clears the fixed player', async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /日间|今日更新|最新更新/ }).first()).toBeVisible();
    await page.locator('.primary-button').first().click();
    await expect(page.locator('.mini-player')).toBeVisible();

    await page.goto('/albums');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    const more = page.locator('#category-more');
    await more.scrollIntoViewIfNeeded();
    await more.click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(50);

    const metrics = await page.evaluate(() => {
      const app = document.querySelector('.app');
      const player = document.querySelector('.mini-player')?.getBoundingClientRect();
      const rows = [...document.querySelectorAll('#category-more + .album-results.is-grid .album-row')];
      const lastRow = rows.at(-1)?.getBoundingClientRect();
      return {
        measuredPlayerHeight: Number.parseFloat(getComputedStyle(app).getPropertyValue('--mini-player-height')),
        actualPlayerHeight: player?.height,
        clearance: player && lastRow ? player.top - lastRow.bottom : null,
      };
    });

    expect(metrics.measuredPlayerHeight).toBeGreaterThan(0);
    expect(Math.abs(metrics.measuredPlayerHeight - metrics.actualPlayerHeight)).toBeLessThanOrEqual(1);
    expect(metrics.clearance).toBeGreaterThanOrEqual(8);
  });

  test('desktop favorites page renders', async ({ page }) => {
    await page.goto('/favorites');
    await expect(page.getByRole('heading', { name: '专辑收藏' })).toBeVisible();
  });

  test('legacy hash deep links migrate to the path URL', async ({ page }) => {
    await page.goto('/#/search');
    await expect(page.getByRole('heading', { name: '全部专辑' })).toBeVisible();
    await expect(page).toHaveURL(/\/search$/);
  });
});
