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

/** Красный костюм — только у пожарных (PROJECT.md). */
export const FIREFIGHTER_COLORS = {
  suit: 0xc62828,
  helmet: 0xffd600,
};

export const NPC_CHARACTER_COLORS = {
  police: { shirt: 0x1565c0, pants: 0x212121 },
  criminal: { shirt: 0x424242, pants: 0x212121 },
  firefighter: { shirt: FIREFIGHTER_COLORS.suit, pants: FIREFIGHTER_COLORS.suit },
  civilian: {
    pants: 0x37474f,
    shirts: [0x9b59b6, 0x3498db, 0x2ecc71, 0xf39c12, 0x1abc9c, 0xe91e63, 0x795548, 0x607d8b],
  },
};
