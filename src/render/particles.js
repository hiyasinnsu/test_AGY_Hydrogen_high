const MAX_PARTICLES = 320;
const MAX_RINGS = 28;

export const NEON_PALETTE = {
  cyan: { hex: '#00f0ff', glow: 'rgba(0, 240, 255, 0.55)', rgb: '0, 240, 255' },
  magenta: { hex: '#ff2bd6', glow: 'rgba(255, 43, 214, 0.55)', rgb: '255, 43, 214' },
  amber: { hex: '#ffaa00', glow: 'rgba(255, 170, 0, 0.55)', rgb: '255, 170, 0' },
  lime: { hex: '#39ff14', glow: 'rgba(57, 255, 20, 0.55)', rgb: '57, 255, 20' },
  violet: { hex: '#9d4edd', glow: 'rgba(157, 78, 221, 0.55)', rgb: '157, 78, 221' },
  crimson: { hex: '#ff2a55', glow: 'rgba(255, 42, 85, 0.55)', rgb: '255, 42, 85' },
  white: { hex: '#e8f6ff', glow: 'rgba(232, 246, 255, 0.55)', rgb: '232, 246, 255' },
};

export function resolveNeonColor(colorName) {
  if (colorName && NEON_PALETTE[colorName]) {
    return NEON_PALETTE[colorName];
  }
  return NEON_PALETTE.cyan;
}

export class ParticleSystem {
  constructor(maxParticles = MAX_PARTICLES, maxRings = MAX_RINGS) {
    this.maxParticles = maxParticles;
    this.maxRings = maxRings;
    this.particles = [];
    this.rings = [];
  }

  reset() {
    this.particles.length = 0;
    this.rings.length = 0;
  }

  getCount() {
    return this.particles.length + this.rings.length;
  }

  _pushParticle(p) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  _pushRing(r) {
    if (this.rings.length >= this.maxRings) {
      this.rings.shift();
    }
    this.rings.push(r);
  }

