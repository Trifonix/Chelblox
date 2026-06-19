import { CITY_STAT_LABELS, INFLUENCE_CONFIG } from './config.js';

const $ = (s) => document.querySelector(s);

const SERVICE_UI = [
  { type: 'firefighter', icon: '🚒', label: 'Пожарные', bar: 'inf-fire', pct: 'inf-fire-pct' },
  { type: 'police', icon: '🚔', label: 'Полиция', bar: 'inf-police', pct: 'inf-police-pct' },
  { type: 'taxi', icon: '🚕', label: 'Такси', bar: 'inf-taxi', pct: 'inf-taxi-pct' },
  { type: 'military', icon: '🪖', label: 'Военные', bar: 'inf-military', pct: 'inf-military-pct' },
];

const CITY_UI = [
  { key: 'fireSafety', bar: 'city-fire', pct: 'city-fire-pct' },
  { key: 'order', bar: 'city-order', pct: 'city-order-pct' },
  { key: 'transport', bar: 'city-transport', pct: 'city-transport-pct' },
  { key: 'safety', bar: 'city-safety', pct: 'city-safety-pct' },
];

function barColor(value) {
  if (value > 60) return 'linear-gradient(90deg, #00b06f, #3fb950)';
  if (value > 30) return 'linear-gradient(90deg, #d29922, #e3b341)';
  return 'linear-gradient(90deg, #f85149, #da3633)';
}

function setBar(barId, pctId, value) {
  const bar = $(`#${barId}`);
  const pct = $(`#${pctId}`);
  if (!bar || !pct) return;
  const v = Math.round(value);
  bar.style.width = `${v}%`;
  bar.style.background = barColor(v);
  pct.textContent = `${v}%`;
}

export function updateInfluenceHUD(snapshot) {
  const { influence, cityStats, cityIndex, playerTierLabel } = snapshot;

  setBar('player-bar', 'player-pct', influence.player);
  const tierEl = $('#player-tier-label');
  if (tierEl) tierEl.textContent = playerTierLabel;

  const nextThreshold = INFLUENCE_CONFIG.outfitTiers[snapshot.playerTier + 1];
  const nextEl = $('#player-next-tier');
  if (nextEl) {
    nextEl.textContent = nextThreshold != null
      ? `До след. уровня: ${Math.max(0, nextThreshold - Math.round(influence.player))}`
      : 'Макс. уровень';
  }

  SERVICE_UI.forEach(({ type, bar, pct }) => {
    setBar(bar, pct, influence[type] ?? 0);
  });

  CITY_UI.forEach(({ key, bar, pct }) => {
    setBar(bar, pct, cityStats[key] ?? 0);
  });

  const indexBar = $('#city-index-bar');
  const indexPct = $('#city-index-pct');
  if (indexBar) {
    indexBar.style.width = `${cityIndex}%`;
    indexBar.style.background = barColor(cityIndex);
  }
  if (indexPct) indexPct.textContent = `${cityIndex}%`;
}

export function initInfluenceHUD() {
  updateInfluenceHUD({
    influence: { player: 0, firefighter: 0, police: 0, taxi: 0, military: 0 },
    cityStats: { safety: 50, order: 50, transport: 50, fireSafety: 50 },
    cityIndex: 50,
    playerTier: 0,
    playerTierLabel: INFLUENCE_CONFIG.outfitLabels[0],
  });
}

export { CITY_STAT_LABELS };
