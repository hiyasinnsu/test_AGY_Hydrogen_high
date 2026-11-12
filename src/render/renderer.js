import { ParticleSystem, NEON_PALETTE, resolveNeonColor } from './particles.js';

export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 640;

const STAGE_THEMES = {
  1: {
    bgTop: '#040814',
    bgBottom: '#0a1630',
    nebulaA: 'rgba(0, 175, 255, 0.14)',
    nebulaB: 'rgba(65, 90, 255, 0.11)',
    grid: 'rgba(0, 225, 255, 0.16)',
    gridAccent: 'rgba(0, 240, 255, 0.32)',
    starRgb: '180, 235, 255',
  },
  2: {
    bgTop: '#0c0517',
    bgBottom: '#1c092b',
    nebulaA: 'rgba(255, 43, 214, 0.14)',
    nebulaB: 'rgba(130, 60, 255, 0.12)',
    grid: 'rgba(220, 65, 255, 0.16)',
    gridAccent: 'rgba(255, 65, 214, 0.32)',
    starRgb: '245, 200, 255',
  },
  3: {
    bgTop: '#12040a',
    bgBottom: '#260913',
    nebulaA: 'rgba(255, 55, 95, 0.16)',
    nebulaB: 'rgba(255, 165, 30, 0.11)',
    grid: 'rgba(255, 90, 60, 0.16)',
    gridAccent: 'rgba(255, 170, 40, 0.34)',
    starRgb: '255, 225, 195',
  },
};

