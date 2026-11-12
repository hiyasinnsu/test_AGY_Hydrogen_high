import { GAME_WIDTH } from './constants.js';
import { clamp, createEnemy } from './entities.js';
import {
  emitAimedLaser,
  emitAimedNWay,
  emitCrossLasers,
  emitCrossStream,
  emitDecelAccelRing,
  emitFanLasers,
  emitRing,
  emitSpiral,
} from './patterns.js';

// Reusable movement behaviors
function moveHoverSway({ targetY = 120, enterSpeed = 160, swayAmp = 48, swayFreq = 1.2, phase = 0 } = {}) {
  return (enemy, dt) => {
    if (enemy.y < targetY) {
      enemy.y = Math.min(targetY, enemy.y + enterSpeed * dt);
    } else {
      enemy.x = clamp(
        enemy.startX + Math.sin(enemy.age * swayFreq + phase) * swayAmp,
        28,
        GAME_WIDTH - 28,
      );
    }
  };
}

function moveDescendAndExit({ speed = 95, pauseY = 150, pauseDuration = 3.2, exitSpeed = 130 } = {}) {
  return (enemy, dt) => {
    if (enemy.age < 1.2 && enemy.y < pauseY) {
      enemy.y = Math.min(pauseY, enemy.y + speed * dt);
    } else if (enemy.age < 1.2 + pauseDuration) {
      enemy.x = clamp(enemy.startX + Math.sin(enemy.age * 2.1) * 18, 24, GAME_WIDTH - 24);
    } else {
      enemy.y += exitSpeed * dt;
    }
  };
}

function moveDiagonalSwoop({ vx = 55, vy = 115 } = {}) {
  return (enemy, dt) => {
    enemy.x += vx * dt;
    enemy.y += vy * dt;
  };
}

function moveMidboss({ targetY = 115, retreatAt = 11.5 } = {}) {
  return (enemy, dt) => {
    if (enemy.age > retreatAt) {
      enemy.y -= 170 * dt;
      return;
    }
    if (enemy.y < targetY) {
      enemy.y = Math.min(targetY, enemy.y + 130 * dt);
    } else {
      enemy.x = GAME_WIDTH / 2 + Math.sin((enemy.age - 1.0) * 1.1) * 78;
    }
  };
}

function moveBossCenter({ targetY = 108, swayAmp = 72, swayFreq = 0.85 } = {}) {
  return (enemy, dt) => {
    if (enemy.y < targetY) {
      enemy.y = Math.min(targetY, enemy.y + 120 * dt);
    } else {
      enemy.x = GAME_WIDTH / 2 + Math.sin(enemy.age * swayFreq) * swayAmp;
    }
  };
}

function fireInterval(enemy, dt, interval, difficulty, fn) {
  enemy.fireTimer -= dt * difficulty.fireRateScale;
  if (enemy.fireTimer <= 0) {
    enemy.fireTimer += interval;
    fn();
  }
}

