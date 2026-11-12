import {
  BOMB_DURATION,
  BOMB_INVULN_DURATION,
  COMBO_DECAY_TIME,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_COLLECT_LINE_Y,
  ITEM_FALL_SPEED,
  ITEM_MAGNET_SPEED,
  MAX_DT,
  PLAYER_BOUNDS,
  PLAYER_FOCUS_SCALE,
  PLAYER_INVULN_DURATION,
  PLAYER_RESPAWN_DELAY,
  PLAYER_SHOT_INTERVAL,
  PLAYER_START_X,
  PLAYER_START_Y,
  POWER_MAX,
  STAGE_CLEAR_DURATION,
  getDifficultyConfig,
  getPowerLevel,
} from './constants.js';
import {
  angleTo,
  clamp,
  createItem,
  createPlayer,
  createPlayerBullet,
  distSq,
  pointToSegmentDistSq,
} from './entities.js';
import { STAGES, getStageConfig } from './stages.js';

export class GameEngine {
  constructor({ difficulty = 'normal' } = {}) {
    this._nextEntityId = 1;
    this.reset(difficulty);
  }

  reset(difficulty = 'normal') {
    this.difficultyConfig = getDifficultyConfig(difficulty);
    this.difficulty = this.difficultyConfig.key;
    this.phase = 'playing';
    this._prePausePhase = 'playing';

    this.stage = 1;
    this.stageTime = 0;
    this.waveIndex = 0;
    this.bossSpawned = false;
    this.stageClearTimer = 0;

    this.score = 0;
    this.graze = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.power = 0;
    this.time = 0;

    this.screenShake = 0;
    this.bombFlash = 0;
    this.banner = null;

    this.player = createPlayer(this.difficultyConfig);
    this.playerBullets = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.lasers = [];
    this.items = [];
    this.events = [];

    this._prevBombInput = false;
    this._hitSoundCooldown = 0;
    this._setupStage(1);
  }

  setPaused(paused) {
    if (paused) {
      if (this.phase === 'playing' || this.phase === 'stage_clear') {
        this._prePausePhase = this.phase;
        this.phase = 'paused';
      }
    } else if (this.phase === 'paused') {
      this.phase = this._prePausePhase || 'playing';
    }
  }

  _setupStage(stageNumber) {
    this.stage = stageNumber;
    this.stageTime = 0;
    this.waveIndex = 0;
    this.bossSpawned = false;
    this.stageClearTimer = 0;
    this.enemies = [];
    this.enemyBullets = [];
    this.lasers = [];
    this.playerBullets = [];

    const stageCfg = getStageConfig(stageNumber);
    this.banner = {
      text: `STAGE ${stageCfg.number}`,
      subtext: stageCfg.name,
      timer: 2.4,
      type: 'stage',
    };
  }

  _emit(type, x = 0, y = 0, color = 'white', size = 1, isBoss = false) {
    this.events.push({ type, x, y, color, size, isBoss });
  }

