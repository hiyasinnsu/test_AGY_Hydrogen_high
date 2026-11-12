import { GAME_WIDTH, GAME_HEIGHT, getPowerLevel } from './game/constants.js';
import { GameEngine } from './game/engine.js';
import { GameRenderer } from './render/renderer.js';
import { SoundEngine } from './audio/sound.js';
import { InputController } from './input/touch.js';

const STORAGE_KEY = 'starfall_neon_barrage_v1';
const SENSITIVITIES = [1, 1.25, 1.5];

function loadSavedData() {
  const defaults = {
    difficulty: 'normal',
    sensitivity: 1,
    muted: false,
    highScores: { easy: 0, normal: 0, hard: 0 },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const difficulty = ['easy', 'normal', 'hard'].includes(parsed.difficulty)
      ? parsed.difficulty
      : 'normal';
    const sensitivity = SENSITIVITIES.includes(Number(parsed.sensitivity))
      ? Number(parsed.sensitivity)
      : 1;
    const muted = Boolean(parsed.muted);
    const hs = parsed.highScores || {};
    return {
      difficulty,
      sensitivity,
      muted,
      highScores: {
        easy: Math.max(0, Number(hs.easy) || 0),
        normal: Math.max(0, Number(hs.normal) || 0),
        hard: Math.max(0, Number(hs.hard) || 0),
      },
    };
  } catch {
    return defaults;
  }
}

function persistData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota/private mode errors
  }
}

function formatScore(num) {
  return String(Math.max(0, Math.floor(num))).padStart(7, '0');
}

function formatPips(count, symbol, maxVisual = 8) {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) return '-';
  if (safeCount <= maxVisual) return symbol.repeat(safeCount);
  return `${symbol}x${safeCount}`;
}

function formatSensitivity(val) {
  return val === 1 ? '1.0x' : `${val}x`;
}

