import { BUILD_ID } from './buildId.js';
import { GAME_NAME_RU } from './config.js';

/** Версия игры (семантическая: major.minor.patch). */
export const GAME_VERSION = '0.3.1';

export function getVersionLabel() {
  return `v${GAME_VERSION}`;
}

export function getGameTitle() {
  return `${GAME_NAME_RU} ${getVersionLabel()}`;
}

/** Обновляет title и все элементы с атрибутом data-game-version. */
export function applyVersionToUI() {
  document.title = getGameTitle();

  const label = getVersionLabel();
  document.querySelectorAll('[data-game-version]').forEach((el) => {
    el.textContent = label;
  });
}

export function getVersionInfo() {
  return {
    version: GAME_VERSION,
    buildId: BUILD_ID,
    label: getVersionLabel(),
    title: getGameTitle(),
    assetVersion: `${GAME_VERSION}-${BUILD_ID}`,
  };
}