  update(dt, input = {}) {
    this.events = [];
    const rawDt = Number.isFinite(dt) ? dt : 0;
    const clampedDt = clamp(rawDt, 0, MAX_DT);

    if (this.phase === 'paused' || this.phase === 'victory' || this.phase === 'gameover') {
      this._updateBannerAndEffects(clampedDt);
      return;
    }

    if (clampedDt <= 0) {
      return;
    }

    this.time += clampedDt;
    this._hitSoundCooldown = Math.max(0, this._hitSoundCooldown - clampedDt);
    this._updateBannerAndEffects(clampedDt);

    if (this.combo > 0) {
      this.comboTimer -= clampedDt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    this._updatePlayer(clampedDt, input);

    if (this.phase === 'stage_clear') {
      this._updatePlayerBullets(clampedDt);
      this._updateItems(clampedDt);
      this.stageClearTimer -= clampedDt;
      if (this.stageClearTimer <= 0) {
        if (this.stage < STAGES.length) {
          this.phase = 'playing';
          this._setupStage(this.stage + 1);
        } else {
          this.phase = 'victory';
        }
      }
      return;
    }

    // Active playing phase
    this.stageTime += clampedDt;
    this._spawnWaves();
    this._updateEnemies(clampedDt);
    this._updatePlayerBullets(clampedDt);
    this._updateEnemyBullets(clampedDt);
    this._updateLasers(clampedDt);
    this._updateItems(clampedDt);
    this._resolveCollisions(clampedDt);
  }

  _updateBannerAndEffects(dt) {
    this.screenShake = Math.max(0, this.screenShake - dt * 28);
    this.bombFlash = Math.max(0, this.bombFlash - dt * 1.4);
    if (this.banner) {
      this.banner.timer -= dt;
      if (this.banner.timer <= 0) {
        this.banner = null;
      }
    }
  }

  _updatePlayer(dt, input) {
    const p = this.player;
    const focus = Boolean(input.focus);
    const shoot = input.shoot !== undefined ? Boolean(input.shoot) : true;
    const bombPressed = Boolean(input.bomb);
    const bombTriggered = bombPressed && !this._prevBombInput;
    this._prevBombInput = bombPressed;

    p.focus = focus;

    if (!p.alive) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0 && p.lives > 0) {
        p.alive = true;
        p.x = PLAYER_START_X;
        p.y = PLAYER_START_Y;
        p.invulnTimer = PLAYER_INVULN_DURATION;
        p.shotCooldown = 0;
      }
      return;
    }

    const moveScale = focus ? PLAYER_FOCUS_SCALE : 1.0;
    const dx = Number.isFinite(input.moveDeltaX) ? input.moveDeltaX * moveScale : 0;
    const dy = Number.isFinite(input.moveDeltaY) ? input.moveDeltaY * moveScale : 0;

    p.x = clamp(p.x + dx, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    p.y = clamp(p.y + dy, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);

    p.invulnTimer = Math.max(0, p.invulnTimer - dt);

    if (p.bombTimer > 0) {
      p.bombTimer = Math.max(0, p.bombTimer - dt);
      // Continuous bullet clearing & gentle damage during bomb shockwave
      this._clearBulletsAndLasers(false);
      for (const enemy of this.enemies) {
        this._damageEnemy(enemy, 75 * dt);
      }
    }

    if (bombTriggered && this.phase === 'playing' && p.bombs > 0 && p.bombTimer <= 0) {
      this._triggerBomb();
    }

    p.shotCooldown = Math.max(0, p.shotCooldown - dt);
    if (shoot && p.shotCooldown <= 0 && (this.phase === 'playing' || this.phase === 'stage_clear')) {
      p.shotCooldown = PLAYER_SHOT_INTERVAL;
      this._firePlayerBullets();
    }
  }

  _triggerBomb() {
    const p = this.player;
    p.bombs -= 1;
    p.bombTimer = BOMB_DURATION;
    p.invulnTimer = Math.max(p.invulnTimer, BOMB_INVULN_DURATION);
    this.bombFlash = 1.0;
    this.screenShake = Math.max(this.screenShake, 12);

    this._clearBulletsAndLasers(true);
    for (const item of this.items) {
      item.magnetized = true;
    }

    // Snapshot enemy list because damaging may kill or phase-shift enemies
    const activeEnemies = [...this.enemies];
    for (const enemy of activeEnemies) {
      if (enemy.hp > 0) {
        this._damageEnemy(enemy, 220);
      }
    }

    this._emit('bomb', p.x, p.y, 'cyan', 3, false);
  }

  _clearBulletsAndLasers(grantScore = true) {
    if (grantScore && this.enemyBullets.length > 0) {
      this.score += Math.round(this.enemyBullets.length * 15 * this.difficultyConfig.scoreScale);
    }
    this.enemyBullets = [];
    this.lasers = [];
  }

