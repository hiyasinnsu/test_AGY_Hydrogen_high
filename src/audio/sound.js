const MAX_SFX_VOICES = 16;

const EVENT_COOLDOWNS_MS = {
  shot: 48,
  hit: 36,
  graze: 28,
  pickup: 38,
  kill: 25,
};

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const BGM_THEMES = {
  stage1: {
    bpm: 138,
    bass: [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 48, 43, 55],
    lead: [69, null, 72, 76, 74, null, 72, 69, 67, null, 71, 74, 72, 71, 69, 64],
    arp: [57, 60, 64, 69, 55, 59, 62, 67, 53, 57, 60, 65, 55, 59, 64, 67],
    leadWave: 'triangle',
  },
  stage2: {
    bpm: 146,
    bass: [47, 47, 59, 47, 45, 45, 57, 45, 43, 43, 55, 43, 42, 42, 54, 49],
    lead: [71, 74, null, 78, 76, 74, 71, null, 69, 71, 74, 76, 74, 73, 71, 66],
    arp: [59, 62, 66, 71, 57, 60, 64, 69, 55, 59, 62, 67, 54, 58, 61, 66],
    leadWave: 'sawtooth',
  },
  stage3: {
    bpm: 154,
    bass: [40, 52, 40, 52, 41, 53, 41, 53, 43, 55, 43, 55, 46, 58, 45, 52],
    lead: [76, 77, 79, null, 81, 79, 77, 76, 74, 76, 77, 79, 77, 76, 74, 71],
    arp: [52, 56, 59, 64, 53, 57, 60, 65, 55, 59, 62, 67, 58, 61, 65, 70],
    leadWave: 'sawtooth',
  },
  boss: {
    bpm: 166,
    bass: [45, 57, 45, 57, 45, 57, 48, 60, 41, 53, 41, 53, 43, 55, 44, 56],
    lead: [81, null, 79, 77, 76, 77, 79, 81, 84, null, 83, 81, 79, 76, 77, 79],
    arp: [57, 64, 69, 72, 57, 64, 69, 72, 53, 60, 65, 69, 55, 62, 68, 71],
    leadWave: 'square',
  },
};

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.compressor = null;
    this.noiseBuffer = null;

    this.muted = false;
    this.activeVoices = 0;
    this.lastEventTime = new Map();

    this._bgmTarget = null;
    this._bgmTimer = null;
    this._bgmPlaying = false;
    this._bgmStep = 0;
    this._nextNoteTime = 0;
    this._bgmNodes = new Set();
  }

  _ensureContext() {
    if (this.ctx) return this.ctx;

    const AudioCtx =
      typeof globalThis !== 'undefined' &&
      (globalThis.AudioContext || globalThis.webkitAudioContext);
    if (!AudioCtx) return null;

    try {
      const ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;

      const masterGain = ctx.createGain();
      masterGain.gain.value = this.muted ? 0 : 0.85;

      const sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.72;

      const bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.34;

      sfxGain.connect(masterGain);
      bgmGain.connect(masterGain);
      masterGain.connect(compressor);
      compressor.connect(ctx.destination);

      this.ctx = ctx;
      this.compressor = compressor;
      this.masterGain = masterGain;
      this.sfxGain = sfxGain;
      this.bgmGain = bgmGain;
      this.noiseBuffer = this._createNoiseBuffer(ctx);
      return ctx;
    } catch {
      return null;
    }
  }

  _createNoiseBuffer(ctx) {
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  async unlock() {
    const ctx = this._ensureContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        await ctx.resume();
      }
      // Play silent 1-sample buffer for iOS Safari / mobile browser unlock
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);

      if (!this.muted && this._bgmTarget && !this._bgmPlaying) {
        this._beginBgmLoop();
      }
      return true;
    } catch {
      return false;
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    const nextMuted = Boolean(muted);
    this.muted = nextMuted;

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(nextMuted ? 0 : 0.85, now);
    }

    if (nextMuted) {
      this._haltBgmPlayback();
    } else if (this._bgmTarget && !this._bgmPlaying) {
      this._ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume?.().catch(() => {});
      }
      this._beginBgmLoop();
    }
  }

  startBgm(stage = 1, isBoss = false) {
    const normalizedStage = Number(stage) || 1;
    const bossFlag = Boolean(isBoss);

    if (
      this._bgmTarget &&
      this._bgmTarget.stage === normalizedStage &&
      this._bgmTarget.isBoss === bossFlag &&
      this._bgmPlaying
    ) {
      return;
    }

    this._bgmTarget = { stage: normalizedStage, isBoss: bossFlag };
    this._haltBgmPlayback();

    if (this.muted) return;

    this._ensureContext();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume?.().catch(() => {});
    }
    this._beginBgmLoop();
  }

  stopBgm() {
    this._bgmTarget = null;
    this._haltBgmPlayback();
  }

  _haltBgmPlayback() {
    this._bgmPlaying = false;
    if (this._bgmTimer !== null) {
      clearInterval(this._bgmTimer);
      this._bgmTimer = null;
    }
    for (const node of this._bgmNodes) {
      try {
        node.stop?.();
        node.disconnect?.();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    this._bgmNodes.clear();
  }

  _getCurrentTheme() {
    if (!this._bgmTarget) return BGM_THEMES.stage1;
    if (this._bgmTarget.isBoss) return BGM_THEMES.boss;
    const idx = ((this._bgmTarget.stage - 1) % 3) + 1;
    return BGM_THEMES[`stage${idx}`] || BGM_THEMES.stage1;
  }

  _beginBgmLoop() {
    if (!this.ctx || !this.bgmGain || this.muted || !this._bgmTarget) return;

    this._haltBgmPlayback();
    this._bgmPlaying = true;
    this._bgmStep = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.05;

    const lookaheadMs = 25;
    const scheduleAheadSec = 0.12;

    this._bgmTimer = setInterval(() => {
      if (!this._bgmPlaying || this.muted || !this.ctx) return;
      if (this.ctx.state === 'suspended') return;

      const theme = this._getCurrentTheme();
      const stepDuration = 60 / theme.bpm / 4; // 16th note

      // Prevent catch-up flood after tab backgrounding
      if (this._nextNoteTime < this.ctx.currentTime - 0.25) {
        this._nextNoteTime = this.ctx.currentTime + 0.04;
      }

      while (this._nextNoteTime < this.ctx.currentTime + scheduleAheadSec) {
        this._scheduleBgmStep(theme, this._bgmStep, this._nextNoteTime, stepDuration);
        this._nextNoteTime += stepDuration;
        this._bgmStep = (this._bgmStep + 1) % 16;
      }
    }, lookaheadMs);
  }

  _trackBgmNode(node, stopTime) {
    this._bgmNodes.add(node);
    node.onended = () => {
      this._bgmNodes.delete(node);
    };
    if (stopTime !== undefined) {
      node.stop(stopTime);
    }
  }

  _scheduleBgmStep(theme, step, time, stepDur) {
    if (!this.ctx || !this.bgmGain) return;
    const ctx = this.ctx;

    // 1. Driving Bass
    const bassMidi = theme.bass[step % theme.bass.length];
    if (bassMidi !== null) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(midiToFreq(bassMidi), time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(920, time);
      filter.frequency.exponentialRampToValueAtTime(260, time + stepDur * 0.9);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.24, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 0.92);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      this._trackBgmNode(osc, time + stepDur * 0.95);
    }

    // 2. Arpeggio shimmer
    const arpMidi = theme.arp[step % theme.arp.length];
    if (arpMidi !== null) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(arpMidi + 12), time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.095, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 0.8);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      this._trackBgmNode(osc, time + stepDur * 0.85);
    }

    // 3. Lead melody
    const leadMidi = theme.lead[step % theme.lead.length];
    if (leadMidi !== null) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = theme.leadWave || 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(leadMidi), time);

      const dur = stepDur * 1.45;
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.11, time + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      this._trackBgmNode(osc, time + dur + 0.02);
    }

    // 4. Kick on 0, 4, 8, 12 (+ extra syncopation in boss mode)
    const isKick = step % 4 === 0 || (this._bgmTarget?.isBoss && step === 14);
    if (isKick) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.09);

      gain.gain.setValueAtTime(0.32, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(time);
      this._trackBgmNode(osc, time + 0.12);
    }

    // 5. Crisp hi-hat on off-beats
    if (this.noiseBuffer && (step % 2 === 1 || this._bgmTarget?.isBoss)) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(7500, time);

      const gain = ctx.createGain();
      const amp = step % 4 === 2 ? 0.07 : 0.035;
      gain.gain.setValueAtTime(amp, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      src.connect(hp);
      hp.connect(gain);
      gain.connect(this.bgmGain);
      src.start(time);
      this._trackBgmNode(src, time + 0.04);
    }
  }

  handleEvents(events) {
    if (this.muted || !Array.isArray(events) || events.length === 0) return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev || !ev.type) continue;

      const cooldown = EVENT_COOLDOWNS_MS[ev.type] || 0;
      if (cooldown > 0) {
        const prev = this.lastEventTime.get(ev.type) || 0;
        if (nowMs - prev < cooldown) continue;
        this.lastEventTime.set(ev.type, nowMs);
      }

      if (this.activeVoices >= MAX_SFX_VOICES) continue;
      this._playEventSfx(ev);
    }
  }

  _acquireVoice(durationSec) {
    if (this.activeVoices >= MAX_SFX_VOICES) return false;
    this.activeVoices += 1;
    setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, Math.max(30, Math.ceil(durationSec * 1000)));
    return true;
  }

  _playTone({
    type = 'sine',
    freqStart = 440,
    freqEnd = 440,
    duration = 0.1,
    volume = 0.2,
    delay = 0,
  }) {
    if (!this.ctx || !this.sfxGain) return;
    if (!this._acquireVoice(duration + delay)) return;

    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    }

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  _playNoise({ duration = 0.2, volume = 0.25, filterFreq = 1200, filterType = 'bandpass', delay = 0 }) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    if (!this._acquireVoice(duration + delay)) return;

    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
    src.stop(t + duration + 0.01);
  }

  _playEventSfx(ev) {
    switch (ev.type) {
      case 'shot':
        this._playTone({
          type: 'triangle',
          freqStart: 920,
          freqEnd: 340,
          duration: 0.055,
          volume: 0.075,
        });
        break;

      case 'hit':
        this._playTone({
          type: 'square',
          freqStart: 320,
          freqEnd: 170,
          duration: 0.04,
          volume: 0.06,
        });
        break;

      case 'kill': {
        const isBoss = Boolean(ev.isBoss);
        if (isBoss) {
          this._playNoise({ duration: 0.75, volume: 0.42, filterFreq: 680, filterType: 'lowpass' });
          this._playTone({ type: 'sawtooth', freqStart: 220, freqEnd: 36, duration: 0.65, volume: 0.32 });
          this._playTone({ type: 'sine', freqStart: 520, freqEnd: 110, duration: 0.45, volume: 0.24, delay: 0.06 });
        } else {
          this._playNoise({ duration: 0.16, volume: 0.22, filterFreq: 950, filterType: 'lowpass' });
          this._playTone({ type: 'triangle', freqStart: 240, freqEnd: 65, duration: 0.14, volume: 0.18 });
        }
        break;
      }

      case 'graze':
        this._playTone({
          type: 'sine',
          freqStart: 1750,
          freqEnd: 2450,
          duration: 0.038,
          volume: 0.12,
        });
        break;

      case 'pickup': {
        const high = ev.color === 'lime' || ev.color === 'magenta';
        const base = high ? 780 : 580;
        this._playTone({ type: 'sine', freqStart: base, freqEnd: base * 1.25, duration: 0.07, volume: 0.16 });
        this._playTone({ type: 'triangle', freqStart: base * 1.5, freqEnd: base * 1.85, duration: 0.09, volume: 0.14, delay: 0.045 });
        break;
      }

      case 'playerHit':
        this._playNoise({ duration: 0.38, volume: 0.35, filterFreq: 1100, filterType: 'lowpass' });
        this._playTone({ type: 'sawtooth', freqStart: 380, freqEnd: 55, duration: 0.36, volume: 0.28 });
        break;

      case 'bomb':
        this._playTone({ type: 'sine', freqStart: 140, freqEnd: 880, duration: 0.16, volume: 0.25 });
        this._playNoise({ duration: 0.72, volume: 0.42, filterFreq: 850, filterType: 'lowpass', delay: 0.08 });
        this._playTone({ type: 'triangle', freqStart: 190, freqEnd: 35, duration: 0.65, volume: 0.34, delay: 0.08 });
        break;

      case 'warning':
        for (let i = 0; i < 2; i++) {
          const d = i * 0.28;
          this._playTone({ type: 'sawtooth', freqStart: 540, freqEnd: 780, duration: 0.14, volume: 0.2, delay: d });
          this._playTone({ type: 'sawtooth', freqStart: 780, freqEnd: 520, duration: 0.12, volume: 0.18, delay: d + 0.14 });
        }
        break;

      case 'bossPhase':
        this._playNoise({ duration: 0.35, volume: 0.28, filterFreq: 1400, filterType: 'bandpass' });
        this._playTone({ type: 'triangle', freqStart: 330, freqEnd: 660, duration: 0.28, volume: 0.22 });
        break;

      case 'stageClear':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          this._playTone({
            type: 'triangle',
            freqStart: freq,
            freqEnd: freq,
            duration: 0.18,
            volume: 0.2,
            delay: idx * 0.09,
          });
        });
        break;

      case 'victory':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
          this._playTone({
            type: 'triangle',
            freqStart: freq,
            freqEnd: freq,
            duration: idx === 4 ? 0.45 : 0.16,
            volume: 0.22,
            delay: idx * 0.1,
          });
        });
        break;

      case 'gameover':
        [392, 349.23, 311.13, 261.63].forEach((freq, idx) => {
          this._playTone({
            type: 'sawtooth',
            freqStart: freq,
            freqEnd: freq * 0.96,
            duration: 0.24,
            volume: 0.16,
            delay: idx * 0.16,
          });
        });
        break;

      default:
        break;
    }
  }
}
