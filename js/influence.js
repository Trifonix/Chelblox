import {
  INFLUENCE_CONFIG,
  SERVICE_CITY_MAP,
} from './config.js';

const DEFAULT_INFLUENCE = {
  player: 0,
  firefighter: 0,
  police: 0,
  taxi: 0,
  military: 0,
};

const DEFAULT_CITY_STATS = {
  safety: 50,
  order: 50,
  transport: 50,
  fireSafety: 50,
};

let influence = { ...DEFAULT_INFLUENCE };
let cityStats = { ...DEFAULT_CITY_STATS };
let onChange = null;

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function syncCityFromServices() {
  for (const [service, stat] of Object.entries(SERVICE_CITY_MAP)) {
    cityStats[stat] = influence[service];
  }
}

function notifyChange() {
  if (onChange) onChange(getSnapshot());
}

export function initInfluence(saved = {}, changeCallback) {
  influence = { ...DEFAULT_INFLUENCE, ...saved.influence };
  for (const key of Object.keys(influence)) {
    influence[key] = clamp(influence[key]);
  }

  if (saved.cityStats) {
    cityStats = { ...DEFAULT_CITY_STATS, ...saved.cityStats };
  } else if (saved.influence != null) {
    syncCityFromServices();
  } else {
    cityStats = { ...DEFAULT_CITY_STATS };
  }

  onChange = changeCallback ?? null;
  notifyChange();
  return getSnapshot();
}

export function getSnapshot() {
  return {
    influence: { ...influence },
    cityStats: { ...cityStats },
    cityIndex: getCityIndex(),
    playerTier: getTier('player'),
    playerTierLabel: getTierLabel('player'),
  };
}

export function addInfluence(type, amount) {
  if (!(type in influence)) return influence[type];
  influence[type] = clamp(influence[type] + amount);
  if (SERVICE_CITY_MAP[type]) {
    cityStats[SERVICE_CITY_MAP[type]] = influence[type];
  }
  notifyChange();
  return influence[type];
}

export function getInfluence(type) {
  return influence[type] ?? 0;
}

export function getAllInfluence() {
  return { ...influence };
}

export function getCityStats() {
  return { ...cityStats };
}

export function getCityIndex() {
  const values = Object.values(cityStats);
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function getTier(type) {
  const value = getInfluence(type);
  const tiers = INFLUENCE_CONFIG.outfitTiers;
  let tier = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (value >= tiers[i]) tier = i;
  }
  return tier;
}

export function getTierLabel(type) {
  return INFLUENCE_CONFIG.outfitLabels[getTier(type)] ?? '';
}

export function getMultiplier(type) {
  return 0.55 + getInfluence(type) / 125;
}

export function applyCityEvent(stat, delta) {
  if (!(stat in cityStats)) return;
  cityStats[stat] = clamp(cityStats[stat] + delta);
  notifyChange();
}

export function resetInfluence() {
  influence = { ...DEFAULT_INFLUENCE };
  cityStats = { ...DEFAULT_CITY_STATS };
  notifyChange();
}
