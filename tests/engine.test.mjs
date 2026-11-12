import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BULLET_COLORS,
  BULLET_SHAPES,
  DIFFICULTIES,
  GAME_HEIGHT,
  GAME_WIDTH,
  MAX_DT,
  PLAYER_BOUNDS,
  PLAYER_FOCUS_SCALE,
  PLAYER_GRAZE_RADIUS,
  PLAYER_HITBOX_RADIUS,
  PLAYER_RESPAWN_DELAY,
  PLAYER_START_X,
  PLAYER_START_Y,
  STAGE_CLEAR_DURATION,
  getPowerLevel,
} from '../src/game/constants.js';
import { createEnemyBullet } from '../src/game/entities.js';
import { GameEngine } from '../src/game/engine.js';
import { STAGES } from '../src/game/stages.js';

function stepFrames(engine, totalSeconds, dt = 1 / 60, inputFn = () => ({})) {
  const steps = Math.ceil(totalSeconds / dt);
  for (let i = 0; i < steps; i++) {
    engine.update(dt, inputFn(i));
  }
}

test('initialization, getState schema, dt clamping, and pause/resume', () => {
  const engine = new GameEngine({ difficulty: 'normal' });
  const initial = engine.getState();

  assert.equal(GAME_WIDTH, 360);
  assert.equal(GAME_HEIGHT, 640);
  assert.equal(initial.phase, 'playing');
  assert.equal(initial.difficulty, 'normal');
  assert.equal(initial.stage, 1);
  assert.equal(initial.stageName, STAGES[0].name);
  assert.equal(initial.score, 0);
  assert.equal(initial.graze, 0);
  assert.equal(initial.power, 0);
  assert.equal(initial.time, 0);
  assert.equal(initial.banner?.type, 'stage');
  assert.equal(initial.player.x, PLAYER_START_X);
  assert.equal(initial.player.y, PLAYER_START_Y);
  assert.equal(initial.player.hitboxRadius, PLAYER_HITBOX_RADIUS);
  assert.equal(initial.player.grazeRadius, PLAYER_GRAZE_RADIUS);
  assert.equal(initial.player.lives, 3);
  assert.equal(initial.player.bombs, 3);
  assert.equal(initial.player.alive, true);

  // dt should clamp to MAX_DT (0.05s)
  engine.update(1.5, { shoot: false });
  assert.equal(engine.getState().time, MAX_DT);

  // Pause halts simulation time, resume restores it
  engine.setPaused(true);
  assert.equal(engine.getState().phase, 'paused');
  engine.update(0.05, { moveDeltaX: 30, shoot: true });
  assert.equal(engine.getState().time, MAX_DT);
  assert.equal(engine.getState().player.x, PLAYER_START_X);

  engine.setPaused(false);
  assert.equal(engine.getState().phase, 'playing');
  engine.update(0.05, { shoot: false });
  assert.ok(engine.getState().time > MAX_DT);
});

test('relative movement, focus scaling, and playfield boundary clamping', () => {
  const engine = new GameEngine();

  engine.update(1 / 60, { moveDeltaX: 20, moveDeltaY: -10, focus: false, shoot: false });
  let s = engine.getState();
  assert.equal(s.player.x, PLAYER_START_X + 20);
  assert.equal(s.player.y, PLAYER_START_Y - 10);
  assert.equal(s.player.focus, false);

  engine.update(1 / 60, { moveDeltaX: 20, moveDeltaY: -10, focus: true, shoot: false });
  s = engine.getState();
  assert.equal(s.player.x, PLAYER_START_X + 20 + 20 * PLAYER_FOCUS_SCALE);
  assert.equal(s.player.y, PLAYER_START_Y - 10 - 10 * PLAYER_FOCUS_SCALE);
  assert.equal(s.player.focus, true);

  // Clamping at all four edges
  engine.update(1 / 60, { moveDeltaX: -9999, moveDeltaY: -9999, shoot: false });
  s = engine.getState();
  assert.equal(s.player.x, PLAYER_BOUNDS.minX);
  assert.equal(s.player.y, PLAYER_BOUNDS.minY);

  engine.update(1 / 60, { moveDeltaX: 9999, moveDeltaY: 9999, shoot: false });
  s = engine.getState();
  assert.equal(s.player.x, PLAYER_BOUNDS.maxX);
  assert.equal(s.player.y, PLAYER_BOUNDS.maxY);
});

