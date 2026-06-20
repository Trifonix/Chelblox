// @ts-check
import { test, expect } from '@playwright/test';
import { E2E_URL, waitForTestApi } from '../support/helpers.js';

test.describe('version', () => {
  test('version shown in UI and test API', async ({ page }) => {
    await page.goto(E2E_URL);
    await waitForTestApi(page);

    await expect(page.getByTestId('game-version')).toHaveText('v0.3.2');
    await expect(page).toHaveTitle('ЧелБлокс v0.3.2');

    const info = await page.evaluate(() => window.__CHELBLOX_TEST__.getVersionInfo());
    expect(info).toEqual({
      version: '0.3.2',
      buildId: 'dev',
      label: 'v0.3.2',
      title: 'ЧелБлокс v0.3.2',
      assetVersion: '0.3.2-dev',
    });
  });
});
