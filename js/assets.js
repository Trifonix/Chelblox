import { BUILD_ID } from './buildId.js';
import { GAME_VERSION } from './version.js';

/** Query-string для сброса кэша CSS/JS после каждого деплоя. */
export function getAssetQuery() {
  return `?v=${encodeURIComponent(`${GAME_VERSION}-${BUILD_ID}`)}`;
}

export function getAssetVersion() {
  return `${GAME_VERSION}-${BUILD_ID}`;
}
