import { GAME_HEIGHT, GAME_WIDTH } from './constants.js';
import { angleTo, createEnemyBullet, createLaser } from './entities.js';

export function scaleCount(count, difficulty, min = 1) {
  return Math.max(min, Math.round(count * difficulty.bulletCountScale));
}

export function scaleSpeed(speed, difficulty) {
  return speed * difficulty.bulletSpeedScale;
}

/**
 * Aimed n-way spread toward the player.
 */
export function emitAimedNWay(ctx, {
  x,
  y,
  ways = 3,
  spread = 0.45,
  speed = 175,
  color = 'cyan',
  shape = 'needle',
  radius = 4.5,
  angleOffset = 0,
} = {}) {
  const { player, difficulty, spawnBullet } = ctx;
  const originX = x ?? ctx.enemy.x;
  const originY = y ?? ctx.enemy.y;
  const count = scaleCount(ways, difficulty, 1);
  const baseAngle = angleTo(originX, originY, player.x, player.y) + angleOffset;
  const bulletSpeed = scaleSpeed(speed, difficulty);

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
    const a = baseAngle + t * spread;
    spawnBullet(createEnemyBullet({
      x: originX,
      y: originY,
      vx: Math.cos(a) * bulletSpeed,
      vy: Math.sin(a) * bulletSpeed,
      angle: a,
      radius,
      color,
      shape,
    }));
  }
}

/**
 * Full 360-degree omnidirectional ring.
 */
export function emitRing(ctx, {
  x,
  y,
  count = 16,
  speed = 135,
  angleOffset = 0,
  color = 'magenta',
  shape = 'orb',
  radius = 4.5,
  spin = 0,
  layers = 1,
  layerSpeedStep = 22,
} = {}) {
  const { difficulty, spawnBullet } = ctx;
  const originX = x ?? ctx.enemy.x;
  const originY = y ?? ctx.enemy.y;
  const n = scaleCount(count, difficulty, 4);
  const step = (Math.PI * 2) / n;

  for (let l = 0; l < layers; l++) {
    const spd = scaleSpeed(speed + l * layerSpeedStep, difficulty);
    const layerOffset = angleOffset + (l % 2 === 1 ? step * 0.5 : 0);
    for (let i = 0; i < n; i++) {
      const a = layerOffset + i * step;
      spawnBullet(createEnemyBullet({
        x: originX,
        y: originY,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        angle: a,
        radius,
        color,
        shape,
        spin,
      }));
    }
  }
}

/**
 * Rotating spiral / vortex arms.
 */
export function emitSpiral(ctx, {
  x,
  y,
  arms = 4,
  baseAngle = 0,
  speed = 145,
  color = 'amber',
  shape = 'rice',
  radius = 4.2,
  spin = 0,
} = {}) {
  const { difficulty, spawnBullet } = ctx;
  const originX = x ?? ctx.enemy.x;
  const originY = y ?? ctx.enemy.y;
  const armCount = Math.max(2, scaleCount(arms, difficulty, 2));
  const spd = scaleSpeed(speed, difficulty);

  for (let i = 0; i < armCount; i++) {
    const a = baseAngle + (i * Math.PI * 2) / armCount;
    spawnBullet(createEnemyBullet({
      x: originX,
      y: originY,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      angle: a,
      radius,
      color,
      shape,
      spin,
    }));
  }
}

/**
 * Intersecting cross streams (two symmetric angled fans creating weave lanes).
 */
export function emitCrossStream(ctx, {
  x,
  y,
  count = 5,
  arc = 1.1,
  tilt = 0.35,
  speed = 150,
  colorA = 'cyan',
  colorB = 'violet',
  shape = 'diamond',
  radius = 4.5,
} = {}) {
  const { difficulty, spawnBullet } = ctx;
  const originX = x ?? ctx.enemy.x;
  const originY = y ?? ctx.enemy.y;
  const n = scaleCount(count, difficulty, 2);
  const spd = scaleSpeed(speed, difficulty);

  const emitFan = (centerAngle, color) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1)) - 0.5;
      const a = centerAngle + t * arc;
      spawnBullet(createEnemyBullet({
        x: originX,
        y: originY,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        angle: a,
        radius,
        color,
        shape,
      }));
    }
  };

  emitFan(Math.PI / 2 - tilt, colorA);
  emitFan(Math.PI / 2 + tilt, colorB);
}