// ============================================================
// STAGE 1: NEON STRATOSPHERE
// ============================================================
function createStage1Boss(nextId) {
  return createEnemy({
    id: nextId(),
    x: GAME_WIDTH / 2,
    y: -48,
    radius: 26,
    kind: 'boss',
    name: 'AZURE VALKYRIE',
    isBoss: true,
    scoreValue: 8000,
    dropTable: { power: 5, score: 12, bomb: 0, life: 0 },
    phases: [
      {
        hp: 950,
        spellName: 'INTERCEPTOR BARRAGE',
        moveFn: moveBossCenter({ targetY: 112, swayAmp: 76, swayFreq: 0.9 }),
        patternFn: (ctx, dt) => {
          const { enemy, difficulty } = ctx;
          fireInterval(enemy, dt, 0.85, difficulty, () => {
            enemy.step += 1;
            emitAimedNWay(ctx, { ways: 5, spread: 0.65, speed: 185, color: 'cyan', shape: 'needle' });
            if (enemy.step % 2 === 0) {
              emitRing(ctx, {
                count: 14,
                speed: 130,
                angleOffset: enemy.step * 0.25,
                color: 'magenta',
                shape: 'orb',
              });
            }
          });
        },
      },
      {
        hp: 1200,
        spellName: 'PRISM VORTEX',
        moveFn: moveBossCenter({ targetY: 105, swayAmp: 46, swayFreq: 0.6 }),
        patternFn: (ctx, dt) => {
          const { enemy, difficulty } = ctx;
          fireInterval(enemy, dt, 0.16, difficulty, () => {
            enemy.step += 1;
            const angleA = enemy.step * 0.22;
            emitSpiral(ctx, {
              arms: 4,
              baseAngle: angleA,
              speed: 145,
              color: 'cyan',
              shape: 'rice',
            });
            if (enemy.step % 2 === 0) {
              emitSpiral(ctx, {
                arms: 3,
                baseAngle: -angleA * 1.2,
                speed: 125,
                color: 'magenta',
                shape: 'orb',
              });
            }
            if (enemy.step % 7 === 0) {
              emitAimedNWay(ctx, { ways: 3, spread: 0.35, speed: 195, color: 'white', shape: 'needle' });
            }
          });
        },
      },
    ],
  });
}

function createStage1Midboss(nextId) {
  return createEnemy({
    id: nextId(),
    x: GAME_WIDTH / 2,
    y: -36,
    radius: 22,
    hp: 460,
    kind: 'midboss',
    name: 'SENTINEL-01',
    spellName: 'CYBER PULSE',
    scoreValue: 2500,
    dropTable: { power: 3, score: 6, bomb: 1, life: 0 },
    moveFn: moveMidboss({ targetY: 115, retreatAt: 10.5 }),
    patternFn: (ctx, dt) => {
      const { enemy, difficulty } = ctx;
      if (enemy.age > 10.5) return;
      fireInterval(enemy, dt, 0.75, difficulty, () => {
        enemy.step += 1;
        emitRing(ctx, {
          count: 12,
          speed: 135,
          angleOffset: enemy.step * 0.3,
          color: enemy.step % 2 === 0 ? 'cyan' : 'amber',
          shape: 'diamond',
        });
        emitAimedNWay(ctx, { ways: 3, spread: 0.32, speed: 185, color: 'magenta', shape: 'needle' });
      });
    },
  });
}

// ============================================================
// STAGE 2: ORBITAL NEXUS
// ============================================================
function createStage2Midboss(nextId) {
  return createEnemy({
    id: nextId(),
    x: GAME_WIDTH / 2,
    y: -36,
    radius: 22,
    hp: 620,
    kind: 'midboss',
    name: 'AEGIS CORE',
    spellName: 'LASER MATRIX',
    scoreValue: 3500,
    dropTable: { power: 3, score: 8, bomb: 0, life: 1 },
    moveFn: moveMidboss({ targetY: 112, retreatAt: 11.0 }),
    patternFn: (ctx, dt) => {
      const { enemy, difficulty } = ctx;
      if (enemy.age > 11.0) return;
      fireInterval(enemy, dt, 1.35, difficulty, () => {
        enemy.step += 1;
        emitAimedLaser(ctx, { width: 13, telegraphTime: 0.85, activeTime: 0.6, color: 'amber' });
        emitDecelAccelRing(ctx, {
          count: 12,
          initialSpeed: 195,
          accelSpeed: 185,
          accelAngleOffset: 0.4,
          color: 'violet',
          shape: 'diamond',
        });
      });
    },
  });
}