  _firePlayerBullets() {
    const p = this.player;
    const lv = getPowerLevel(this.power);
    const focus = p.focus;

    // Core twin stream (all levels)
    const mainDamage = lv >= 4 ? 12 : 11;
    const mainSpreadX = focus ? 7 : 10;
    this.playerBullets.push(
      createPlayerBullet({ x: p.x - mainSpreadX, y: p.y - 12, vx: 0, vy: -720, radius: 4, damage: mainDamage, kind: 'main' }),
      createPlayerBullet({ x: p.x + mainSpreadX, y: p.y - 12, vx: 0, vy: -720, radius: 4, damage: mainDamage, kind: 'main' }),
    );

    if (lv >= 2) {
      const wingAngle = focus ? 0.06 : 0.16;
      const speed = 690;
      this.playerBullets.push(
        createPlayerBullet({
          x: p.x - 14,
          y: p.y - 6,
          vx: -Math.sin(wingAngle) * speed,
          vy: -Math.cos(wingAngle) * speed,
          radius: 3.5,
          damage: 7,
          kind: 'wing',
        }),
        createPlayerBullet({
          x: p.x + 14,
          y: p.y - 6,
          vx: Math.sin(wingAngle) * speed,
          vy: -Math.cos(wingAngle) * speed,
          radius: 3.5,
          damage: 7,
          kind: 'wing',
        }),
      );
    }

    if (lv >= 3) {
      // Center piercing needle
      this.playerBullets.push(
        createPlayerBullet({ x: p.x, y: p.y - 16, vx: 0, vy: -760, radius: 4.5, damage: 11, kind: 'main' }),
      );
      if (focus) {
        this.playerBullets.push(
          createPlayerBullet({ x: p.x - 16, y: p.y - 8, vx: 0, vy: -740, radius: 3.8, damage: 9, kind: 'focused' }),
          createPlayerBullet({ x: p.x + 16, y: p.y - 8, vx: 0, vy: -740, radius: 3.8, damage: 9, kind: 'focused' }),
        );
      } else {
        this.playerBullets.push(
          createPlayerBullet({ x: p.x - 18, y: p.y - 2, vx: -120, vy: -520, radius: 4, damage: 8, kind: 'homing', homing: true, homingStrength: 8 }),
          createPlayerBullet({ x: p.x + 18, y: p.y - 2, vx: 120, vy: -520, radius: 4, damage: 8, kind: 'homing', homing: true, homingStrength: 8 }),
        );
      }
    }

    if (lv >= 4) {
      const sideVx = focus ? 45 : 155;
      this.playerBullets.push(
        createPlayerBullet({ x: p.x - 20, y: p.y, vx: -sideVx, vy: -560, radius: 4.2, damage: 9, kind: 'homing', homing: true, homingStrength: 10 }),
        createPlayerBullet({ x: p.x + 20, y: p.y, vx: sideVx, vy: -560, radius: 4.2, damage: 9, kind: 'homing', homingStrength: 10 }),
      );
    }

    this._emit('shot', p.x, p.y - 12, 'cyan', 1, false);
  }

  _spawnWaves() {
    const stageCfg = getStageConfig(this.stage);
    const nextId = () => this._nextEntityId++;

    while (this.waveIndex < stageCfg.waves.length) {
      const wave = stageCfg.waves[this.waveIndex];
      if (this.stageTime < wave.time) {
        break;
      }
      this.waveIndex += 1;
      const spawned = wave.spawn(nextId);
      for (const enemy of spawned) {
        this.enemies.push(enemy);
        if (enemy.isBoss) {
          this.bossSpawned = true;
          this.banner = {
            text: 'WARNING!!',
            subtext: enemy.name || 'BOSS APPROACHING',
            timer: 2.2,
            type: 'warning',
          };
          this._emit('warning', enemy.x, enemy.y, 'crimson', 2.5, true);
        }
      }
    }
  }

  _updateEnemies(dt) {
    const ctx = {
      player: this.player,
      difficulty: this.difficultyConfig,
      spawnBullet: (b) => this.enemyBullets.push(b),
      spawnLaser: (l) => this.lasers.push(l),
    };

    const surviving = [];
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.age += dt;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 8);

      const prevX = enemy.x;
      const prevY = enemy.y;
      if (enemy.moveFn) {
        enemy.moveFn(enemy, dt);
      }
      const dx = enemy.x - prevX;
      const dy = enemy.y - prevY;
      if (dx * dx + dy * dy > 0.01) {
        enemy.angle = Math.atan2(dy, dx);
      }

      if (enemy.patternFn && enemy.y > -10 && enemy.y < GAME_HEIGHT - 120) {
        ctx.enemy = enemy;
        enemy.patternFn(ctx, dt);
      }