  spawnExplosion(x, y, colorName = 'amber', count = 16, speedScale = 1, sizeScale = 1) {
    const palette = resolveNeonColor(colorName);
    const n = Math.min(count, 48);
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.45;
      const speed = (45 + Math.random() * 165) * speedScale;
      const life = 0.28 + Math.random() * 0.34;
      this._pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (1.8 + Math.random() * 2.8) * sizeScale,
        life,
        maxLife: life,
        drag: 3.2,
        rgb: palette.rgb,
        shape: i % 3 === 0 ? 'diamond' : 'spark',
        angle,
      });
    }

    this._pushRing({
      x,
      y,
      radius: 4 * sizeScale,
      maxRadius: (28 + Math.random() * 14) * sizeScale,
      life: 0.32,
      maxLife: 0.32,
      lineWidth: 2.4 * sizeScale,
      rgb: palette.rgb,
    });
  }

  spawnHitSpark(x, y, colorName = 'cyan') {
    const palette = resolveNeonColor(colorName);
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 55 + Math.random() * 90;
      const life = 0.14 + Math.random() * 0.1;
      this._pushParticle({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.4 + Math.random() * 1.4,
        life,
        maxLife: life,
        drag: 5.5,
        rgb: palette.rgb,
        shape: 'spark',
        angle,
      });
    }
  }

  spawnGrazeSpark(x, y, colorName = 'cyan') {
    const palette = resolveNeonColor(colorName);
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 75 + Math.random() * 110;
      const life = 0.16 + Math.random() * 0.12;
      this._pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 1.3,
        life,
        maxLife: life,
        drag: 4.5,
        rgb: i === 0 ? NEON_PALETTE.white.rgb : palette.rgb,
        shape: 'spark',
        angle,
      });
    }
  }

  spawnPickupEffect(x, y, colorName = 'lime') {
    const palette = resolveNeonColor(colorName);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.3;
      const speed = 28 + Math.random() * 52;
      const life = 0.22 + Math.random() * 0.16;
      this._pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 24,
        size: 1.8 + Math.random() * 1.4,
        life,
        maxLife: life,
        drag: 3.0,
        rgb: palette.rgb,
        shape: 'diamond',
        angle,
      });
    }
    this._pushRing({
      x,
      y,
      radius: 3,
      maxRadius: 18,
      life: 0.24,
      maxLife: 0.24,
      lineWidth: 1.6,
      rgb: palette.rgb,
    });
  }

  spawnBombWave(x, y) {
    this._pushRing({
      x,
      y,
      radius: 10,
      maxRadius: 420,
      life: 0.65,
      maxLife: 0.65,
      lineWidth: 5,
      rgb: NEON_PALETTE.cyan.rgb,
    });
    this._pushRing({
      x,
      y,
      radius: 4,
      maxRadius: 310,
      life: 0.52,
      maxLife: 0.52,
      lineWidth: 3,
      rgb: NEON_PALETTE.white.rgb,
    });
    this.spawnExplosion(x, y, 'cyan', 36, 1.8, 1.5);
  }

  spawnPlayerHit(x, y) {
    this._pushRing({
      x,
      y,
      radius: 4,
      maxRadius: 110,
      life: 0.45,
      maxLife: 0.45,
      lineWidth: 3.5,
      rgb: NEON_PALETTE.crimson.rgb,
    });
    this.spawnExplosion(x, y, 'crimson', 28, 1.35, 1.25);
  }

  spawnBossPhaseWave(x, y, colorName = 'magenta') {
    const palette = resolveNeonColor(colorName);
    this._pushRing({
      x,
      y,
      radius: 8,
      maxRadius: 220,
      life: 0.55,
      maxLife: 0.55,
      lineWidth: 4,
      rgb: palette.rgb,
    });
    this.spawnExplosion(x, y, colorName, 32, 1.45, 1.35);
  }

  ingestEvents(events, state) {
    if (!Array.isArray(events) || events.length === 0) return;

    const px = state?.player?.x ?? 180;
    const py = state?.player?.y ?? 520;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev) continue;
      const x = ev.x ?? px;
      const y = ev.y ?? py;

      switch (ev.type) {
        case 'hit':
          this.spawnHitSpark(x, y, ev.color || 'cyan');
          break;
        case 'kill': {
          const isBoss = Boolean(ev.isBoss);
          const scale = isBoss ? 2.2 : Math.max(0.85, (ev.size || 16) / 16);
          this.spawnExplosion(
            x,
            y,
            ev.color || (isBoss ? 'magenta' : 'amber'),
            isBoss ? 44 : 18,
            isBoss ? 1.7 : 1.05,
            scale
          );
          if (isBoss) {
            this._pushRing({
              x,
              y,
              radius: 12,
              maxRadius: 260,
              life: 0.65,
              maxLife: 0.65,
              lineWidth: 4.5,
              rgb: NEON_PALETTE.white.rgb,
            });
          }
          break;
        }
        case 'graze':
          this.spawnGrazeSpark(x, y, ev.color || 'cyan');
          break;
        case 'pickup':
          this.spawnPickupEffect(x, y, ev.color || 'lime');
          break;
        case 'playerHit':
          this.spawnPlayerHit(x, y);
          break;
        case 'bomb':
          this.spawnBombWave(x, y);
          break;
        case 'bossPhase':
          this.spawnBossPhaseWave(x, y, ev.color || 'magenta');
          break;
        default:
          break;
      }
    }
  }

  update(dt) {
    if (!dt || dt <= 0) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
      }
    }
  }

  render(ctx) {
    if (!ctx) return;
    if (this.particles.length === 0 && this.rings.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      const progress = 1 - r.life / r.maxLife;
      const eased = 1 - (1 - progress) * (1 - progress);
      const radius = r.radius + (r.maxRadius - r.radius) * eased;
      const alpha = Math.max(0, (1 - progress) * 0.85);

      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r.rgb}, ${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(0.75, r.lineWidth * (1 - progress * 0.65));
      ctx.stroke();
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const t = Math.max(0, p.life / p.maxLife);
      const alpha = t * 0.92;
      const s = p.size * (0.45 + 0.55 * t);

      if (p.shape === 'diamond') {
        ctx.fillStyle = `rgba(${p.rgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s * 1.4);
        ctx.lineTo(p.x + s * 1.1, p.y);
        ctx.lineTo(p.x, p.y + s * 1.4);
        ctx.lineTo(p.x - s * 1.1, p.y);
        ctx.closePath();
        ctx.fill();
      } else {
        const tailX = p.x - p.vx * 0.028;
        const tailY = p.y - p.vy * 0.028;
        ctx.strokeStyle = `rgba(${p.rgb}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = s * 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
