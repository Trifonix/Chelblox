// @ts-check
import { test, expect } from '@playwright/test';
import {
  clearSave,
  startNewGame,
} from '../support/helpers.js';

test.describe('Этап 2 — система влияния', () => {
  test.beforeEach(async ({ page }) => {
    await clearSave(page);
  });

  test('HUD показывает шкалы служб и игрока', async ({ page }) => {
    await startNewGame(page);

    await expect(page.locator('#influence-panel')).toBeVisible();
    await expect(page.locator('#player-tier-label')).toHaveText('Новичок');
    await expect(page.locator('#city-index-pct')).toHaveText('50%');
  });

  test('тушение пожара повышает влияние пожарных и игрока', async ({ page }) => {
    await startNewGame(page);

    const before = await page.evaluate(() => window.__CHELBLOX_TEST__.getInfluence());

    await page.evaluate(() => {
      window.__CHELBLOX_TEST__.addInfluence('firefighter', 8);
      window.__CHELBLOX_TEST__.addInfluence('player', 5);
    });

    const after = await page.evaluate(() => window.__CHELBLOX_TEST__.getInfluence());
    expect(after.firefighter).toBe(before.firefighter + 8);
    expect(after.player).toBe(before.player + 5);
  });

  test('сводный индекс города зависит от влияния служб', async ({ page }) => {
    await startNewGame(page);

    await page.evaluate(() => {
      window.__CHELBLOX_TEST__.addInfluence('police', 40);
      window.__CHELBLOX_TEST__.addInfluence('firefighter', 60);
    });

    const stats = await page.evaluate(() => window.__CHELBLOX_TEST__.getCityStats());
    expect(stats.order).toBe(40);
    expect(stats.fireSafety).toBe(60);
  });
});

test.describe('Этап 2 — одежда и NPC', () => {
  test.beforeEach(async ({ page }) => {
    await clearSave(page);
  });

  test('уровень одежды растёт при пороге влияния игрока', async ({ page }) => {
    await startNewGame(page);

    await page.evaluate(() => window.__CHELBLOX_TEST__.addInfluence('player', 30));

    const tier = await page.evaluate(() => window.__CHELBLOX_TEST__.getOutfitTier());
    expect(tier).toBeGreaterThanOrEqual(1);
  });

  test('множитель скорости службы зависит от влияния', async ({ page }) => {
    await page.goto('/?e2e=1');
    const result = await page.evaluate(async () => {
      const { initInfluence, getMultiplier, addInfluence } = await import('/js/influence.js');
      initInfluence({});
      const low = getMultiplier('police');
      addInfluence('police', 100);
      const high = getMultiplier('police');
      return { low, high };
    });
    expect(result.high).toBeGreaterThan(result.low);
  });
});
