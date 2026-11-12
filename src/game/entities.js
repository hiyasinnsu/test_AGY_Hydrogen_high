import {
  BULLET_COLORS,
  BULLET_SHAPES,
  GAME_WIDTH,
  PLAYER_GRAZE_RADIUS,
  PLAYER_HITBOX_RADIUS,
  PLAYER_START_X,
  PLAYER_START_Y,
} from './constants.js';

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function distSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function pointToSegmentDistSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return distSq(px, py, x1, y1);
  }
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return distSq(px, py, projX, projY);
}

export function normalizeColor(color) {
  return BULLET_COLORS.includes(color) ? color : 'cyan';
}

export function normalizeShape(shape) {
  return BULLET_SHAPES.includes(shape) ? shape : 'orb';
}

export function createPlayer(difficultyConfig) {
  return {
    x: PLAYER_START_X,
    y: PLAYER_START_Y,
    hitboxRadius: PLAYER_HITBOX_RADIUS,
    grazeRadius: PLAYER_GRAZE_RADIUS,
    lives: difficultyConfig.startLives,
    bombs: difficultyConfig.startBombs,
    invulnTimer: 0,
    focus: false,
    alive: true,
    respawnTimer: 0,
    shotCooldown: 0,
    bombTimer: 0,
  };
}

export function createPlayerBullet({
  x,
  y,
  vx = 0,
  vy = -680,
  radius = 4,
  damage = 10,
  kind = 'main',
  homing = false,
  homingStrength = 7,
}) {
  return {
    x,
    y,
    vx,
    vy,
    radius,
    damage,
    kind,
    homing,
    homingStrength,
  };
}

export function createEnemy({
  id,
  x = GAME_WIDTH / 2,
  y = -32,
  radius = 16,
  hp = 60,
  kind = 'scout',
  name = '',
  isBoss = false,
  phases = null,
  spellName = '',
  moveFn = null,
  patternFn = null,
  dropTable = null,
  scoreValue = 300,
}) {
  const activePhases = Array.isArray(phases) && phases.length > 0 ? phases : null;
  const initialHp = activePhases ? activePhases[0].hp : hp;
  const initialSpell = activePhases ? activePhases[0].spellName || '' : spellName;

  return {
    id,
    x,
    y,
    startX: x,
    startY: y,
    radius,
    hp: initialHp,
    maxHp: initialHp,
    kind,
    name,
    isBoss,
    phaseIndex: 0,
    maxPhases: activePhases ? activePhases.length : 1,
    spellName: initialSpell,
    phases: activePhases,
    moveFn: activePhases ? activePhases[0].moveFn || moveFn : moveFn,
    patternFn: activePhases ? activePhases[0].patternFn || patternFn : patternFn,
    dropTable: dropTable || { power: 1, score: 2, bomb: 0, life: 0 },
    scoreValue,
    angle: Math.PI / 2,
    hitFlash: 0,
    age: 0,
    fireTimer: 0.25,
    step: 0,
    targetX: x,
    targetY: 110,
  };
}

export function createEnemyBullet({
  x,
  y,
  vx = 0,
  vy = 140,
  radius = 4.5,
  color = 'cyan',
  shape = 'orb',
  angle = null,
  spin = 0,
  behavior = 'linear',
  decelTime = 0.55,
  pauseTime = 0.25,
  accelSpeed = 190,
  accelAngleOffset = 0,
  aimOnAccel = false,
}) {
  const resolvedAngle = angle !== null ? angle : Math.atan2(vy, vx);
  return {
    x,
    y,
    vx,
    vy,
    radius,
    color: normalizeColor(color),
    shape: normalizeShape(shape),
    angle: resolvedAngle,
    grazeCounted: false,
    age: 0,
    spin,
    behavior,
    initialSpeed: Math.hypot(vx, vy),
    decelTime,
    pauseTime,
    accelSpeed,
    accelAngleOffset,
    aimOnAccel,
    accelerated: false,
  };
}

export function createLaser({
  x1,
  y1,
  x2,
  y2,
  width = 14,
  telegraphTime = 0.85,
  activeTime = 0.65,
  color = 'magenta',
  ownerId = null,
}) {
  return {
    x1,
    y1,
    x2,
    y2,
    width,
    state: 'telegraph',
    timer: telegraphTime,
    telegraphTime,
    activeTime,
    color: normalizeColor(color),
    ownerId,
    grazeCooldown: 0,
  };
}

export function createItem({
  x,
  y,
  vx = 0,
  vy = -90,
  kind = 'score',
  radius = 8,
}) {
  return {
    x,
    y,
    vx,
    vy,
    kind,
    radius,
    magnetized: false,
  };
}
