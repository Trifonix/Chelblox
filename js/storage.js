import { SAVE_KEY, SAVE_VERSION } from './config.js';

function migrate(data) {
  const version = data.version ?? 0;

  if (version < 1) {
    data.version = 1;
    data.influence = data.influence ?? {
      player: 0,
      firefighter: 0,
      police: 0,
      taxi: 0,
      military: 0,
    };
    data.cityStats = data.cityStats ?? {
      safety: data.cityHealth ?? 100,
      order: data.cityHealth ?? 100,
      transport: data.cityHealth ?? 100,
      fireSafety: data.cityHealth ?? 100,
    };
  }

  if (!data.worldSeed) {
    data.worldSeed = ((data.timestamp || Date.now()) >>> 0) || 1;
  }

  data.version = SAVE_VERSION;
  return data;
}

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = migrate(JSON.parse(raw));
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function save(data) {
  try {
    const payload = migrate({ ...data, version: SAVE_VERSION, timestamp: Date.now() });
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
