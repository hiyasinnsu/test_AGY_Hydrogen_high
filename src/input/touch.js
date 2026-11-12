const KEY_MOVE_SPEED = 270; // logical px/sec for keyboard movement

export class InputController {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.stageEl
   * @param {HTMLCanvasElement} options.canvasEl
   * @param {HTMLButtonElement} options.bombBtn
   * @param {HTMLButtonElement} options.focusBtn
   * @param {number} [options.logicalWidth=360]
   * @param {number} [options.logicalHeight=640]
   * @param {number} [options.sensitivity=1.0]
   * @param {Function} [options.onUnlockAudio]
   * @param {Function} [options.onPause]
   */
  constructor({
    stageEl,
    canvasEl,
    bombBtn,
    focusBtn,
    logicalWidth = 360,
    logicalHeight = 640,
    sensitivity = 1.0,
    onUnlockAudio = null,
    onPause = null,
  }) {
    this.stageEl = stageEl;
    this.canvasEl = canvasEl;
    this.bombBtn = bombBtn;
    this.focusBtn = focusBtn;
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.sensitivity = sensitivity;
    this.onUnlockAudio = onUnlockAudio;
    this.onPause = onPause;

    this.enabled = false;
    this.pendingDeltaX = 0;
    this.pendingDeltaY = 0;
    this.bombQueued = false;

    // Touch tracking on stage (excludes dedicated buttons)
    this.stageTouches = new Map(); // touchId -> { x, y }
    this.primaryTouchId = null;

    // Dedicated focus button tracking
    this.focusTouchIds = new Set();
    this.focusMouseDown = false;

    // Mouse drag tracking on stage
    this.mouseDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.lastTouchTimestamp = 0;

    // Keyboard state
    this.keys = new Set();
    this._bombBtnFeedbackTimer = null;

    this._bindEvents();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.reset();
    }
  }

  setSensitivity(value) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      this.sensitivity = parsed;
    }
  }

  reset() {
    this.pendingDeltaX = 0;
    this.pendingDeltaY = 0;
    this.bombQueued = false;
    this.stageTouches.clear();
    this.primaryTouchId = null;
    this.focusTouchIds.clear();
    this.focusMouseDown = false;
    this.mouseDragging = false;
    this.keys.clear();
    this._updateFocusVisual();
  }

  _notifyAudioUnlock() {
    if (this.onUnlockAudio) {
      this.onUnlockAudio();
    }
  }

  _getScale() {
    const rect = this.canvasEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { scaleX: 1, scaleY: 1 };
    }
    return {
      scaleX: this.logicalWidth / rect.width,
      scaleY: this.logicalHeight / rect.height,
    };
  }

  _isRecentTouch() {
    return performance.now() - this.lastTouchTimestamp < 600;
  }

  _updateFocusVisual() {
    if (!this.focusBtn) return;
    const active =
      this.focusTouchIds.size > 0 ||
      this.focusMouseDown ||
      this.stageTouches.size >= 2;
    this.focusBtn.classList.toggle('is-active', active);
  }

  _triggerBombVisual() {
    if (!this.bombBtn) return;
    this.bombBtn.classList.add('is-active');
    if (this._bombBtnFeedbackTimer) {
      clearTimeout(this._bombBtnFeedbackTimer);
    }
    this._bombBtnFeedbackTimer = setTimeout(() => {
      this.bombBtn.classList.remove('is-active');
      this._bombBtnFeedbackTimer = null;
    }, 150);
  }

  _isOverlayOrHudTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(
      target.closest('#hud-top') ||
        target.closest('.overlay-screen') ||
        target.closest('#btn-bomb') ||
        target.closest('#btn-focus')
    );
  }

  _bindEvents() {
    // Stage touch events (relative drag anywhere on playfield)
    this._onStageTouchStart = (e) => {
      this.lastTouchTimestamp = performance.now();
      this._notifyAudioUnlock();
      if (!this.enabled) return;
      if (this._isOverlayOrHudTarget(e.target)) return;

      e.preventDefault();
      for (const t of e.changedTouches) {
        this.stageTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        if (this.primaryTouchId === null) {
          this.primaryTouchId = t.identifier;
        }
      }
      this._updateFocusVisual();
    };

    this._onStageTouchMove = (e) => {
      this.lastTouchTimestamp = performance.now();
      if (!this.enabled || this.stageTouches.size === 0) return;

      let hasTracked = false;
      const { scaleX, scaleY } = this._getScale();

      for (const t of e.changedTouches) {
        const prev = this.stageTouches.get(t.identifier);
        if (!prev) continue;
        hasTracked = true;

        if (t.identifier === this.primaryTouchId) {
          const dx = (t.clientX - prev.x) * scaleX * this.sensitivity;
          const dy = (t.clientY - prev.y) * scaleY * this.sensitivity;
          this.pendingDeltaX += dx;
          this.pendingDeltaY += dy;
        }
        prev.x = t.clientX;
        prev.y = t.clientY;
      }

      if (hasTracked) {
        e.preventDefault();
      }
    };

    this._onStageTouchEnd = (e) => {
      this.lastTouchTimestamp = performance.now();
      for (const t of e.changedTouches) {
        this.stageTouches.delete(t.identifier);
        if (t.identifier === this.primaryTouchId) {
          this.primaryTouchId = null;
        }
      }
      // Seamlessly hand off movement to another finger if still touching
      if (this.primaryTouchId === null && this.stageTouches.size > 0) {
        const firstEntry = this.stageTouches.keys().next();
        if (!firstEntry.done) {
          this.primaryTouchId = firstEntry.value;
        }
      }
      this._updateFocusVisual();
    };

    this.stageEl.addEventListener('touchstart', this._onStageTouchStart, { passive: false });
    this.stageEl.addEventListener('touchmove', this._onStageTouchMove, { passive: false });
    this.stageEl.addEventListener('touchend', this._onStageTouchEnd, { passive: false });
    this.stageEl.addEventListener('touchcancel', this._onStageTouchEnd, { passive: false });

    // Dedicated Focus button
    if (this.focusBtn) {
      this._onFocusTouchStart = (e) => {
        this.lastTouchTimestamp = performance.now();
        this._notifyAudioUnlock();
        e.stopPropagation();
        e.preventDefault();
        if (!this.enabled) return;
        for (const t of e.changedTouches) {
          this.focusTouchIds.add(t.identifier);
        }
        this._updateFocusVisual();
      };

      this._onFocusTouchEnd = (e) => {
        this.lastTouchTimestamp = performance.now();
        e.stopPropagation();
        e.preventDefault();
        for (const t of e.changedTouches) {
          this.focusTouchIds.delete(t.identifier);
        }
        this._updateFocusVisual();
      };

      this._onFocusMouseDown = (e) => {
        if (this._isRecentTouch() || e.button !== 0) return;
        this._notifyAudioUnlock();
        e.stopPropagation();
        if (!this.enabled) return;
        this.focusMouseDown = true;
        this._updateFocusVisual();
      };

      this._onFocusMouseUp = () => {
        if (this.focusMouseDown) {
          this.focusMouseDown = false;
          this._updateFocusVisual();
        }
      };

      this.focusBtn.addEventListener('touchstart', this._onFocusTouchStart, { passive: false });
      this.focusBtn.addEventListener('touchend', this._onFocusTouchEnd, { passive: false });
      this.focusBtn.addEventListener('touchcancel', this._onFocusTouchEnd, { passive: false });
      this.focusBtn.addEventListener('mousedown', this._onFocusMouseDown);
      window.addEventListener('mouseup', this._onFocusMouseUp);
    }

    // Dedicated Bomb button
    if (this.bombBtn) {
      this._onBombTouchStart = (e) => {
        this.lastTouchTimestamp = performance.now();
        this._notifyAudioUnlock();
        e.stopPropagation();
        e.preventDefault();
        if (!this.enabled) return;
        this.bombQueued = true;
        this._triggerBombVisual();
      };

      this._onBombMouseDown = (e) => {
        if (this._isRecentTouch() || e.button !== 0) return;
        this._notifyAudioUnlock();
        e.stopPropagation();
        if (!this.enabled) return;
        this.bombQueued = true;
        this._triggerBombVisual();
      };

      this.bombBtn.addEventListener('touchstart', this._onBombTouchStart, { passive: false });
      this.bombBtn.addEventListener('mousedown', this._onBombMouseDown);
    }

    // PC Mouse relative drag
    this._onMouseDown = (e) => {
      if (this._isRecentTouch() || e.button !== 0) return;
      this._notifyAudioUnlock();
      if (!this.enabled) return;
      if (this._isOverlayOrHudTarget(e.target)) return;

      this.mouseDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    this._onMouseMove = (e) => {
      if (!this.enabled || !this.mouseDragging) return;
      const { scaleX, scaleY } = this._getScale();
      this.pendingDeltaX += (e.clientX - this.lastMouseX) * scaleX * this.sensitivity;
      this.pendingDeltaY += (e.clientY - this.lastMouseY) * scaleY * this.sensitivity;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    this._onMouseUp = () => {
      this.mouseDragging = false;
    };

    this.stageEl.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);

    // PC Keyboard controls
    this._onKeyDown = (e) => {
      this._notifyAudioUnlock();
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (!e.repeat && this.onPause) {
          this.onPause();
        }
        return;
      }

      if (!this.enabled) return;

      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'Space'
      ) {
        e.preventDefault();
      }

      if ((e.code === 'KeyX' || e.code === 'Space') && !e.repeat) {
        this.bombQueued = true;
        this._triggerBombVisual();
      }

      this.keys.add(e.code);
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this._onWindowBlur = () => {
      this.reset();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onWindowBlur);
  }

  /**
   * Returns input frame for GameEngine.update(dt, input) and clears accumulated deltas.
   * @param {number} dt
   * @returns {{ moveDeltaX: number, moveDeltaY: number, focus: boolean, bomb: boolean, shoot: boolean }}
   */
  consumeInput(dt) {
    let moveDeltaX = this.pendingDeltaX;
    let moveDeltaY = this.pendingDeltaY;
    this.pendingDeltaX = 0;
    this.pendingDeltaY = 0;

    let kx = 0;
    let ky = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) kx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) kx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) ky -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) ky += 1;

    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      const step = KEY_MOVE_SPEED * dt;
      moveDeltaX += (kx / len) * step;
      moveDeltaY += (ky / len) * step;
    }

    const focus =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.focusTouchIds.size > 0 ||
      this.focusMouseDown ||
      this.stageTouches.size >= 2;

    const bomb = this.bombQueued;
    this.bombQueued = false;

    return {
      moveDeltaX,
      moveDeltaY,
      focus,
      bomb,
      shoot: true,
    };
  }
}
