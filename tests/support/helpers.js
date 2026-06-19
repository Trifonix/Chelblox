// @ts-check

export const SAVE_KEY = 'chelblox_save_v1';
export const SETTINGS_KEY = 'chelblox_settings_v1';
export const E2E_URL = '/?e2e=1';

/** @param {import('@playwright/test').Page} page */
export async function clearSave(page) {
  await page.goto(E2E_URL);
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
}

/** @param {import('@playwright/test').Page} page */
export async function clearSettings(page) {
  await page.evaluate((key) => localStorage.removeItem(key), SETTINGS_KEY);
}

/** @param {import('@playwright/test').Page} page */
export async function waitForTestApi(page) {
  await page.waitForFunction(() => typeof window.__CHELBLOX_TEST__ === 'object');
}

/** @param {import('@playwright/test').Page} page */
export async function waitForGameRunning(page) {
  await waitForTestApi(page);
  await page.waitForFunction(() => window.__CHELBLOX_TEST__?.isRunning?.() === true);
}

/** @param {import('@playwright/test').Page} page */
export async function startNewGame(page) {
  await page.goto(E2E_URL);
  await waitForTestApi(page);
  await page.getByTestId('btn-play').click();
  await waitForGameRunning(page);
}

/** @param {import('@playwright/test').Page} page */
export async function movePlayer(page, ms = 2000) {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(ms);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(300);
}

/** @param {import('@playwright/test').Page} page */
export async function flushSave(page) {
  await page.evaluate(() => window.__CHELBLOX_TEST__.flushSave());
}

/** @param {import('@playwright/test').Page} page */
export async function openPauseMenu(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  if (!(await page.getByTestId('overlay-pause').isVisible())) {
    await page.keyboard.press('Escape');
  }
  await page.getByTestId('overlay-pause').waitFor({ state: 'visible' });
}

/** @param {number} a @param {number} b @param {number} [eps] */
export function near(a, b, eps = 0.75) {
  return Math.abs(a - b) <= eps;
}