/**
 * Decelerate-then-reaccelerate ring (bullets bloom out, pause, then dart forward/angled/aimed).
 */
export function emitDecelAccelRing(ctx, {
  x,
  y,
  count = 14,
  initialSpeed = 210,
  accelSpeed = 220,
  decelTime = 0.5,
  pauseTime = 0.25,
  accelAngleOffset = 0.35,
  aimOnAccel = false,
  angleOffset = 0,
  color = 'lime',
  shape = 'diamond',
  radius = 5,
} = {}) {
  const { difficulty, spawnBullet } = ctx;
  const originX = x ?? ctx.enemy.x;
  const originY = y ?? ctx.enemy.y;
  const n = scaleCount(count, difficulty, 5);
  const step = (Math.PI * 2) / n;
  const v0 = scaleSpeed(initialSpeed, difficulty);
  const v1 = scaleSpeed(accelSpeed, difficulty);

  for (let i = 0; i < n; i++) {
    const a = angleOffset + i * step;
    spawnBullet(createEnemyBullet({
      x: originX,
      y: originY,
      vx: Math.cos(a) * v0,
      vy: Math.sin(a) * v0,
      angle: a,
      radius,
      color,
      shape,
      behavior: 'decel_accel',
      decelTime,
      pauseTime,
      accelSpeed: v1,
      accelAngleOffset,
      aimOnAccel,
    }));
  }
}

/**
 * Ray-cast endpoint against arena bounds so lasers always span the screen cleanly.
 */
function computeLaserEnd(x1, y1, angle, length = 780) {
  return {
    x2: x1 + Math.cos(angle) * length,
    y2: y1 + Math.sin(angle) * length,
  };
}

/**
 * Telegraphed laser from origin at a fixed or aimed angle.
 */
export function emitLaser(ctx, {
  x,
  y,
  angle = Math.PI / 2,
  width = 14,
  telegraphTime = 0.85,
  activeTime = 0.65,
  color = 'magenta',
} = {}) {
  const originX = x ?? ctx.enemy.x;
  const originY = y ?? ctx.enemy.y;
  const { x2, y2 } = computeLaserEnd(originX, originY, angle);
  ctx.spawnLaser(createLaser({
    x1: originX,
    y1: originY,
    x2,
    y2,
    width,
    telegraphTime,
    activeTime,
    color,
    ownerId: ctx.enemy.id,
  }));
}

export function emitAimedLaser(ctx, opts = {}) {
  const originX = opts.x ?? ctx.enemy.x;
  const originY = opts.y ?? ctx.enemy.y;
  const angle = angleTo(originX, originY, ctx.player.x, ctx.player.y) + (opts.angleOffset || 0);
  emitLaser(ctx, { ...opts, x: originX, y: originY, angle });
}

export function emitFanLasers(ctx, {
  x,
  y,
  ways = 3,
  spread = 0.7,
  centerAngle = null,
  width = 12,
  telegraphTime = 0.9,
  activeTime = 0.65,
  color = 'crimson',
} = {}) {
  const originX = x ?? ctx.enemy.x;
  const originY = y ?? ctx.enemy.y;
  const base = centerAngle !== null
    ? centerAngle
    : angleTo(originX, originY, ctx.player.x, ctx.player.y);
  const count = Math.max(1, scaleCount(ways, ctx.difficulty, 1));

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
    emitLaser(ctx, {
      x: originX,
      y: originY,
      angle: base + t * spread,
      width,
      telegraphTime,
      activeTime,
      color,
    });
  }
}

export function emitCrossLasers(ctx, {
  y = 140,
  width = 12,
  telegraphTime = 0.95,
  activeTime = 0.7,
  color = 'amber',
} = {}) {
  emitLaser(ctx, {
    x: 0,
    y,
    angle: Math.atan2(GAME_HEIGHT - y, GAME_WIDTH),
    width,
    telegraphTime,
    activeTime,
    color,
  });
  emitLaser(ctx, {
    x: GAME_WIDTH,
    y,
    angle: Math.atan2(GAME_HEIGHT - y, -GAME_WIDTH),
    width,
    telegraphTime,
    activeTime,
    color,
  });
}