function createStage2Boss(nextId) {
  return createEnemy({
    id: nextId(),
    x: GAME_WIDTH / 2,
    y: -48,
    radius: 28,
    kind: 'boss',
    name: 'CRIMSON SERAPH',
    isBoss: true,
    scoreValue: 12000,
    dropTable: { power: 5, score: 16, bomb: 1, life: 0 },
    phases: [
      {
        hp: 1150,
        spellName: 'SOLAR FLARE',
        moveFn: moveBossCenter({ targetY: 110, swayAmp: 82, swayFreq: 0.95 }),
        patternFn: (ctx, dt) => {
          const { enemy, difficulty } = ctx;
          fireInterval(enemy, dt, 0.72, difficulty, () => {
            enemy.step += 1;
            emitRing(ctx, {
              count: 14,
              layers: 2,
              layerSpeedStep: 28,
              speed: 125,
              angleOffset: enemy.step * 0.2,
              color: 'amber',
              shape: 'orb',
            });
            emitAimedNWay(ctx, { ways: 5, spread: 0.55, speed: 190, color: 'crimson', shape: 'needle' });
          });
        },
      },
      {
        hp: 1300,
        spellName: 'LASER LATTICE',
        moveFn: moveBossCenter({ targetY: 100, swayAmp: 54, swayFreq: 0.7 }),
        patternFn: (ctx, dt) => {
          const { enemy, difficulty } = ctx;
          fireInterval(enemy, dt, 1.45, difficulty, () => {
            enemy.step += 1;
            if (enemy.step % 2 === 1) {
              emitFanLasers(ctx, { ways: 3, spread: 0.8, width: 12, color: 'magenta' });
            } else {
              emitCrossLasers(ctx, { y: 120, width: 12, color: 'amber' });
            }
            emitCrossStream(ctx, {
              count: 4,
              arc: 0.9,
              tilt: 0.42,
              speed: 145,
              colorA: 'cyan',
              colorB: 'violet',
              shape: 'rice',
            });
          });
        },
      },
      {
        hp: 1450,
        spellName: 'TIME FRACTURE',
        moveFn: moveBossCenter({ targetY: 110, swayAmp: 40, swayFreq: 0.5 }),
        patternFn: (ctx, dt) => {
          const { enemy, difficulty } = ctx;
          fireInterval(enemy, dt, 0.95, difficulty, () => {
            enemy.step += 1;
            emitDecelAccelRing(ctx, {
              count: 16,
              initialSpeed: 215,
              accelSpeed: 210,
              decelTime: 0.48,
              pauseTime: 0.25,
              accelAngleOffset: enemy.step % 2 === 0 ? 0.45 : -0.45,
              angleOffset: enemy.step * 0.2,
              color: 'lime',
              shape: 'diamond',
            });
            emitAimedNWay(ctx, { ways: 3, spread: 0.3, speed: 180, color: 'white', shape: 'ring' });
          });
        },
      },
    ],
  });
}

// ============================================================
// STAGE 3: SINGULARITY THRONE
// ============================================================
function createStage3Midboss(nextId) {
  return createEnemy({
    id: nextId(),
    x: GAME_WIDTH / 2,
    y: -36,
    radius: 23,
    hp: 760,
    kind: 'midboss',
    name: 'VOID HERALD',
    spellName: 'ABYSSAL CROSS',
    scoreValue: 4500,
    dropTable: { power: 4, score: 10, bomb: 1, life: 0 },
    moveFn: moveMidboss({ targetY: 112, retreatAt: 11.0 }),
    patternFn: (ctx, dt) => {
      const { enemy, difficulty } = ctx;
      if (enemy.age > 11.0) return;
      fireInterval(enemy, dt, 0.22, difficulty, () => {
        enemy.step += 1;
        emitSpiral(ctx, {
          arms: 5,
          baseAngle: enemy.step * 0.24,
          speed: 150,
          color: 'violet',
          shape: 'rice',
        });
        if (enemy.step % 4 === 0) {
          emitCrossStream(ctx, {
            count: 4,
            arc: 0.85,
            tilt: 0.4,
            speed: 160,
            colorA: 'cyan',
            colorB: 'crimson',
            shape: 'diamond',
          });
        }
      });
    },
  });
}