const BULLET_SHAPES = ['orb', 'needle', 'rice', 'diamond', 'ring'];
const BULLET_COLORS = ['cyan', 'magenta', 'amber', 'lime', 'violet', 'crimson', 'white'];

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas || null;
    this.ctx = this.canvas && typeof this.canvas.getContext === 'function'
      ? this.canvas.getContext('2d')
      : null;

    this.particles = new ParticleSystem(320, 28);
    this.time = 0;
    this.gridScroll = 0;
    this.lastCssWidth = 0;
    this.lastCssHeight = 0;
    this.dpr = 1;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.stars = this._createStars(96);
    this.bulletSprites = this._buildBulletSpriteCache();

    this.resize();
  }

  _createStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      const layer = i % 3;
      stars.push({
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT,
        layer,
        speed: layer === 0 ? 22 : layer === 1 ? 52 : 105,
        size: layer === 0 ? 0.9 : layer === 1 ? 1.35 : 1.9,
        alpha: layer === 0 ? 0.35 : layer === 1 ? 0.62 : 0.9,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
    return stars;
  }

  _buildBulletSpriteCache() {
    if (typeof document === 'undefined' || !document.createElement) {
      return null;
    }

    const cache = new Map();
    const spriteSize = 64;
    const half = spriteSize / 2;
    const baseRadius = 12;

    for (const colorName of BULLET_COLORS) {
      const palette = resolveNeonColor(colorName);
      for (const shape of BULLET_SHAPES) {
        const off = document.createElement('canvas');
        off.width = spriteSize;
        off.height = spriteSize;
        const octx = off.getContext('2d');
        if (!octx) continue;

        octx.translate(half, half);
        this._drawBulletShapeVector(octx, shape, baseRadius, palette, true);
        cache.set(`${colorName}:${shape}`, {
          canvas: off,
          baseRadius,
          spriteSize,
        });
      }
    }

    return cache;
  }

  _drawBulletShapeVector(ctx, shape, r, palette, useShadow = false) {
    ctx.save();
    if (useShadow) {
      ctx.shadowColor = palette.hex;
      ctx.shadowBlur = r * 0.95;
    }

    if (shape === 'orb') {
      // Soft outer halo
      ctx.fillStyle = `rgba(${palette.rgb}, 0.38)`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.38, 0, Math.PI * 2);
      ctx.fill();

      // Saturated neon rim
      ctx.fillStyle = palette.hex;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // Crisp white core
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.64, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'needle') {
      const len = r * 2.15;
      const wid = r * 0.72;

      ctx.fillStyle = `rgba(${palette.rgb}, 0.35)`;
      ctx.beginPath();
      ctx.moveTo(len * 1.15, 0);
      ctx.lineTo(-len * 0.45, wid * 1.25);
      ctx.lineTo(-len * 0.95, 0);
      ctx.lineTo(-len * 0.45, -wid * 1.25);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = palette.hex;
      ctx.beginPath();
      ctx.moveTo(len, 0);
      ctx.lineTo(-len * 0.35, wid);
      ctx.lineTo(-len * 0.8, 0);
      ctx.lineTo(-len * 0.35, -wid);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(len * 0.72, 0);
      ctx.lineTo(-len * 0.25, wid * 0.52);
      ctx.lineTo(-len * 0.55, 0);
      ctx.lineTo(-len * 0.25, -wid * 0.52);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'rice') {
      const rx = r * 1.55;
      const ry = r * 0.78;

      ctx.fillStyle = `rgba(${palette.rgb}, 0.35)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.22, ry * 1.32, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.hex;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.65, ry * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'diamond') {
      const lx = r * 1.45;
      const ly = r * 1.05;

      ctx.fillStyle = `rgba(${palette.rgb}, 0.34)`;
      ctx.beginPath();
      ctx.moveTo(lx * 1.2, 0);
      ctx.lineTo(0, ly * 1.2);
      ctx.lineTo(-lx * 1.2, 0);
      ctx.lineTo(0, -ly * 1.2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = palette.hex;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(0, ly);
      ctx.lineTo(-lx, 0);
      ctx.lineTo(0, -ly);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(lx * 0.58, 0);
      ctx.lineTo(0, ly * 0.58);
      ctx.lineTo(-lx * 0.58, 0);
      ctx.lineTo(0, -ly * 0.58);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'ring') {
      ctx.strokeStyle = `rgba(${palette.rgb}, 0.42)`;
      ctx.lineWidth = r * 0.78;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = palette.hex;
      ctx.lineWidth = r * 0.48;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.22;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Fallback orb
      ctx.fillStyle = palette.hex;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  resize() {
    if (!this.canvas) return;

    const cssW = this.canvas.clientWidth || this.canvas.width || LOGICAL_WIDTH;
    const cssH = this.canvas.clientHeight || this.canvas.height || LOGICAL_HEIGHT;
    const rawDpr = typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1;
    const dpr = Math.min(Math.max(rawDpr, 1), 3);

    const targetW = Math.max(1, Math.round(cssW * dpr));
    const targetH = Math.max(1, Math.round(cssH * dpr));

    if (this.canvas.width !== targetW) this.canvas.width = targetW;
    if (this.canvas.height !== targetH) this.canvas.height = targetH;

    this.dpr = dpr;
    this.lastCssWidth = cssW;
    this.lastCssHeight = cssH;

    const scaleX = cssW / LOGICAL_WIDTH;
    const scaleY = cssH / LOGICAL_HEIGHT;
    this.scale = Math.min(scaleX, scaleY);
    this.offsetX = (cssW - LOGICAL_WIDTH * this.scale) * 0.5;
    this.offsetY = (cssH - LOGICAL_HEIGHT * this.scale) * 0.5;
  }

  reset() {
    this.particles.reset();
    this.time = 0;
    this.gridScroll = 0;
  }

  render(state, dt = 1 / 60) {
    if (!this.ctx || !this.canvas) return;

    const clientW = this.canvas.clientWidth;
    const clientH = this.canvas.clientHeight;
    if (clientW > 0 && clientH > 0 && (clientW !== this.lastCssWidth || clientH !== this.lastCssHeight)) {
      this.resize();
    }

    const clampedDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 1 / 60, 0), 0.1);
    const isPaused = state?.phase === 'paused';

    if (!isPaused) {
      this.time += clampedDt;
      const bossActive = Array.isArray(state?.enemies) && state.enemies.some((e) => e && e.isBoss);
      const scrollBoost = bossActive ? 1.45 : 1.0;
      this.gridScroll = (this.gridScroll + clampedDt * 58 * scrollBoost) % 40;
      this._updateStars(clampedDt, scrollBoost);

      if (state?.events) {
        this.particles.ingestEvents(state.events, state);
      }
      this.particles.update(clampedDt);
    }

    const ctx = this.ctx;
    ctx.save();

    // Clear full backing buffer in identity transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04060d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply DPR + aspect-fit transform to 360x640 logical space
    const totalScale = this.scale * this.dpr;
    ctx.setTransform(
      totalScale,
      0,
      0,
      totalScale,
      this.offsetX * this.dpr,
      this.offsetY * this.dpr
    );

    // Clip to logical playfield
    ctx.beginPath();
    ctx.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.clip();

    // Screen shake offset
    const shake = state?.screenShake || 0;
    if (shake > 0.05) {
      const mag = Math.min(shake, 16);
      const sx = (Math.random() - 0.5) * 2 * mag;
      const sy = (Math.random() - 0.5) * 2 * mag;
      ctx.translate(sx, sy);
    }

    const stageNum = state?.stage || 1;
    const bossEnemy = Array.isArray(state?.enemies)
      ? state.enemies.find((e) => e && e.isBoss)
      : null;

    this._drawBackground(ctx, stageNum, Boolean(bossEnemy));
    this._drawItems(ctx, state?.items);
    this._drawPlayerBullets(ctx, state?.playerBullets);
    this._drawEnemies(ctx, state?.enemies);
    this.particles.render(ctx);
    this._drawPlayer(ctx, state?.player, state?.power || 0);
    this._drawLasers(ctx, state?.lasers);
    this._drawEnemyBullets(ctx, state?.enemyBullets);
    this._drawBombAndFlash(ctx, state?.bombFlash || 0);

    if (bossEnemy) {
      this._drawBossHud(ctx, bossEnemy);
    }

    if (state?.banner) {
      this._drawBanner(ctx, state.banner);
    }

    ctx.restore();
  }

  _updateStars(dt, speedMult) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      s.y += s.speed * speedMult * dt;
      if (s.y > LOGICAL_HEIGHT + 4) {
        s.y = -4;
        s.x = Math.random() * LOGICAL_WIDTH;
      }
    }
  }

  _drawBackground(ctx, stage, isBoss) {
    const theme = STAGE_THEMES[((stage - 1) % 3) + 1] || STAGE_THEMES[1];

    const bgGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-20, -20, LOGICAL_WIDTH + 40, LOGICAL_HEIGHT + 40);

    // Subtle drifting nebula glow
    const driftY = Math.sin(this.time * 0.28) * 35;
    const nebA = ctx.createRadialGradient(90, 180 + driftY, 10, 90, 180 + driftY, 210);
    nebA.addColorStop(0, theme.nebulaA);
    nebA.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebA;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const nebB = ctx.createRadialGradient(280, 440 - driftY, 10, 280, 440 - driftY, 220);
    nebB.addColorStop(0, isBoss ? 'rgba(255, 42, 85, 0.16)' : theme.nebulaB);
    nebB.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebB;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Parallax neon perspective grid
    ctx.save();
    ctx.strokeStyle = isBoss ? 'rgba(255, 60, 120, 0.16)' : theme.grid;
    ctx.lineWidth = 1;

    const spacing = 40;
    const vanishX = LOGICAL_WIDTH * 0.5;
    // Vertical converging synthwave lines
    for (let gx = -160; gx <= LOGICAL_WIDTH + 160; gx += spacing) {
      ctx.beginPath();
      ctx.moveTo(vanishX + (gx - vanishX) * 0.38, 0);
      ctx.lineTo(gx, LOGICAL_HEIGHT);
      ctx.stroke();
    }

    // Horizontal scrolling lines with depth acceleration
    for (let gy = this.gridScroll - spacing; gy < LOGICAL_HEIGHT; gy += spacing) {
      if (gy < 0) continue;
      const t = gy / LOGICAL_HEIGHT;
      ctx.strokeStyle = t > 0.72
        ? (isBoss ? 'rgba(255, 80, 140, 0.28)' : theme.gridAccent)
        : (isBoss ? 'rgba(255, 60, 120, 0.14)' : theme.grid);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(LOGICAL_WIDTH, gy);
      ctx.stroke();
    }
    ctx.restore();

    // 3-layer parallax starfield
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const twinkle = 0.72 + 0.28 * Math.sin(this.time * 3.4 + s.twinklePhase);
      const alpha = s.alpha * twinkle;
      ctx.fillStyle = `rgba(${theme.starRgb}, ${alpha.toFixed(3)})`;
      if (s.layer === 2) {
        ctx.fillRect(s.x - s.size * 0.45, s.y - s.size * 1.4, s.size * 0.9, s.size * 2.8);
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Auto-collection line indicator (y = 160 subtle cyber line)
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 160);
    ctx.lineTo(LOGICAL_WIDTH - 12, 160);
    ctx.stroke();
    ctx.restore();
  }

  _drawItems(ctx, items) {
    if (!Array.isArray(items) || items.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 8px monospace';

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const r = Math.max(6, item.radius || 7);
      const pulse = 1 + 0.08 * Math.sin(this.time * 8 + i);

      let color = NEON_PALETTE.cyan;
      let label = 'S';
      if (item.kind === 'power') {
        color = NEON_PALETTE.amber;
        label = 'P';
      } else if (item.kind === 'bomb') {
        color = NEON_PALETTE.lime;
        label = 'B';
      } else if (item.kind === 'life') {
        color = NEON_PALETTE.magenta;
        label = '+';
      }

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = `rgba(${color.rgb}, 0.25)`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#091020';
      ctx.strokeStyle = color.hex;
      ctx.lineWidth = 1.6;
      if (item.kind === 'bomb' || item.kind === 'life') {
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, 0, 0.5);
      ctx.restore();
    }

    ctx.restore();
  }

  _drawPlayerBullets(ctx, bullets) {
    if (!Array.isArray(bullets) || bullets.length === 0) return;

    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b) continue;
      const r = b.radius || 3.5;
      const angle = Math.atan2(b.vy || -1, b.vx || 0);
      const isHoming = b.kind === 'homing';
      const isSpread = b.kind === 'wing' || b.kind === 'spread';
      const isFocused = b.kind === 'focused';

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);

      ctx.fillStyle = isHoming
        ? 'rgba(180, 90, 255, 0.65)'
        : isSpread
          ? 'rgba(0, 255, 195, 0.6)'
          : isFocused
            ? 'rgba(120, 245, 255, 0.72)'
            : 'rgba(0, 220, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 2.5, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(235, 252, 255, 0.88)';
      ctx.beginPath();
      ctx.ellipse(r * 0.3, 0, r * 1.6, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  _drawEnemies(ctx, enemies) {
    if (!Array.isArray(enemies) || enemies.length === 0) return;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e) continue;

      const r = Math.max(8, e.radius || 14);
      const hitFlash = (e.hitFlash || 0) > 0;

      ctx.save();
      ctx.translate(e.x, e.y);

      if (e.isBoss) {
        this._drawBossEntity(ctx, e, r, hitFlash);
      } else {
        this._drawRegularEnemy(ctx, e, r, hitFlash);
      }

      ctx.restore();
    }
  }

  _drawRegularEnemy(ctx, e, r, hitFlash) {
    const kind = String(e.kind || 'scout').toLowerCase();
    const spin = this.time * 2.2 + (e.id || 0);
    let primary = NEON_PALETTE.amber;

    if (kind.includes('weaver') || kind.includes('fairy') || kind.includes('orb') || kind.includes('spinner')) {
      primary = NEON_PALETTE.magenta;
    } else if (kind.includes('turret') || kind.includes('heavy') || kind.includes('gunship') || kind.includes('midboss')) {
      primary = NEON_PALETTE.crimson;
    } else if (kind.includes('wing')) {
      primary = NEON_PALETTE.cyan;
    } else if (kind.includes('scout') || kind.includes('interceptor')) {
      primary = NEON_PALETTE.lime;
    }

    // Outer ambient glow
    ctx.fillStyle = `rgba(${primary.rgb}, 0.2)`;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (Number.isFinite(e.angle) && (kind.includes('scout') || kind.includes('wing'))) {
      // Subtle banking tilt when moving sideways while keeping nose pointed downfield
      ctx.rotate(-Math.cos(e.angle) * 0.22);
    }

    ctx.fillStyle = hitFlash ? '#ffffff' : '#101528';
    ctx.strokeStyle = hitFlash ? '#ffffff' : primary.hex;
    ctx.lineWidth = 2;

    if (kind.includes('turret') || kind.includes('heavy') || kind.includes('midboss')) {
      // Hexagonal armored chassis
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI * 2 * k) / 6 + (kind.includes('midboss') ? spin * 0.4 : 0);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner rotating ring
      ctx.strokeStyle = hitFlash ? '#ffffff' : NEON_PALETTE.amber.hex;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, spin, spin + Math.PI * 1.35);
      ctx.stroke();
    } else if (kind.includes('weaver') || kind.includes('fairy') || kind.includes('spinner') || kind.includes('orb')) {
      // Rotating twin-diamond geometric star
      for (let layer = 0; layer < 2; layer++) {
        ctx.save();
        ctx.rotate(spin * (layer === 0 ? 1 : -1) + layer * (Math.PI / 4));
        ctx.beginPath();
        ctx.rect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Sleek chevron/delta craft
      ctx.beginPath();
      ctx.moveTo(0, r * 1.05);
      ctx.lineTo(r * 0.92, -r * 0.55);
      ctx.lineTo(0, -r * 0.25);
      ctx.lineTo(-r * 0.92, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Core eye
    ctx.fillStyle = hitFlash ? '#ffffff' : primary.hex;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Mini HP ring for tougher enemies that have taken damage
    if (e.maxHp > 20 && e.hp < e.maxHp && e.hp > 0) {
      const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = primary.hex;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
    }
  }

  _drawBossEntity(ctx, boss, r, hitFlash) {
    const phaseRatio = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 1;
    const rotA = this.time * 0.9;
    const rotB = -this.time * 1.35;
    const bossColor = boss.phaseIndex % 2 === 1 ? NEON_PALETTE.crimson : NEON_PALETTE.magenta;

    // Magic circle aura behind boss
    ctx.save();
    ctx.rotate(rotA);
    ctx.strokeStyle = `rgba(${bossColor.rgb}, 0.38)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.85, 0, Math.PI * 2);
    ctx.stroke();

    // Hexagram / sacred geometry lines
    for (let tri = 0; tri < 2; tri++) {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (Math.PI * 2 * k) / 3 + tri * (Math.PI / 3);
        const px = Math.cos(a) * r * 1.82;
        const py = Math.sin(a) * r * 1.82;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // Circular peripheral HP ring around boss
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = bossColor.hex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * phaseRatio);
    ctx.stroke();

    // Boss core hull
    ctx.save();
    ctx.rotate(rotB);
    ctx.fillStyle = hitFlash ? '#ffffff' : '#160b24';
    ctx.strokeStyle = hitFlash ? '#ffffff' : NEON_PALETTE.cyan.hex;
    ctx.lineWidth = 2.4;

    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI * 2 * k) / 8;
      const rad = k % 2 === 0 ? r * 1.08 : r * 0.72;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Inner core crystal
    ctx.fillStyle = hitFlash ? '#ffffff' : bossColor.hex;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBossHud(ctx, boss) {
    ctx.save();

    // Positioned below the top DOM HUD bar (~52px) so it never overlaps score/lives
    const barX = 18;
    const barY = 58;
    const barW = LOGICAL_WIDTH - 36;
    const barH = 7;
    const ratio = boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0;

    // Backing bar
    ctx.fillStyle = 'rgba(6, 10, 24, 0.78)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);

    // Gradient fill
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#ff2a55');
    grad.addColorStop(0.55, '#ff2bd6');
    grad.addColorStop(1, '#00f0ff');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * ratio, barH);

    // Remaining phase diamonds
    const maxPhases = Math.max(1, boss.maxPhases || 1);
    const currentPhase = Math.max(0, boss.phaseIndex || 0);
    const remainingPhases = Math.max(0, maxPhases - currentPhase);

    for (let i = 0; i < maxPhases; i++) {
      const dx = barX + 6 + i * 14;
      const dy = barY + 18;
      const active = i < remainingPhases;
      ctx.fillStyle = active ? '#ff2bd6' : 'rgba(255, 255, 255, 0.18)';
      ctx.strokeStyle = active ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 4);
      ctx.lineTo(dx + 4, dy);
      ctx.lineTo(dx, dy + 4);
      ctx.lineTo(dx - 4, dy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Spell card name badge
    if (boss.spellName) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      const label = boss.spellName;
      const textW = Math.min(220, ctx.measureText(label).width + 16);
      ctx.fillStyle = 'rgba(12, 8, 28, 0.72)';
      ctx.fillRect(barX + barW - textW, barY + 11, textW, 15);
      ctx.strokeStyle = 'rgba(255, 43, 214, 0.55)';
      ctx.strokeRect(barX + barW - textW, barY + 11, textW, 15);
      ctx.fillStyle = '#ffe8fb';
      ctx.fillText(label, barX + barW - 6, barY + 18.5, 208);
    }

    ctx.restore();
  }

  _drawPlayer(ctx, player, power) {
    if (!player) return;

    const { x, y } = player;
    const hitR = Math.max(2, player.hitboxRadius || 3);
    const grazeR = Math.max(10, player.grazeRadius || 18);

    if (!player.alive) {
      // Respawn reconstitution ring
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 18);
      ctx.save();
      ctx.strokeStyle = `rgba(0, 240, 255, ${(0.3 + pulse * 0.5).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 12 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const invuln = (player.invulnTimer || 0) > 0;
    const blinkOff = invuln && Math.floor(this.time * 24) % 2 === 0;

    ctx.save();
    ctx.translate(x, y);

    // Invulnerability shield ring
    if (invuln) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 19 + Math.sin(this.time * 20) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Focus mode: precision movement ring + graze radius display
    if (player.focus) {
      ctx.save();
      ctx.rotate(this.time * 1.8);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, grazeR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.rotate(-this.time * 3.6);
      ctx.strokeStyle = 'rgba(255, 43, 214, 0.72)';
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i;
        ctx.beginPath();
        ctx.arc(0, 0, grazeR + 4, a - 0.18, a + 0.18);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Flanking option pods at higher power (thresholds: Lv2=25, Lv3=55, Lv4=85)
    if (power >= 25 && !blinkOff) {
      const podDist = player.focus ? 13 : 19;
      const podY = player.focus ? -5 : 2;
      const pods = power >= 55 ? [-podDist, podDist, -podDist * 1.55, podDist * 1.55] : [-podDist, podDist];
      for (let i = 0; i < pods.length; i++) {
        const px = pods[i];
        const py = i >= 2 ? podY + 6 : podY;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(px, py, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fighter hull
    if (!blinkOff) {
      // Thruster flame
      const flameLen = 7 + Math.sin(this.time * 55) * 3;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.75)';
      ctx.beginPath();
      ctx.moveTo(-3.5, 9);
      ctx.lineTo(0, 9 + flameLen);
      ctx.lineTo(3.5, 9);
      ctx.closePath();
      ctx.fill();

      // Main delta wings
      ctx.fillStyle = '#122244';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(13, 8);
      ctx.lineTo(5, 6);
      ctx.lineTo(3, 11);
      ctx.lineTo(-3, 11);
      ctx.lineTo(-5, 6);
      ctx.lineTo(-13, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cockpit accent
      ctx.fillStyle = '#8ef9ff';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(3.2, 2);
      ctx.lineTo(-3.2, 2);
      ctx.closePath();
      ctx.fill();
    }

    // Hitbox core: ALWAYS crisply visible so player knows exact 3px collision center
    const corePulse = player.focus ? 1.15 : 1.0;
    ctx.fillStyle = 'rgba(255, 43, 214, 0.38)';
    ctx.beginPath();
    ctx.arc(0, 0, hitR * 2.1 * corePulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff2bd6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, hitR * corePulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  _drawLasers(ctx, lasers) {
    if (!Array.isArray(lasers) || lasers.length === 0) return;

    ctx.save();
    for (let i = 0; i < lasers.length; i++) {
      const l = lasers[i];
      if (!l) continue;
      const palette = resolveNeonColor(l.color || 'magenta');
      const width = Math.max(2, l.width || 12);

      if (l.state === 'telegraph') {
        const blink = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 24));
        ctx.save();
        ctx.strokeStyle = `rgba(${palette.rgb}, ${(0.45 * blink).toFixed(3)})`;
        ctx.lineWidth = Math.max(3, width * 0.42);
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${(0.85 * blink).toFixed(3)})`;
        ctx.lineWidth = 1.3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();

        // Origin warning ring
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(${palette.rgb}, ${(0.75 * blink).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(l.x1, l.y1, 5 + blink * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Active ultra-bright laser beam
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';

        const flutter = 0.94 + 0.1 * Math.sin(this.time * 48 + i);

        // Outer neon aura
        ctx.strokeStyle = `rgba(${palette.rgb}, 0.35)`;
        ctx.lineWidth = width * 1.9 * flutter;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();

        // Mid saturated beam
        ctx.strokeStyle = palette.hex;
        ctx.lineWidth = width * 1.1 * flutter;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();

        // Pure white core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, width * 0.48 * flutter);
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();

        // Emitter flare
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(l.x1, l.y1, width * 0.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
    ctx.restore();
  }

  _drawEnemyBullets(ctx, bullets) {
    if (!Array.isArray(bullets) || bullets.length === 0) return;

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (!b) continue;

      const r = Math.max(2.5, b.radius || 4.5);
      const colorName = NEON_PALETTE[b.color] ? b.color : 'cyan';
      const shape = BULLET_SHAPES.includes(b.shape) ? b.shape : 'orb';
      const needsRotation = shape !== 'orb' && shape !== 'ring';

      let angle = 0;
      if (needsRotation) {
        if (Number.isFinite(b.angle)) {
          angle = b.angle;
        } else if (Number.isFinite(b.vx) || Number.isFinite(b.vy)) {
          angle = Math.atan2(b.vy || 0, b.vx || 0);
        }
      }

      const sprite = this.bulletSprites ? this.bulletSprites.get(`${colorName}:${shape}`) : null;
      if (sprite) {
        const scale = r / sprite.baseRadius;
        const drawSize = sprite.spriteSize * scale;
        const half = drawSize * 0.5;

        if (needsRotation && angle !== 0) {
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(angle);
          ctx.drawImage(sprite.canvas, -half, -half, drawSize, drawSize);
          ctx.restore();
        } else {
          ctx.drawImage(sprite.canvas, b.x - half, b.y - half, drawSize, drawSize);
        }
      } else {
        const palette = resolveNeonColor(colorName);
        ctx.save();
        ctx.translate(b.x, b.y);
        if (needsRotation && angle !== 0) {
          ctx.rotate(angle);
        }
        this._drawBulletShapeVector(ctx, shape, r, palette, false);
        ctx.restore();
      }
    }
  }

  _drawBombAndFlash(ctx, bombFlash) {
    if (!bombFlash || bombFlash <= 0) return;

    const alpha = Math.min(0.85, bombFlash);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(170, 245, 255, ${(alpha * 0.45).toFixed(3)})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.restore();
  }

  _drawBanner(ctx, banner) {
    if (!banner || !banner.text) return;

    const type = banner.type || 'stage';
    const timer = Number.isFinite(banner.timer) ? banner.timer : 1.0;
    const alpha = Math.min(1, Math.max(0.15, timer * 1.4));

    ctx.save();
    ctx.globalAlpha = alpha;

    const centerY = type === 'spell' ? 114 : 225;
    let accent = NEON_PALETTE.cyan;
    if (type === 'warning') accent = NEON_PALETTE.crimson;
    else if (type === 'spell') accent = NEON_PALETTE.magenta;
    else if (type === 'clear') accent = NEON_PALETTE.amber;

    // Backing strip
    const bandH = type === 'spell' ? 42 : 66;
    const grad = ctx.createLinearGradient(0, centerY - bandH / 2, LOGICAL_WIDTH, centerY + bandH / 2);
    grad.addColorStop(0, 'rgba(6, 10, 22, 0.15)');
    grad.addColorStop(0.18, 'rgba(8, 12, 28, 0.88)');
    grad.addColorStop(0.82, 'rgba(8, 12, 28, 0.88)');
    grad.addColorStop(1, 'rgba(6, 10, 22, 0.15)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, centerY - bandH / 2, LOGICAL_WIDTH, bandH);

    // Top & bottom neon accent rules
    const pulse = type === 'warning' ? 0.5 + 0.5 * Math.sin(this.time * 22) : 1;
    ctx.strokeStyle = `rgba(${accent.rgb}, ${(0.85 * pulse).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, centerY - bandH / 2);
    ctx.lineTo(LOGICAL_WIDTH - 16, centerY - bandH / 2);
    ctx.moveTo(16, centerY + bandH / 2);
    ctx.lineTo(LOGICAL_WIDTH - 16, centerY + bandH / 2);
    ctx.stroke();

    // Hazard chevrons for warning banner
    if (type === 'warning') {
      ctx.fillStyle = `rgba(255, 42, 85, ${(0.22 * pulse).toFixed(2)})`;
      const offset = (this.time * 60) % 24;
      for (let x = -24 + offset; x < LOGICAL_WIDTH + 24; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, centerY - bandH / 2);
        ctx.lineTo(x + 10, centerY - bandH / 2);
        ctx.lineTo(x + 2, centerY - bandH / 2 + 8);
        ctx.lineTo(x - 8, centerY - bandH / 2 + 8);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (type === 'spell') {
      ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#ff9be9';
      ctx.fillText('SPELL CARD ACTIVATED', LOGICAL_WIDTH / 2, centerY - 10);

      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(banner.text, LOGICAL_WIDTH / 2, centerY + 8, LOGICAL_WIDTH - 36);
    } else {
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(banner.text, LOGICAL_WIDTH / 2, banner.subtext ? centerY - 9 : centerY, LOGICAL_WIDTH - 32);

      if (banner.subtext) {
        ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = accent.hex;
        ctx.fillText(banner.subtext, LOGICAL_WIDTH / 2, centerY + 14, LOGICAL_WIDTH - 40);
      }
    }

    ctx.restore();
  }
}
