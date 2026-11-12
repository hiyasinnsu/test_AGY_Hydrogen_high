export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 640;

export const MAX_DT = 0.05;

export const PLAYER_HITBOX_RADIUS = 3;
export const PLAYER_GRAZE_RADIUS = 18;
export const PLAYER_START_X = GAME_WIDTH / 2;
export const PLAYER_START_Y = GAME_HEIGHT - 96;

export const PLAYER_BOUNDS = {
  minX: 16,
  maxX: GAME_WIDTH - 16,
  minY: 44,
  maxY: GAME_HEIGHT - 24,
};

export const PLAYER_FOCUS_SCALE = 0.5;
export const PLAYER_SHOT_INTERVAL = 0.075;
export const PLAYER_RESPAWN_DELAY = 0.6;
export const PLAYER_INVULN_DURATION = 2.5;
export const BOMB_DURATION = 1.6;
export const BOMB_INVULN_DURATION = 2.2;

export const ITEM_COLLECT_LINE_Y = 160;
export const ITEM_MAGNET_SPEED = 420;
export const ITEM_FALL_SPEED = 95;

export const POWER_MAX = 100;
export const POWER_LEVEL_THRESHOLDS = [0, 25, 55, 85];

export const COMBO_DECAY_TIME = 2.5;
export const STAGE_CLEAR_DURATION = 2.4;

export const BULLET_COLORS = [
  'cyan',
  'magenta',
  'amber',
  'lime',
  'violet',
  'crimson',
  'white',
];

export const BULLET_SHAPES = [
  'orb',
  'needle',
  'rice',
  'diamond',
  'ring',
];

export const DIFFICULTIES = {
  easy: {
    key: 'easy',
    label: 'EASY',
    bulletSpeedScale: 0.75,
    bulletCountScale: 0.72,
    fireRateScale: 0.82,
    startLives: 4,
    startBombs: 3,
    scoreScale: 0.8,
  },
  normal: {
    key: 'normal',
    label: 'NORMAL',
    bulletSpeedScale: 1.0,
    bulletCountScale: 1.0,
    fireRateScale: 1.0,
    startLives: 3,
    startBombs: 3,
    scoreScale: 1.0,
  },
  hard: {
    key: 'hard',
    label: 'HARD',
    bulletSpeedScale: 1.25,
    bulletCountScale: 1.32,
    fireRateScale: 1.2,
    startLives: 2,
    startBombs: 2,
    scoreScale: 1.5,
  },
};

export function getPowerLevel(power) {
  if (power >= POWER_LEVEL_THRESHOLDS[3]) return 4;
  if (power >= POWER_LEVEL_THRESHOLDS[2]) return 3;
  if (power >= POWER_LEVEL_THRESHOLDS[1]) return 2;
  return 1;
}

export function getDifficultyConfig(difficulty) {
  return DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
}