function createStage3Boss(nextId) {
  return createEnemy({
    id: nextId(),
    x: GAME_WIDTH / 2,
    y: -48,
    radius: 30,
    kind: 'boss',
    name: 'EMPRESS ECLIPSE',
    isBoss: true,
    scoreValue: 20000,
    dropTable: { power: 6, score: 24, bomb: 1, life: 1 },
    phases: [
      {
        hp: 1350,
        spellName: 'STARLIGHT CONVERGENCE',
        moveFn: moveBossCenter({ targetY: 106, swayAmp: 78, swayFreq: 0.9 }),
        patternFn: (ctx, dt) => {
          const { enemy, difficulty } = ctx;
          fireInterval(enemy, dt, 0.78, difficulty, () => {
            enemy.step += 1;
            emitCrossStream(ctx, {
              count: 5,
              arc: 1.0,
              tilt: 0.36,
              speed: 155,
              colorA: 'cyan',
              colorB: 'magenta',
              shape: 'diamond',
            });
            emitRing(ctx, {
              count: 16,
              speed: 130,
              angleOffset: enemy.step * 0.18,
              color: 'white',
              shape: 'orb',
            });
          });
        },
      },
      {
        hp: 1550,
        spellName: 'JUDGMENT RAY',
        moveFn: moveBossCenter({ targetY: 100, swayAmp: 60, swayFreq: 0.75 }),
        patternFn: (ctx, dt) => {
          const { enemy, difficulty } = ctx;
          fireInterval(enemy, dt, 1.35, difficulty, () => {
            enemy.step += 1;
            emitFanLasers(ctx, {
              ways: enemy.step % 2 === 0 ? 3 : 4,
              spread: 0.95,
              width: 13,
              telegraphTime: 0.85,
              activeTime: 0.65,
              color: 'crimson',
            });
            emitDecelAccelRing(ctx, {
              count: 14,
              initialSpeed: 205,
              accelSpeed: 210,
              aimOnAccel: enemy.step % 2 === 0,
              accelAngleOffset: 0.35,
              color: 'violet',
              shape: 'needle',
            });
          });
        },
      },
      {
        hp: 1850,
        spellName: 'ETERNAL SUPERNOVA',
        moveFn: moveBossCenter({ targetY: 108, swayAmp: 34, swayFreq: 0.55 }),
        patternFn: (ctx, dt) => {
          const { enemy, difficulty } = ctx;
          fireInterval(enemy, dt, 0.18, difficulty, () => {
            enemy.step += 1;
            const rot = enemy.step * 0.21;
            emitSpiral(ctx, {
              arms: 5,
              baseAngle: rot,
              speed: 148,
              color: 'amber',
              shape: 'rice',
            });
            emitSpiral(ctx, {
              arms: 3,
              baseAngle: -rot * 1.15,
              speed: 125,
              color: 'magenta',
              shape: 'orb',
            });
            if (enemy.step % 6 === 0) {
              emitAimedNWay(ctx, { ways: 5, spread: 0.55, speed: 195, color: 'cyan', shape: 'needle' });
            }
            if (enemy.step % 12 === 0) {
              emitAimedLaser(ctx, { width: 14, telegraphTime: 0.9, activeTime: 0.65, color: 'white' });
            }
          });
        },
      },
    ],
  });
}

// Helper wave spawners
function spawnScoutV(nextId, count = 5, baseY = -24, speed = 115) {
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2;
    const x = GAME_WIDTH / 2 + offset * 52;
    enemies.push(createEnemy({
      id: nextId(),
      x,
      y: baseY - Math.abs(offset) * 26,
      radius: 14,
      hp: 42,
      kind: 'scout',
      scoreValue: 250,
      dropTable: { power: 1, score: 2, bomb: 0, life: 0 },
      moveFn: moveDescendAndExit({ speed, pauseY: 135 + Math.abs(offset) * 16, pauseDuration: 2.6 }),
      patternFn: (ctx, dt) => {
        fireInterval(ctx.enemy, dt, 1.05, ctx.difficulty, () => {
          emitAimedNWay(ctx, { ways: 1, speed: 165, color: 'cyan', shape: 'orb' });
        });
      },
    }));
  }
  return enemies;
}