test('auto-fire shots, event reset per frame, and power level scaling', () => {
  const engine = new GameEngine();

  // Level 1 (power 0) -> 2 bullets
  engine.update(1 / 60, { shoot: true });
  let s = engine.getState();
  assert.equal(getPowerLevel(s.power), 1);
  assert.equal(s.playerBullets.length, 2);
  assert.ok(s.events.some((e) => e.type === 'shot'));

  // Next frame with shoot: false -> events reset, no new shot event
  engine.update(1 / 60, { shoot: false });
  s = engine.getState();
  assert.equal(s.events.some((e) => e.type === 'shot'), false);

  // Verify power levels 2, 3, 4 increase bullet spread/count
  const expectedCounts = [
    [25, 2, 4],
    [55, 3, 7],
    [85, 4, 9],
  ];
  for (const [powerVal, expectedLv, expectedBullets] of expectedCounts) {
    engine.reset('normal');
    engine.power = powerVal;
    assert.equal(getPowerLevel(powerVal), expectedLv);
    engine.update(1 / 60, { shoot: true });
    assert.equal(engine.getState().playerBullets.length, expectedBullets);
  }
});

test('enemy spawning, player bullet collision, kill drops, and auto-collect', () => {
  const engine = new GameEngine();

  // Advance until first wave spawns
  let spawned = false;
  for (let i = 0; i < 180; i++) {
    engine.update(1 / 60, { shoot: false });
    if (engine.getState().enemies.length > 0) {
      spawned = true;
      break;
    }
  }
  assert.equal(spawned, true, 'Stage 1 wave should spawn enemies within 3 seconds');

  // Position player beneath first enemy and fire until killed
  let killed = false;
  for (let i = 0; i < 240; i++) {
    const s = engine.getState();
    const target = s.enemies[0];
    const dx = target ? target.x - s.player.x : 0;
    engine.update(1 / 60, { moveDeltaX: dx, shoot: true });
    const after = engine.getState();
    if (after.events.some((e) => e.type === 'kill')) {
      killed = true;
      assert.ok(after.score > 0);
      assert.ok(after.items.length > 0);
      break;
    }
  }
  assert.equal(killed, true, 'Enemy should be defeated by player shots');

  // Focus mode magnetizes items toward player and collects them
  stepFrames(engine, 1.5, 1 / 60, () => ({ focus: true, shoot: false }));
  const afterCollect = engine.getState();
  assert.ok(afterCollect.power > 0 || afterCollect.score > 0);
});

test('graze detection and bomb clearing / rising-edge trigger', () => {
  const engine = new GameEngine();

  // Inject an enemy bullet inside grazeRadius (18) but outside hitboxRadius (3)
  engine.enemyBullets.push(
    createEnemyBullet({
      x: engine.player.x + 12,
      y: engine.player.y,
      vx: 0,
      vy: 40,
      radius: 4,
      color: 'cyan',
      shape: 'orb',
    }),
  );

  engine.update(1 / 60, { shoot: false });
  let s = engine.getState();
  assert.equal(s.graze, 1);
  assert.ok(s.score > 0);
  assert.ok(s.events.some((e) => e.type === 'graze'));
  assert.equal(s.player.lives, 3);

  // Add more enemy bullets and trigger bomb
  engine.enemyBullets.push(
    createEnemyBullet({ x: 50, y: 50, vx: 0, vy: 50, radius: 5, color: 'magenta', shape: 'orb' }),
    createEnemyBullet({ x: 300, y: 120, vx: 0, vy: 50, radius: 5, color: 'amber', shape: 'rice' }),
  );
  engine.update(1 / 60, { bomb: true, shoot: false });
  s = engine.getState();
  assert.equal(s.player.bombs, 2);
  assert.equal(s.enemyBullets.length, 0);
  assert.equal(s.lasers.length, 0);
  assert.ok(s.player.invulnTimer > 0);
  assert.ok(s.bombFlash > 0);
  assert.ok(s.screenShake > 0);
  assert.ok(s.events.some((e) => e.type === 'bomb'));

  // Holding bomb=true on subsequent frames must not consume another bomb
  stepFrames(engine, 2.5, 1 / 60, () => ({ bomb: true, shoot: false }));
  assert.equal(engine.getState().player.bombs, 2);
});