      // Cull off-screen non-boss enemies
      if (!enemy.isBoss && (enemy.y > GAME_HEIGHT + 60 || enemy.y < -90 || enemy.x < -70 || enemy.x > GAME_WIDTH + 70)) {
        continue;
      }
      surviving.push(enemy);
    }
    this.enemies = surviving;
  }

  _updatePlayerBullets(dt) {
    const active = [];
    for (const b of this.playerBullets) {
      if (b.homing && this.enemies.length > 0) {
        let nearest = null;
        let minDist = Infinity;
        for (const e of this.enemies) {
          if (e.hp <= 0 || e.y < -10) continue;
          const d = distSq(b.x, b.y, e.x, e.y);
          if (d < minDist) {
            minDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          const speed = Math.hypot(b.vx, b.vy);
          const desiredAngle = angleTo(b.x, b.y, nearest.x, nearest.y);
          const curAngle = Math.atan2(b.vy, b.vx);
          let diff = desiredAngle - curAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextAngle = curAngle + clamp(diff, -b.homingStrength * dt, b.homingStrength * dt);
          b.vx = Math.cos(nextAngle) * speed;
          b.vy = Math.sin(nextAngle) * speed;
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y >= -30 && b.y <= GAME_HEIGHT + 30 && b.x >= -30 && b.x <= GAME_WIDTH + 30) {
        active.push(b);
      }
    }
    this.playerBullets = active;
  }

  _updateEnemyBullets(dt) {
    const active = [];
    for (const b of this.enemyBullets) {
      b.age += dt;

      if (b.spin !== 0) {
        const speed = Math.hypot(b.vx, b.vy);
        b.angle += b.spin * dt;
        b.vx = Math.cos(b.angle) * speed;
        b.vy = Math.sin(b.angle) * speed;
      }

      if (b.behavior === 'decel_accel' && !b.accelerated) {
        if (b.age < b.decelTime) {
          const t = b.age / b.decelTime;
          const spd = b.initialSpeed * (1 - t) + 10 * t;
          b.vx = Math.cos(b.angle) * spd;
          b.vy = Math.sin(b.angle) * spd;
        } else if (b.age < b.decelTime + b.pauseTime) {
          b.vx = Math.cos(b.angle) * 8;
          b.vy = Math.sin(b.angle) * 8;
        } else {
          b.accelerated = true;
          const nextAngle = b.aimOnAccel
            ? angleTo(b.x, b.y, this.player.x, this.player.y) + b.accelAngleOffset
            : b.angle + b.accelAngleOffset;
          b.angle = nextAngle;
          b.vx = Math.cos(nextAngle) * b.accelSpeed;
          b.vy = Math.sin(nextAngle) * b.accelSpeed;
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x >= -40 && b.x <= GAME_WIDTH + 40 && b.y >= -40 && b.y <= GAME_HEIGHT + 40) {
        active.push(b);
      }
    }
    this.enemyBullets = active;
  }

  _updateLasers(dt) {
    const active = [];
    for (const l of this.lasers) {
      l.timer -= dt;
      l.grazeCooldown = Math.max(0, l.grazeCooldown - dt);
      if (l.state === 'telegraph' && l.timer <= 0) {
        l.state = 'active';
        l.timer = l.activeTime;
      } else if (l.state === 'active' && l.timer <= 0) {
        continue;
      }
      active.push(l);
    }
    this.lasers = active;
  }

  _updateItems(dt) {
    const p = this.player;
    const autoCollectAll = p.alive && (p.y < ITEM_COLLECT_LINE_Y || p.bombTimer > 0 || p.focus);
    const active = [];

    for (const item of this.items) {
      if (autoCollectAll) {
        item.magnetized = true;
      }

      if (item.magnetized && p.alive) {
        const a = angleTo(item.x, item.y, p.x, p.y);
        item.vx = Math.cos(a) * ITEM_MAGNET_SPEED;
        item.vy = Math.sin(a) * ITEM_MAGNET_SPEED;
      } else {
        item.vx *= Math.max(0, 1 - dt * 3);
        item.vy = Math.min(ITEM_FALL_SPEED, item.vy + 220 * dt);
      }

      item.x += item.vx * dt;
      item.y += item.vy * dt;

      if (p.alive) {
        const pickupR = p.grazeRadius + item.radius + 8;
        if (distSq(p.x, p.y, item.x, item.y) <= pickupR * pickupR) {
          this._collectItem(item);
          continue;
        }
      }

      if (item.y <= GAME_HEIGHT + 30) {
        active.push(item);
      }
    }
    this.items = active;
  }

  _collectItem(item) {
    const p = this.player;
    let color = 'cyan';
    if (item.kind === 'power') {
      color = 'crimson';
      if (this.power < POWER_MAX) {
        this.power = Math.min(POWER_MAX, this.power + 8);
        this.score += Math.round(100 * this.difficultyConfig.scoreScale);
      } else {
        this.score += Math.round(350 * this.difficultyConfig.scoreScale);
      }
    } else if (item.kind === 'score') {
      color = 'cyan';
      const bonus = 250 * (1 + Math.min(50, this.combo) * 0.02);
      this.score += Math.round(bonus * this.difficultyConfig.scoreScale);
    } else if (item.kind === 'bomb') {
      color = 'lime';
      if (p.bombs < 5) {
        p.bombs += 1;
      } else {
        this.score += Math.round(1000 * this.difficultyConfig.scoreScale);
      }
    } else if (item.kind === 'life') {
      color = 'magenta';
      if (p.lives < 6) {
        p.lives += 1;
      } else {
        this.score += Math.round(2000 * this.difficultyConfig.scoreScale);
      }
    }

    this._emit('pickup', item.x, item.y, color, 1, false);
  }

  _resolveCollisions(dt) {
    // 1. Player bullets vs enemies
    const remainingPlayerBullets = [];
    for (const pb of this.playerBullets) {
      let consumed = false;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        const hitR = enemy.radius + pb.radius;
        if (distSq(pb.x, pb.y, enemy.x, enemy.y) <= hitR * hitR) {
          consumed = true;
          this._damageEnemy(enemy, pb.damage);
          if (this._hitSoundCooldown <= 0) {
            this._hitSoundCooldown = 0.05;
            this._emit('hit', pb.x, pb.y, 'white', 1, enemy.isBoss);
          }
          break;
        }
      }
      if (!consumed) {
        remainingPlayerBullets.push(pb);
      }
    }
    this.playerBullets = remainingPlayerBullets;

    // Clean up dead enemies
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // 2. Enemy bullets & lasers vs player
    const p = this.player;
    if (!p.alive) return;

    let playerWasHit = false;
    const remainingEnemyBullets = [];

    for (const eb of this.enemyBullets) {
      const dSq = distSq(p.x, p.y, eb.x, eb.y);
      const hitR = p.hitboxRadius + eb.radius * 0.72;
      if (dSq <= hitR * hitR) {
        if (p.invulnTimer <= 0) {
          playerWasHit = true;
          continue; // bullet consumed on hit
        }
      }

      const grazeR = p.grazeRadius + eb.radius;
      if (!eb.grazeCounted && dSq <= grazeR * grazeR) {
        eb.grazeCounted = true;
        this.graze += 1;
        this.combo += 1;
        this.comboTimer = COMBO_DECAY_TIME;
        this.score += Math.round((50 + Math.min(50, this.combo) * 2) * this.difficultyConfig.scoreScale);
        this._emit('graze', (p.x + eb.x) * 0.5, (p.y + eb.y) * 0.5, eb.color, 1, false);
      }

      remainingEnemyBullets.push(eb);
    }
    this.enemyBullets = remainingEnemyBullets;

    for (const l of this.lasers) {
      if (l.state !== 'active') continue;
      const dSq = pointToSegmentDistSq(p.x, p.y, l.x1, l.y1, l.x2, l.y2);
      const hitR = p.hitboxRadius + l.width * 0.4;
      if (dSq <= hitR * hitR && p.invulnTimer <= 0) {
        playerWasHit = true;
      } else {
        const grazeR = p.grazeRadius + l.width * 0.45;
        if (dSq <= grazeR * grazeR && l.grazeCooldown <= 0) {
          l.grazeCooldown = 0.12;
          this.graze += 1;
          this.combo += 1;
          this.comboTimer = COMBO_DECAY_TIME;
          this.score += Math.round(60 * this.difficultyConfig.scoreScale);
          this._emit('graze', p.x, p.y, l.color, 1, false);
        }
      }
    }

    if (playerWasHit) {
      this._handlePlayerHit();
    }
  }

  _damageEnemy(enemy, damage) {
    if (enemy.hp <= 0) return;
    enemy.hp -= damage;
    enemy.hitFlash = 1.0;

    if (enemy.hp > 0) return;

    // Boss phase transition
    if (enemy.isBoss && enemy.phases && enemy.phaseIndex + 1 < enemy.maxPhases) {
      enemy.phaseIndex += 1;
      const nextPhase = enemy.phases[enemy.phaseIndex];
      enemy.hp = nextPhase.hp;
      enemy.maxHp = nextPhase.hp;
      enemy.spellName = nextPhase.spellName || '';
      enemy.moveFn = nextPhase.moveFn || enemy.moveFn;
      enemy.patternFn = nextPhase.patternFn || enemy.patternFn;
      enemy.fireTimer = 0.45;
      enemy.step = 0;

      this._clearBulletsAndLasers(true);
      this._spawnDropTable(enemy.x, enemy.y, { power: 2, score: 6, bomb: 0, life: 0 });
      this.score += Math.round(2500 * this.difficultyConfig.scoreScale);
      this.screenShake = Math.max(this.screenShake, 8);
      this.banner = {
        text: enemy.spellName || `PHASE ${enemy.phaseIndex + 1}`,
        subtext: 'SPELL CARD',
        timer: 2.3,
        type: 'spell',
      };
      this._emit('bossPhase', enemy.x, enemy.y, 'magenta', 2.5, true);
      return;
    }

    // Enemy completely defeated
    enemy.hp = 0;
    this.combo += 1;
    this.comboTimer = COMBO_DECAY_TIME;
    const comboMul = 1 + Math.min(50, this.combo) * 0.02;
    this.score += Math.round(enemy.scoreValue * comboMul * this.difficultyConfig.scoreScale);

    this._spawnDropTable(enemy.x, enemy.y, enemy.dropTable);
    this._emit('kill', enemy.x, enemy.y, enemy.isBoss ? 'amber' : 'cyan', enemy.isBoss ? 3 : 1.5, enemy.isBoss);

    if (enemy.isBoss) {
      this._clearBulletsAndLasers(true);
      this.screenShake = Math.max(this.screenShake, 14);
      this.bombFlash = Math.max(this.bombFlash, 0.7);
      this._emit('stageClear', enemy.x, enemy.y, 'amber', 3, true);

      if (this.stage >= STAGES.length) {
        this.phase = 'victory';
        this.banner = {
          text: 'ALL CLEAR!',
          subtext: 'MISSION COMPLETE',
          timer: 6.0,
          type: 'clear',
        };
        this._emit('victory', enemy.x, enemy.y, 'white', 3, true);
      } else {
        this.phase = 'stage_clear';
        this.stageClearTimer = STAGE_CLEAR_DURATION;
        this.banner = {
          text: `STAGE ${this.stage} CLEAR`,
          subtext: 'PREPARE FOR NEXT SECTOR',
          timer: STAGE_CLEAR_DURATION,
          type: 'clear',
        };
      }
    }
  }

  _spawnDropTable(x, y, dropTable) {
    if (!dropTable) return;
    const spawnBatch = (kind, count) => {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const speed = 70 + Math.random() * 55;
        this.items.push(createItem({
          x: clamp(x + (Math.random() - 0.5) * 24, 20, GAME_WIDTH - 20),
          y: clamp(y + (Math.random() - 0.5) * 20, 20, GAME_HEIGHT - 120),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          kind,
          radius: kind === 'bomb' || kind === 'life' ? 10 : 8,
        }));
      }
    };

    spawnBatch('power', dropTable.power || 0);
    spawnBatch('score', dropTable.score || 0);
    spawnBatch('bomb', dropTable.bomb || 0);
    spawnBatch('life', dropTable.life || 0);
  }

  _handlePlayerHit() {
    const p = this.player;
    p.lives = Math.max(0, p.lives - 1);
    this.combo = 0;
    this.comboTimer = 0;
    this.power = Math.max(0, this.power - 15);
    this.screenShake = 16;
    this.bombFlash = 0.45;

    // Clear bullets near player for fair recovery
    const clearRadiusSq = 150 * 150;
    this.enemyBullets = this.enemyBullets.filter((b) => distSq(p.x, p.y, b.x, b.y) > clearRadiusSq);

    this._emit('playerHit', p.x, p.y, 'crimson', 2.2, false);

    if (p.lives <= 0) {
      p.alive = false;
      p.respawnTimer = 0;
      this.phase = 'gameover';
      this.banner = {
        text: 'GAME OVER',
        subtext: 'SIGNAL LOST',
        timer: 5.0,
        type: 'warning',
      };
      this._emit('gameover', p.x, p.y, 'crimson', 3, false);
    } else {
      p.alive = false;
      p.respawnTimer = PLAYER_RESPAWN_DELAY;
    }
  }

  _computeStageProgress() {
    if (this.phase === 'stage_clear' || this.phase === 'victory') {
      return 1;
    }
    const stageCfg = getStageConfig(this.stage);
    const boss = this.enemies.find((e) => e.isBoss);
    if (boss) {
      const totalPhases = Math.max(1, boss.maxPhases);
      const completedPhases = boss.phaseIndex;
      const currentPhaseDone = 1 - clamp(boss.hp / Math.max(1, boss.maxHp), 0, 1);
      const bossDoneRatio = (completedPhases + currentPhaseDone) / totalPhases;
      return clamp(0.75 + 0.25 * bossDoneRatio, 0, 1);
    }
    if (this.bossSpawned) {
      return 1;
    }
    return clamp((this.stageTime / Math.max(1, stageCfg.bossTime)) * 0.75, 0, 0.75);
  }

  getState() {
    const stageCfg = getStageConfig(this.stage);
    const p = this.player;

    return {
      phase: this.phase,
      difficulty: this.difficulty,
      stage: this.stage,
      stageName: stageCfg.name,
      stageProgress: this._computeStageProgress(),
      score: this.score,
      graze: this.graze,
      combo: this.combo,
      power: this.power,
      time: this.time,
      banner: this.banner
        ? {
            text: this.banner.text,
            subtext: this.banner.subtext,
            timer: this.banner.timer,
            type: this.banner.type,
          }
        : null,
      screenShake: this.screenShake,
      bombFlash: this.bombFlash,
      player: {
        x: p.x,
        y: p.y,
        hitboxRadius: p.hitboxRadius,
        grazeRadius: p.grazeRadius,
        lives: p.lives,
        bombs: p.bombs,
        invulnTimer: p.invulnTimer,
        focus: p.focus,
        alive: p.alive,
        respawnTimer: p.respawnTimer,
      },
      playerBullets: this.playerBullets.map((b) => ({
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        radius: b.radius,
        damage: b.damage,
        kind: b.kind,
      })),
      enemies: this.enemies.map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        radius: e.radius,
        hp: e.hp,
        maxHp: e.maxHp,
        kind: e.kind,
        isBoss: e.isBoss,
        phaseIndex: e.phaseIndex,
        maxPhases: e.maxPhases,
        spellName: e.spellName,
        angle: e.angle,
        hitFlash: e.hitFlash,
      })),
      enemyBullets: this.enemyBullets.map((b) => ({
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        radius: b.radius,
        color: b.color,
        shape: b.shape,
        angle: b.angle,
        grazeCounted: b.grazeCounted,
      })),
      lasers: this.lasers.map((l) => ({
        x1: l.x1,
        y1: l.y1,
        x2: l.x2,
        y2: l.y2,
        width: l.width,
        state: l.state,
        timer: l.timer,
        color: l.color,
      })),
      items: this.items.map((it) => ({
        x: it.x,
        y: it.y,
        vx: it.vx,
        vy: it.vy,
        kind: it.kind,
        radius: it.radius,
      })),
      events: this.events.slice(),
    };
  }
}