function spawnFlankWings(nextId, hp = 75) {
  return [-1, 1].map((side) => createEnemy({
    id: nextId(),
    x: side < 0 ? 74 : GAME_WIDTH - 74,
    y: -28,
    radius: 17,
    hp,
    kind: 'wing',
    scoreValue: 450,
    dropTable: { power: 2, score: 3, bomb: 0, life: 0 },
    moveFn: moveHoverSway({ targetY: 120, enterSpeed: 150, swayAmp: 28, swayFreq: 1.5, phase: side > 0 ? Math.PI : 0 }),
    patternFn: (ctx, dt) => {
      if (ctx.enemy.age > 8.0) {
        ctx.enemy.y -= 140 * dt;
        return;
      }
      fireInterval(ctx.enemy, dt, 0.95, ctx.difficulty, () => {
        emitAimedNWay(ctx, { ways: 3, spread: 0.42, speed: 175, color: 'magenta', shape: 'needle' });
      });
    },
  }));
}

function spawnWeavers(nextId, hp = 90) {
  return [90, 180, 270].map((x, idx) => createEnemy({
    id: nextId(),
    x,
    y: -30 - idx * 20,
    radius: 17,
    hp,
    kind: 'weaver',
    scoreValue: 550,
    dropTable: { power: 1, score: 4, bomb: 0, life: 0 },
    moveFn: moveHoverSway({ targetY: 105 + (idx % 2) * 32, enterSpeed: 145, swayAmp: 34, swayFreq: 1.3, phase: idx }),
    patternFn: (ctx, dt) => {
      if (ctx.enemy.age > 7.5) {
        ctx.enemy.y -= 130 * dt;
        return;
      }
      fireInterval(ctx.enemy, dt, 0.9, ctx.difficulty, () => {
        ctx.enemy.step += 1;
        emitCrossStream(ctx, {
          count: 3,
          arc: 0.7,
          tilt: 0.35,
          speed: 145,
          colorA: 'amber',
          colorB: 'cyan',
          shape: 'rice',
        });
      });
    },
  }));
}

function spawnTurrets(nextId, hp = 120) {
  return [64, GAME_WIDTH - 64].map((x, idx) => createEnemy({
    id: nextId(),
    x,
    y: -30,
    radius: 19,
    hp,
    kind: 'turret',
    scoreValue: 700,
    dropTable: { power: 2, score: 4, bomb: 0, life: 0 },
    moveFn: moveHoverSway({ targetY: 135, enterSpeed: 135, swayAmp: 16, swayFreq: 0.9, phase: idx * Math.PI }),
    patternFn: (ctx, dt) => {
      if (ctx.enemy.age > 8.5) {
        ctx.enemy.y -= 130 * dt;
        return;
      }
      fireInterval(ctx.enemy, dt, 1.3, ctx.difficulty, () => {
        emitRing(ctx, { count: 10, speed: 130, color: 'violet', shape: 'diamond' });
      });
    },
  }));
}

function spawnLaserDrones(nextId, hp = 110) {
  return [88, GAME_WIDTH - 88].map((x) => createEnemy({
    id: nextId(),
    x,
    y: -30,
    radius: 18,
    hp,
    kind: 'turret',
    scoreValue: 800,
    dropTable: { power: 2, score: 5, bomb: 0, life: 0 },
    moveFn: moveHoverSway({ targetY: 118, enterSpeed: 150, swayAmp: 22, swayFreq: 1.0 }),
    patternFn: (ctx, dt) => {
      if (ctx.enemy.age > 8.5) {
        ctx.enemy.y -= 140 * dt;
        return;
      }
      fireInterval(ctx.enemy, dt, 1.5, ctx.difficulty, () => {
        emitAimedLaser(ctx, { width: 11, telegraphTime: 0.9, activeTime: 0.55, color: 'cyan' });
      });
    },
  }));
}

