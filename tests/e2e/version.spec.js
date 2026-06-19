// @ts-check
import { test, expect } from '@playwright/test';
import { E2E_URL, waitForTestApi } from '../support/helpers.js';

test.describe('version', () => {
  test('version shown in UI and test API', async ({ page }) => {
    await page.goto(E2E_URL);
    await waitForTestApi(page);

    await expect(page.getByTestId('game-version')).toHaveText('v0.2.1');
    await expect(page).toHaveTitle('ЧелБлокс v0.2.1');

    const info = await page.evaluate(() => window.__CHELBLOX_TEST__.getVersionInfo());
    expect(info).toEqual({
      version: '0.2.1',
      label: 'v0.2.1',
      title: 'ЧелБлокс v0.2.1',
    });
  });
});
