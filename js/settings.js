import { isMobileDevice } from './mobile.js';

export const SETTINGS_KEY = 'chelblox_settings_v1';

const DEFAULTS = {
  lowQuality: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULTS, lowQuality: isMobileDevice() };
    }
    const data = JSON.parse(raw);
    return { ...DEFAULTS, ...data, lowQuality: Boolean(data.lowQuality) };
  } catch {
    return { ...DEFAULTS, lowQuality: isMobileDevice() };
  }
}

export function saveSettings(settings) {
  try {
    const payload = { ...DEFAULTS, ...settings, lowQuality: Boolean(settings.lowQuality) };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function isLowQuality() {
  return loadSettings().lowQuality;
}