export const STAGES = [
  {
    number: 1,
    name: 'NEON STRATOSPHERE',
    bossTime: 28,
    waves: [
      { time: 0.6, spawn: (nextId) => spawnScoutV(nextId, 5, -20, 115) },
      { time: 4.5, spawn: (nextId) => spawnFlankWings(nextId, 75) },
      { time: 9.0, spawn: (nextId) => spawnWeavers(nextId, 85) },
      { time: 13.5, spawn: (nextId) => [createStage1Midboss(nextId)] },
      {
        time: 23.5,
        spawn: (nextId) => [
          createEnemy({
            id: nextId(),
            x: 40,
            y: -24,
            radius: 15,
            hp: 55,
            kind: 'scout',
            scoreValue: 350,
            dropTable: { power: 2, score: 4, bomb: 0, life: 0 },
            moveFn: moveDiagonalSwoop({ vx: 42, vy: 120 }),
            patternFn: (ctx, dt) => fireInterval(ctx.enemy, dt, 0.85, ctx.difficulty, () => {
              emitAimedNWay(ctx, { ways: 3, spread: 0.35, speed: 165, color: 'lime', shape: 'rice' });
            }),
          }),
          createEnemy({
            id: nextId(),
            x: GAME_WIDTH - 40,
            y: -24,
            radius: 15,
            hp: 55,
            kind: 'scout',
            scoreValue: 350,
            dropTable: { power: 2, score: 4, bomb: 0, life: 0 },
            moveFn: moveDiagonalSwoop({ vx: -42, vy: 120 }),
            patternFn: (ctx, dt) => fireInterval(ctx.enemy, dt, 0.85, ctx.difficulty, () => {
              emitAimedNWay(ctx, { ways: 3, spread: 0.35, speed: 165, color: 'lime', shape: 'rice' });
            }),
          }),
        ],
      },
      { time: 28.0, isBossWave: true, spawn: (nextId) => [createStage1Boss(nextId)] },
    ],
  },
  {
    number: 2,
    name: 'ORBITAL NEXUS',
    bossTime: 28,
    waves: [
      { time: 0.6, spawn: (nextId) => spawnTurrets(nextId, 115) },
      { time: 4.8, spawn: (nextId) => spawnWeavers(nextId, 100) },
      { time: 9.2, spawn: (nextId) => spawnScoutV(nextId, 5, -20, 130) },
      { time: 13.0, spawn: (nextId) => [createStage2Midboss(nextId)] },
      { time: 23.5, spawn: (nextId) => spawnFlankWings(nextId, 105) },
      { time: 28.0, isBossWave: true, spawn: (nextId) => [createStage2Boss(nextId)] },
    ],
  },
  {
    number: 3,
    name: 'SINGULARITY THRONE',
    bossTime: 29,
    waves: [
      { time: 0.6, spawn: (nextId) => spawnFlankWings(nextId, 120) },
      { time: 5.0, spawn: (nextId) => spawnLaserDrones(nextId, 120) },
      { time: 9.5, spawn: (nextId) => spawnWeavers(nextId, 125) },
      { time: 13.5, spawn: (nextId) => [createStage3Midboss(nextId)] },
      { time: 24.0, spawn: (nextId) => spawnTurrets(nextId, 140) },
      { time: 29.0, isBossWave: true, spawn: (nextId) => [createStage3Boss(nextId)] },
    ],
  },
];

export function getStageConfig(stageNumber) {
  const index = clamp(stageNumber - 1, 0, STAGES.length - 1);
  return STAGES[index];
}
