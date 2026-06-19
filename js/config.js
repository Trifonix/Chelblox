export const SAVE_KEY = 'chelblox_save_v1';
export const SAVE_VERSION = 1;
export const AUTOSAVE_INTERVAL_MS = 3000;

export const GAME_NAME_RU = 'ЧелБлокс';
export const GAME_NAME_EN = 'ChelBlox';

export const SPAWN_CONFIG = {
  police: { min: 2, max: 5 },
  firefighter: { min: 1, max: 3 },
  criminal: { min: 1, max: 4 },
  civilian: { min: 5, max: 12 },
};

export const INFLUENCE_CONFIG = {
  playerPerEvent: 5,
  servicePerSuccess: 8,
  militaryUnlock: 75,
  outfitTiers: [0, 25, 50, 75, 100],
  outfitLabels: ['Новичок', 'Горожанин', 'Помощник', 'Эксперт', 'Легенда'],
};

export const SERVICE_CITY_MAP = {
  firefighter: 'fireSafety',
  police: 'order',
  taxi: 'transport',
  military: 'safety',
};

export const CITY_STAT_LABELS = {
  fireSafety: 'Пожары',
  order: 'Порядок',
  transport: 'Транспорт',
  safety: 'Безопасность',
};