class GameApp {
  constructor() {
    this.saved = loadSavedData();
    this.screen = 'title'; // 'title' | 'playing' | 'paused' | 'result'
    this.pendingResultTimer = 0;
    this.pendingResultState = null;
    this.activeBgmKey = '';
    this.lastFrameTime = 0;

    this.hudCache = {
      score: '',
      hiscore: '',
      stage: '',
      lives: '',
      bombs: '',
      power: '',
      graze: '',
      bombEmpty: null,
    };

    this._cacheDom();
    this._initModules();
    this._bindUiEvents();
    this._syncSettingsUi();
    this._showScreen('title');

    this.renderer.resize();
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  _cacheDom() {
    this.stageEl = document.getElementById('game-stage');
    this.canvasEl = document.getElementById('game-canvas');

    this.hudTopEl = document.getElementById('hud-top');
    this.touchControlsEl = document.getElementById('touch-controls');
    this.screenTitleEl = document.getElementById('screen-title');
    this.screenPauseEl = document.getElementById('screen-pause');
    this.screenResultEl = document.getElementById('screen-result');

    this.hudScoreEl = document.getElementById('hud-score');
    this.hudHiScoreEl = document.getElementById('hud-hiscore');
    this.hudStageEl = document.getElementById('hud-stage');
    this.hudLivesEl = document.getElementById('hud-lives');
    this.hudBombsEl = document.getElementById('hud-bombs');
    this.hudPowerEl = document.getElementById('hud-power');
    this.hudGrazeEl = document.getElementById('hud-graze');

    this.btnPause = document.getElementById('btn-pause');
    this.btnFocus = document.getElementById('btn-focus');
    this.btnBomb = document.getElementById('btn-bomb');
    this.btnBombCount = document.getElementById('btn-bomb-count');

    this.titleDiffLabelEl = document.getElementById('title-diff-label');
    this.titleHiScoreEl = document.getElementById('title-hiscore');
    this.diffBtns = Array.from(document.querySelectorAll('[data-diff]'));
    this.sensBtns = Array.from(document.querySelectorAll('[data-sens]'));
    this.btnTitleSound = document.getElementById('btn-title-sound');
    this.btnStart = document.getElementById('btn-start');

    this.btnResume = document.getElementById('btn-resume');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnPauseSound = document.getElementById('btn-pause-sound');
    this.btnPauseSens = document.getElementById('btn-pause-sens');
    this.btnPauseTitle = document.getElementById('btn-pause-title');

    this.resultEyebrowEl = document.getElementById('result-eyebrow');
    this.resultTitleEl = document.getElementById('result-title');
    this.resultNewRecordEl = document.getElementById('result-new-record');
    this.resultScoreEl = document.getElementById('result-score');
    this.resultHiScoreEl = document.getElementById('result-hiscore');
    this.resultGrazeEl = document.getElementById('result-graze');
    this.resultMetaEl = document.getElementById('result-meta');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnResultTitle = document.getElementById('btn-result-title');
  }

  _initModules() {
    this.engine = new GameEngine({ difficulty: this.saved.difficulty });
    this.renderer = new GameRenderer(this.canvasEl);
    this.sound = new SoundEngine();
    this.sound.setMuted(this.saved.muted);

    this.input = new InputController({
      stageEl: this.stageEl,
      canvasEl: this.canvasEl,
      bombBtn: this.btnBomb,
      focusBtn: this.btnFocus,
      logicalWidth: GAME_WIDTH,
      logicalHeight: GAME_HEIGHT,
      sensitivity: this.saved.sensitivity,
      onUnlockAudio: () => this._unlockAudio(),
      onPause: () => this._handlePauseToggle(),
    });
  }

  _unlockAudio() {
    this.sound.unlock();
    if (this.screen === 'playing' && !this.sound.isMuted() && !this.activeBgmKey) {
      const state = this.engine.getState();
      const hasBoss = state.enemies.some((e) => e.isBoss);
      this.activeBgmKey = `${state.stage}:${hasBoss}`;
      this.sound.startBgm(state.stage, hasBoss);
    }
  }

  _bindUiEvents() {
    for (const btn of this.diffBtns) {
      btn.addEventListener('click', () => {
        this._unlockAudio();
        this.saved.difficulty = btn.dataset.diff;
        persistData(this.saved);
        this._syncSettingsUi();
      });
    }

    for (const btn of this.sensBtns) {
      btn.addEventListener('click', () => {
        this._unlockAudio();
        this.saved.sensitivity = Number(btn.dataset.sens);
        this.input.setSensitivity(this.saved.sensitivity);
        persistData(this.saved);
        this._syncSettingsUi();
      });
    }

    this.btnTitleSound.addEventListener('click', () => {
      this._toggleMute();
    });

    this.btnStart.addEventListener('click', () => {
      this._unlockAudio();
      this.startGame();
    });

    this.btnPause.addEventListener('click', () => {
      this._unlockAudio();
      if (this.screen === 'playing') {
        this.pauseGame();
      }
    });

    this.btnResume.addEventListener('click', () => {
      this._unlockAudio();
      this.resumeGame();
    });

    this.btnRestart.addEventListener('click', () => {
      this._unlockAudio();
      this.startGame();
    });

    this.btnPauseSound.addEventListener('click', () => {
      this._toggleMute();
    });

    this.btnPauseSens.addEventListener('click', () => {
      this._unlockAudio();
      const idx = SENSITIVITIES.indexOf(this.saved.sensitivity);
      const next = SENSITIVITIES[(idx + 1) % SENSITIVITIES.length];
      this.saved.sensitivity = next;
      this.input.setSensitivity(next);
      persistData(this.saved);
      this._syncSettingsUi();
    });

    this.btnPauseTitle.addEventListener('click', () => {
      this._unlockAudio();
      this.returnToTitle();
    });

    this.btnRetry.addEventListener('click', () => {
      this._unlockAudio();
      this.startGame();
    });

    this.btnResultTitle.addEventListener('click', () => {
      this._unlockAudio();
      this.returnToTitle();
    });

    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen === 'playing' && !this.pendingResultState) {
        this.pauseGame();
      }
    });
  }

  _toggleMute() {
    this._unlockAudio();
    this.saved.muted = !this.saved.muted;
    this.sound.setMuted(this.saved.muted);
    persistData(this.saved);
    this._syncSettingsUi();
    if (!this.saved.muted && this.screen === 'playing') {
      const state = this.engine.getState();
      const hasBoss = state.enemies.some((e) => e.isBoss);
      this.activeBgmKey = `${state.stage}:${hasBoss}`;
      this.sound.startBgm(state.stage, hasBoss);
    } else if (this.saved.muted) {
      this.activeBgmKey = '';
    }
  }

  _syncSettingsUi() {
    const diff = this.saved.difficulty;
    const sens = this.saved.sensitivity;
    const muted = this.saved.muted;

    for (const btn of this.diffBtns) {
      btn.classList.toggle('active', btn.dataset.diff === diff);
    }
    for (const btn of this.sensBtns) {
      btn.classList.toggle('active', Number(btn.dataset.sens) === sens);
    }

    this.titleDiffLabelEl.textContent = diff.toUpperCase();
    this.titleHiScoreEl.textContent = formatScore(this.saved.highScores[diff] || 0);

    this.btnTitleSound.textContent = muted ? 'OFF' : 'ON';
    this.btnTitleSound.setAttribute('aria-pressed', String(!muted));
    this.btnPauseSound.textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`;
    this.btnPauseSens.textContent = `SENS: ${formatSensitivity(sens)}`;
  }

  _showScreen(nextScreen) {
    this.screen = nextScreen;
    const inGame = nextScreen === 'playing' || nextScreen === 'paused';
    this.hudTopEl.classList.toggle('hidden', !inGame);
    this.touchControlsEl.classList.toggle('hidden', nextScreen !== 'playing');

    this.screenTitleEl.classList.toggle('hidden', nextScreen !== 'title');
    this.screenPauseEl.classList.toggle('hidden', nextScreen !== 'paused');
    this.screenResultEl.classList.toggle('hidden', nextScreen !== 'result');
  }

  startGame() {
    this.pendingResultTimer = 0;
    this.pendingResultState = null;
    this.hudCache.score = '';
    this.hudCache.hiscore = '';
    this.hudCache.stage = '';
    this.hudCache.lives = '';
    this.hudCache.bombs = '';
    this.hudCache.power = '';
    this.hudCache.graze = '';
    this.hudCache.bombEmpty = null;

    this.engine.reset(this.saved.difficulty);
    this.engine.setPaused(false);
    this.renderer.reset();
    this.renderer.resize();
    this.input.reset();
    this.input.setEnabled(true);

    this._showScreen('playing');

    const state = this.engine.getState();
    this._updateHud(state);

    this.activeBgmKey = `${state.stage}:false`;
    if (!this.sound.isMuted()) {
      this.sound.startBgm(state.stage, false);
    }
  }

  pauseGame() {
    if (this.screen !== 'playing' || this.pendingResultState) return;
    this.engine.setPaused(true);
    this.input.setEnabled(false);
    this.sound.stopBgm();
    this.activeBgmKey = '';
    this._showScreen('paused');
  }

  resumeGame() {
    if (this.screen !== 'paused') return;
    this.engine.setPaused(false);
    this.input.reset();
    this.input.setEnabled(true);
    this._showScreen('playing');

    const state = this.engine.getState();
    const hasBoss = state.enemies.some((e) => e.isBoss);
    this.activeBgmKey = `${state.stage}:${hasBoss}`;
    if (!this.sound.isMuted()) {
      this.sound.startBgm(state.stage, hasBoss);
    }
  }

  returnToTitle() {
    this.pendingResultTimer = 0;
    this.pendingResultState = null;
    this.engine.setPaused(false);
    this.engine.reset(this.saved.difficulty);
    this.renderer.reset();
    this.input.setEnabled(false);
    this.sound.stopBgm();
    this.activeBgmKey = '';
    this._syncSettingsUi();
    this._showScreen('title');
  }

  _handlePauseToggle() {
    if (this.screen === 'playing' && !this.pendingResultState) {
      this.pauseGame();
    } else if (this.screen === 'paused') {
      this.resumeGame();
    }
  }

  _finishRun(state) {
    this.input.setEnabled(false);
    this.sound.stopBgm();
    this.activeBgmKey = '';

    const diff = state.difficulty || this.saved.difficulty;
    const prevHi = this.saved.highScores[diff] || 0;
    const isNewRecord = state.score > prevHi;
    if (isNewRecord) {
      this.saved.highScores[diff] = Math.floor(state.score);
      persistData(this.saved);
      this._syncSettingsUi();
    }

    const best = Math.max(prevHi, Math.floor(state.score));
    const isVictory = state.phase === 'victory';

    this.resultEyebrowEl.textContent = isVictory ? 'ALL STAGES CLEARED' : 'SIGNAL LOST';
    this.resultTitleEl.textContent = isVictory ? 'VICTORY!' : 'GAME OVER';
    this.resultTitleEl.classList.toggle('is-victory', isVictory);
    this.resultTitleEl.classList.toggle('is-gameover', !isVictory);
    this.resultNewRecordEl.classList.toggle('hidden', !isNewRecord);

    this.resultScoreEl.textContent = formatScore(state.score);
    this.resultHiScoreEl.textContent = formatScore(best);
    this.resultGrazeEl.textContent = String(Math.floor(state.graze));
    this.resultMetaEl.textContent = `ST.${state.stage} / ${diff.toUpperCase()}`;

    this._showScreen('result');
  }

  _updateHud(state) {
    const scoreStr = formatScore(state.score);
    if (scoreStr !== this.hudCache.score) {
      this.hudCache.score = scoreStr;
      this.hudScoreEl.textContent = scoreStr;
    }

    const diff = state.difficulty || this.saved.difficulty;
    const liveHi = Math.max(this.saved.highScores[diff] || 0, Math.floor(state.score));
    const hiStr = `HI ${formatScore(liveHi)}`;
    if (hiStr !== this.hudCache.hiscore) {
      this.hudCache.hiscore = hiStr;
      this.hudHiScoreEl.textContent = hiStr;
    }

    const stageStr = String(state.stage);
    if (stageStr !== this.hudCache.stage) {
      this.hudCache.stage = stageStr;
      this.hudStageEl.textContent = stageStr;
    }

    const livesStr = formatPips(state.player.lives, '♦');
    if (livesStr !== this.hudCache.lives) {
      this.hudCache.lives = livesStr;
      this.hudLivesEl.textContent = livesStr;
    }

    const bombsCount = Math.max(0, Math.floor(state.player.bombs));
    const bombsStr = formatPips(bombsCount, '★');
    if (bombsStr !== this.hudCache.bombs) {
      this.hudCache.bombs = bombsStr;
      this.hudBombsEl.textContent = bombsStr;
      this.btnBombCount.textContent = `x${bombsCount}`;
    }

    const bombEmpty = bombsCount === 0;
    if (bombEmpty !== this.hudCache.bombEmpty) {
      this.hudCache.bombEmpty = bombEmpty;
      this.btnBomb.classList.toggle('is-empty', bombEmpty);
    }

    const powerStr = `LV${getPowerLevel(state.power)} (${Math.floor(state.power)})`;
    if (powerStr !== this.hudCache.power) {
      this.hudCache.power = powerStr;
      this.hudPowerEl.textContent = powerStr;
    }

    const grazeStr = String(Math.floor(state.graze));
    if (grazeStr !== this.hudCache.graze) {
      this.hudCache.graze = grazeStr;
      this.hudGrazeEl.textContent = grazeStr;
    }
  }

  _loop(now) {
    const dt = Math.min(Math.max((now - this.lastFrameTime) / 1000, 0), 0.05);
    this.lastFrameTime = now;

    if (this.screen === 'playing') {
      if (this.pendingResultState) {
        this.pendingResultTimer -= dt;
        this.engine.update(dt, { moveDeltaX: 0, moveDeltaY: 0, focus: false, bomb: false, shoot: false });
        const state = this.engine.getState();
        this.renderer.render(state, dt);
        if (this.pendingResultTimer <= 0) {
          const finalState = this.pendingResultState;
          this.pendingResultState = null;
          this._finishRun(finalState);
        }
      } else {
        const input = this.input.consumeInput(dt);
        this.engine.update(dt, input);
        const state = this.engine.getState();

        if (state.events && state.events.length > 0) {
          this.sound.handleEvents(state.events);
        }

        const hasBoss = state.enemies.some((e) => e.isBoss);
        const bgmKey = `${state.stage}:${hasBoss}`;
        if (
          state.phase !== 'gameover' &&
          state.phase !== 'victory' &&
          bgmKey !== this.activeBgmKey
        ) {
          this.activeBgmKey = bgmKey;
          if (!this.sound.isMuted()) {
            this.sound.startBgm(state.stage, hasBoss);
          }
        }

        this.renderer.render(state, dt);
        this._updateHud(state);

        if (state.phase === 'gameover' || state.phase === 'victory') {
          this.input.setEnabled(false);
          this.sound.stopBgm();
          this.activeBgmKey = '';
          this.pendingResultState = state;
          this.pendingResultTimer = 0.65;
        }
      }
    } else if (this.screen === 'paused') {
      const state = this.engine.getState();
      this.renderer.render(state, 0);
    } else if (this.screen === 'title') {
      // Render parallax starfield background behind title panel
      this.renderer.render(null, dt);
    }

    requestAnimationFrame((t) => this._loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