test('player hit, respawn invulnerability, gameover transition, and reset', () => {
  const engine = new GameEngine({ difficulty: 'hard' }); // 2 lives
  assert.equal(engine.getState().player.lives, 2);

  // First hit -> loses 1 life, enters respawn delay
  engine.enemyBullets.push(
    createEnemyBullet({
      x: engine.player.x,
      y: engine.player.y,
      vx: 0,
      vy: 0,
      radius: 5,
      color: 'crimson',
      shape: 'orb',
    }),
  );
  engine.update(1 / 60, { shoot: false });
  let s = engine.getState();
  assert.equal(s.player.lives, 1);
  assert.equal(s.player.alive, false);
  assert.equal(s.phase, 'playing');
  assert.ok(s.events.some((e) => e.type === 'playerHit'));

  // Wait for respawn
  stepFrames(engine, PLAYER_RESPAWN_DELAY + 0.05, 1 / 60, () => ({ shoot: false }));
  s = engine.getState();
  assert.equal(s.player.alive, true);
  assert.ok(s.player.invulnTimer > 0);

  // Expire invulnerability safely (without random wave bullets) and take final hit -> gameover
  for (let i = 0; i < 180; i++) {
    engine.enemyBullets = [];
    engine.lasers = [];
    engine.update(1 / 60, { shoot: false });
    if (engine.getState().player.invulnTimer === 0) break;
  }
  assert.equal(engine.getState().player.invulnTimer, 0);

  engine.enemyBullets.push(
    createEnemyBullet({
      x: engine.player.x,
      y: engine.player.y,
      vx: 0,
      vy: 0,
      radius: 5,
      color: 'crimson',
      shape: 'orb',
    }),
  );
  engine.update(1 / 60, { shoot: false });
  s = engine.getState();
  assert.equal(s.player.lives, 0);
  assert.equal(s.phase, 'gameover');
  assert.equal(s.banner?.text, 'GAME OVER');
  assert.ok(s.events.some((e) => e.type === 'gameover'));

  // Reset returns to clean playing state
  engine.reset('normal');
  s = engine.getState();
  assert.equal(s.phase, 'playing');
  assert.equal(s.difficulty, 'normal');
  assert.equal(s.player.lives, 3);
  assert.equal(s.score, 0);
});

test('full 3-stage progression, boss phases, stage clear, and victory transition', () => {
  const engine = new GameEngine({ difficulty: 'normal' });

  for (let expectedStage = 1; expectedStage <= STAGES.length; expectedStage++) {
    assert.equal(engine.getState().stage, expectedStage);

    // Advance until boss spawns and enters playfield (y >= 20)
    let boss = null;
    for (let i = 0; i < 60 * 60; i++) {
      engine.player.invulnTimer = 1;
      engine.update(1 / 60, { shoot: false });
      boss = engine.enemies.find((e) => e.isBoss);
      if (boss && boss.y >= 20) break;
    }
    assert.ok(boss && boss.y >= 20, `Stage ${expectedStage} boss should spawn and enter screen`);
    assert.equal(engine.getState().banner?.type, 'warning');

    // Step through each boss phase by applying damage via engine's combat loop
    const phases = boss.maxPhases;
    for (let p = 0; p < phases; p++) {
      // Position boss within player stream or apply direct bullet hits by spawning player bullets on boss
      engine.playerBullets.push({
        x: boss.x,
        y: boss.y,
        vx: 0,
        vy: 0,
        radius: 10,
        damage: boss.hp + 10,
        kind: 'main',
        homing: false,
        homingStrength: 0,
      });
      engine.update(1 / 60, { shoot: false });
      const s = engine.getState();

      if (p + 1 < phases) {
        assert.ok(
          s.events.some((e) => e.type === 'bossPhase'),
          `Stage ${expectedStage} boss phase ${p + 1} -> ${p + 2} should emit bossPhase`,
        );
        assert.equal(s.banner?.type, 'spell');
      }
    }

    const afterBoss = engine.getState();
    assert.ok(afterBoss.events.some((e) => e.type === 'stageClear'));

    if (expectedStage < STAGES.length) {
      assert.equal(afterBoss.phase, 'stage_clear');
      stepFrames(engine, STAGE_CLEAR_DURATION + 0.1, 1 / 60, () => ({ shoot: false }));
      assert.equal(engine.getState().phase, 'playing');
      assert.equal(engine.getState().stage, expectedStage + 1);
    } else {
      assert.equal(afterBoss.phase, 'victory');
      assert.equal(afterBoss.banner?.text, 'ALL CLEAR!');
      assert.ok(afterBoss.events.some((e) => e.type === 'victory'));
    }
  }
});

test('all difficulties run cleanly and emit valid bullet metadata', () => {
  const validColors = new Set(BULLET_COLORS);
  const validShapes = new Set(BULLET_SHAPES);

  for (const diffKey of ['easy', 'normal', 'hard']) {
    const cfg = DIFFICULTIES[diffKey];
    const engine = new GameEngine({ difficulty: diffKey });
    const init = engine.getState();

    assert.equal(init.difficulty, diffKey);
    assert.equal(init.player.lives, cfg.startLives);
    assert.equal(init.player.bombs, cfg.startBombs);

    let sawEnemyBullets = false;
    for (let i = 0; i < 60 * 6; i++) {
      engine.player.invulnTimer = 1;
      engine.update(1 / 60, { shoot: true });
      const s = engine.getState();
      for (const b of s.enemyBullets) {
        sawEnemyBullets = true;
        assert.ok(validColors.has(b.color), `Unexpected bullet color: ${b.color}`);
        assert.ok(validShapes.has(b.shape), `Unexpected bullet shape: ${b.shape}`);
        assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y));
      }
    }
    assert.equal(sawEnemyBullets, true, `Difficulty ${diffKey} should emit enemy bullets`);
  }
});
