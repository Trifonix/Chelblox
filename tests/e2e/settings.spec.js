// @ts-check
import { test, expect } from '@playwright/test';
import {
  E2E_URL,
  SETTINGS_KEY,
  clearSettings,
  waitForTestApi,
} from '../support/helpers.js';

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(E2E_URL);
    await clearSettings(page);
    await page.reload();
    await waitForTestApi(page);
  });

  test('low quality checkbox persists in localStorage', async ({ page }) => {
    await expect(page.getByTestId('setting-low-quality-start')).not.toBeChecked();

    await Promise.all([
      page.waitForNavigation(),
      page.getByTestId('setting-low-quality-start').check(),
    ]);

    await waitForTestApi(page);

    const settings = await page.evaluate(() => window.__CHELBLOX_TEST__.getSettings());
    expect(settings.lowQuality).toBe(true);

    const stored = await page.evaluate((key) => {
      try {
        return JSON.parse(localStorage.getItem(key) || '{}');
      } catch {
        return {};
      }
    }, SETTINGS_KEY);
    expect(stored.lowQuality).toBe(true);

    await expect(page.getByTestId('setting-low-quality-start')).toBeChecked();
  });
});
