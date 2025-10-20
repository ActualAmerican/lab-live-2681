// src/ui/Scoreboard.js
export default class Scoreboard {
  constructor({ gameCanvas, bus, getPlayAreaMetrics }) {
    this.gameCanvas = gameCanvas;
    this.bus = bus;
    this.getPlayAreaMetrics = getPlayAreaMetrics; // () => { rightEdge, top, playAreaSize }

    // DPR/formatting
    this.DPR = Math.max(1, window.devicePixelRatio || 1);
    this.FMT = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // canvases
    this.cssW = 300; // clamped later by playAreaSize
    this.cssH = 50;
    this.popupCssW = this.cssW;
    this.popupCssH = 72;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'scoreboardCanvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.zIndex = '12';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.opacity = '0';
    this.canvas.style.transition = 'opacity 0.5s ease-in-out';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d', { alpha: true });

    this.popup = document.createElement('canvas');
    this.popup.id = 'scorePopupCanvas';
    this.popup.style.position = 'absolute';
    this.popup.style.zIndex = '13';
    this.popup.style.pointerEvents = 'none';
    this.popup.style.opacity = '0';
    this.popup.style.transition = 'opacity 0.5s ease-in-out';
    document.body.appendChild(this.popup);

    this.popupCtx = this.popup.getContext('2d', { alpha: true });

    // internal state
    this.activeGetter = () => true;
    this.scoreGetter = () => 0;
    this.bestGetter = () => 0;
    this.resolveShapeColor = () => '#FFFFFF';
    this.lastShapeColor = '#FFFFFF';

    // typewriter state
    this.TYPE = {
      running: false,
      t0: 0,
      perChar: 110,
      numPerChar: 95,
      stagger: 180,
      numDelay: 160,
      scoreChars: 0,
      bestChars: 0,
      scoreNumChars: 0,
      bestNumChars: 0,
    };
    this.POP = {
      scoreLblIdx: -1,
      scoreLblT: 0,
      bestLblIdx: -1,
      bestLblT: 0,
      scoreNumIdx: -1,
      scoreNumT: 0,
      bestNumIdx: -1,
      bestNumT: 0,
    };
    this.POP_MS = 260;

    // smoothed numbers
    this.displayedScore = 0;
    this.displayedBest = 0;
    this.lastScoreTick = 0;
    this.SCORE_TICK_MS = 50;
    this.SCORE_EASE = 0.35;

    // popups
    this.SCORE_POPUP_LIFE_MS = 1200;
    this.SCORE_POPUP_RISE_PX = 24;
    this.SCORE_POPUP_MIN = 5;
    this.popups = [];

    // size & layout
    this._applyDimensions();
    this.updatePosition();

    // keep in sync with window changes
    window.addEventListener('resize', () => {
      this.DPR = Math.max(1, window.devicePixelRatio || 1);
      this._applyDimensions();
      this.updatePosition();
    });
    window.addEventListener('scroll', () => this.updatePosition(), { passive: true });

    // keep a fresh “last shape color” for popups
    if (this.bus) {
      this.bus.on?.('shape:complete', ({ name }) => {
        try {
          const c = this.resolveShapeColor?.(name) || '#FFFFFF';
          this.lastShapeColor = this._ensureVisible(c);
        } catch {
          /* noop */
        }
      });
    }
  }

  // ---- public API -----------------------------------------------------------
  setGetters({ getScore, getBestScore, getActive }) {
    if (getScore) this.scoreGetter = getScore;
    if (getBestScore) this.bestGetter = getBestScore;
    if (getActive) this.activeGetter = getActive;
  }
  setColorResolver(fn) {
    this.resolveShapeColor = fn;
  }

  setWidthByPlayArea(playAreaSize) {
    const target = Math.max(300, Math.min(playAreaSize || 300, playAreaSize || 300));
    this.cssW = target;
    this.popupCssW = target;
    this._applyDimensions();
    this.updatePosition();
  }

  updatePosition() {
    const rect = this.gameCanvas.getBoundingClientRect();
    const { rightEdge, top } = this.getPlayAreaMetrics();
    // right align to play area edge; place 80px above canvas top (matches original)
    this.canvas.style.left = Math.round(rightEdge - this.cssW) + 'px';
    this.canvas.style.top = Math.round(top) + 'px';
    // popup: same left; try to sit above scoreboard (never off-screen)
    const sb = this.canvas.getBoundingClientRect();
    this.popup.style.left = sb.left + 'px';
    const desiredTop = sb.top - this.popupCssH;
    this.popup.style.top = Math.max(0, desiredTop) + 'px';
  }

  show({ armOnly = false } = {}) {
    this.canvas.style.display = 'block';
    this.popup.style.display = 'block';
    this.updatePosition();
    if (armOnly) {
      this.canvas.style.opacity = '0';
      this.popup.style.opacity = '0';
      return;
    }
    this.canvas.style.opacity = '1';
    this.popup.style.opacity = '1';
  }
  hide() {
    this.canvas.style.opacity = '0';
    this.popup.style.opacity = '0';
    setTimeout(() => {
      this.canvas.style.display = 'none';
      this.popup.style.display = 'none';
    }, 500);
  }
  fadeIn(ms = 500) {
    this.canvas.style.display = 'block';
    this.popup.style.display = 'block';
    this.canvas.style.transition = `opacity ${ms}ms cubic-bezier(.22,.61,.36,1)`;
    this.popup.style.transition = `opacity ${ms}ms cubic-bezier(.22,.61,.36,1)`;
    this.updatePosition();
    requestAnimationFrame(() => this.updatePosition());
    this.canvas.style.opacity = '1';
    this.popup.style.opacity = '1';
  }
  fadeOut(ms = 500) {
    this.canvas.style.transition = `opacity ${ms}ms cubic-bezier(.22,.61,.36,1)`;
    this.popup.style.transition = `opacity ${ms}ms cubic-bezier(.22,.61,.36,1)`;
    this.canvas.style.opacity = '0';
    this.popup.style.opacity = '0';
  }

  startTypewriter() {
    this.TYPE.running = true;
    this.TYPE.t0 = performance.now();
    this.TYPE.scoreChars = this.TYPE.bestChars = 0;
    this.TYPE.scoreNumChars = this.TYPE.bestNumChars = 0;
  }
  resetTypewriter() {
    this.TYPE.running = false;
    this.TYPE.t0 = 0;
    this.TYPE.scoreChars = this.TYPE.bestChars = 0;
    this.TYPE.scoreNumChars = this.TYPE.bestNumChars = 0;
  }

  drain() {
    try {
      this.ctx.clearRect(0, 0, this.cssW, this.cssH);
    } catch {}
    try {
      this.popupCtx.clearRect(0, 0, this.popupCssW, this.popupCssH);
    } catch {}
    this.canvas.style.opacity = '0';
    this.canvas.style.display = 'none';
    this.popup.style.opacity = '0';
    this.popup.style.display = 'none';
    this.popups.length = 0;
  }

  spawnPopup(delta, info = {}) {
    if (!Number.isFinite(delta)) return;
    if (Math.abs(delta) < this.SCORE_POPUP_MIN) return;

    const reason = info.reason || 'default';
    let color = '#FFFFFF';
    if (reason === 'shape:clear') {
      color =
        info.color ||
        info.shapeColor ||
        (info.name ? this.resolveShapeColor?.(info.name) : null) ||
        this.lastShapeColor ||
        '#FFFFFF';
    } else if (reason === 'minigame:win' || reason === 'infinite:cycle') {
      color = this._randomBrightColor();
    } else {
      color = '#FFFFFF';
    }
    color = this._ensureVisible(color);

    this.popups.push({
      born: performance.now(),
      life: this.SCORE_POPUP_LIFE_MS,
      amount: delta,
      color,
    });

    if (this.popup.style.display !== 'block') {
      this.popup.style.display = 'block';
      this.popup.style.opacity = '1';
    }
  }

  draw() {
    // text numbers ease/throttle
    const now = performance.now();
    const score = +this.scoreGetter();
    const best = +this.bestGetter();

    if (now - this.lastScoreTick >= this.SCORE_TICK_MS) {
      this.displayedScore += (score - this.displayedScore) * this.SCORE_EASE;
      this.displayedBest += (best - this.displayedBest) * this.SCORE_EASE;
      this.displayedScore = Math.round(this.displayedScore * 100) / 100;
      this.displayedBest = Math.round(this.displayedBest * 100) / 100;
      this.lastScoreTick = now;
    }

    this.ctx.clearRect(0, 0, this.cssW, this.cssH);
    if (!this.activeGetter()) {
      this._drawPopups();
      return;
    }

    // labels + typewriter
    let scoreLabel = 'Score:';
    let bestLabel = 'Best:';
    if (this.TYPE.running) {
      const tNow = performance.now() - this.TYPE.t0;
      this.TYPE.scoreChars = this._smoothCount(tNow, this.TYPE.perChar, scoreLabel.length, 0);
      this.TYPE.bestChars = this._smoothCount(
        tNow,
        this.TYPE.perChar,
        bestLabel.length,
        this.TYPE.stagger
      );

      // pop-indices
      const np = performance.now();
      const sIdx = this.TYPE.scoreChars - 1;
      if (sIdx >= 0 && sIdx !== this.POP.scoreLblIdx) {
        this.POP.scoreLblIdx = sIdx;
        this.POP.scoreLblT = np;
      }
      const bIdx = this.TYPE.bestChars - 1;
      if (bIdx >= 0 && bIdx !== this.POP.bestLblIdx) {
        this.POP.bestLblIdx = bIdx;
        this.POP.bestLblT = np;
      }

      scoreLabel = scoreLabel.slice(0, this.TYPE.scoreChars);
      bestLabel = bestLabel.slice(0, this.TYPE.bestChars);
    }

    const rightX = this.cssW - 1;
    const gap = 8;

    // SCORE line
    const beatingBest = score > best;
    const pulse = beatingBest ? 1 + 0.06 * Math.sin(now * 0.008) : 1;

    this.ctx.textBaseline = 'alphabetic';
    this.ctx.font = '700 24px Orbitron';
    let scoreStr = this.FMT.format(this.displayedScore);

    if (this.TYPE.running) {
      const tNow = performance.now() - this.TYPE.t0;
      this.TYPE.scoreNumChars = this._smoothCount(
        tNow,
        this.TYPE.numPerChar,
        scoreStr.length,
        this.TYPE.numDelay
      );
      scoreStr = scoreStr.slice(0, this.TYPE.scoreNumChars);
    }

    const numRightX = rightX;
    const numY = 30;
    const numColor = beatingBest ? `hsl(${(now / 10) % 360}, 100%, 70%)` : 'white';

    this.ctx.save();
    this.ctx.translate(numRightX, numY);
    this.ctx.scale(pulse, pulse);
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = numColor;

    // pop newest number char
    const popAgeNum = performance.now() - this.POP.scoreNumT;
    if (
      this.TYPE.running &&
      this.TYPE.scoreNumChars - 1 === this.POP.scoreNumIdx &&
      popAgeNum <= this.POP_MS &&
      scoreStr.length > 0
    ) {
      const prefix = scoreStr.slice(0, -1);
      const active = scoreStr.slice(-1);
      const pfxW = this.ctx.measureText(prefix).width;
      const aw = this.ctx.measureText(active).width;
      this.ctx.fillText(prefix, 0, 0);
      this.ctx.save();
      const kNum = pulse || 1;
      const xLeft = -pfxW / kNum;
      this.ctx.translate(xLeft, 0);
      this.ctx.translate(aw / 2 / kNum, 0);
      this.ctx.scale(
        this._popScale01(popAgeNum / this.POP_MS),
        this._popScale01(popAgeNum / this.POP_MS)
      );
      this.ctx.textAlign = 'center';
      this.ctx.fillText(active, 0, 0);
      this.ctx.restore();
    } else {
      this.ctx.fillText(scoreStr, 0, 0);
    }
    this.ctx.restore();

    // SCORE label
    const baseNumW = this.ctx.measureText(scoreStr).width;
    const scoreLabelRight = numRightX - baseNumW * pulse - gap;
    const labelColor = beatingBest ? `hsl(${(now / 10) % 360}, 100%, 70%)` : 'white';
    const labelPulse = beatingBest ? 1 + 0.03 * Math.sin(now * 0.008) : 1;

    this.ctx.font = '700 24px Orbitron';
    this.ctx.save();
    this.ctx.translate(scoreLabelRight, numY);
    this.ctx.scale(labelPulse, labelPulse);
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = labelColor;

    const lblPopAge = performance.now() - this.POP.scoreLblT;
    if (
      this.TYPE.running &&
      this.TYPE.scoreChars - 1 === this.POP.scoreLblIdx &&
      lblPopAge <= this.POP_MS &&
      scoreLabel.length > 0
    ) {
      const prefix = scoreLabel.slice(0, -1);
      const active = scoreLabel.slice(-1);
      const pfxW = this.ctx.measureText(prefix).width;
      const aw = this.ctx.measureText(active).width;
      this.ctx.fillText(prefix, 0, 0);
      const s = this._popScale01(lblPopAge / this.POP_MS);
      this.ctx.save();
      const kLbl = labelPulse || 1;
      const xLeft = -pfxW / kLbl;
      this.ctx.translate(xLeft, 0);
      this.ctx.translate(aw / 2 / kLbl, 0);
      this.ctx.scale(s, s);
      this.ctx.textAlign = 'center';
      this.ctx.fillText(active, 0, 0);
      this.ctx.restore();
    } else {
      this.ctx.fillText(scoreLabel, 0, 0);
    }
    this.ctx.restore();

    // BEST line
    this.ctx.font = '700 16px Orbitron';
    let bestStr = this.FMT.format(this.displayedBest);
    if (this.TYPE.running) {
      const tNow = performance.now() - this.TYPE.t0 - this.TYPE.stagger;
      this.TYPE.bestNumChars = this._smoothCount(
        tNow,
        this.TYPE.numPerChar,
        bestStr.length,
        this.TYPE.numDelay
      );
      bestStr = bestStr.slice(0, this.TYPE.bestNumChars);

      // stop when all revealed
      if (
        this.TYPE.scoreChars >= 6 &&
        this.TYPE.bestChars >= 5 &&
        this.TYPE.scoreNumChars >= this.FMT.format(this.displayedScore).length &&
        this.TYPE.bestNumChars >= this.FMT.format(this.displayedBest).length
      ) {
        this.TYPE.running = false;
      }
    }

    const bestRightX = rightX;
    const bestY = 50;
    const bestNumW = this.ctx.measureText(bestStr).width;

    this.ctx.save();
    this.ctx.translate(bestRightX, bestY);
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = 'rgba(255,255,255,0.7)';

    const bestPopAge = performance.now() - this.POP.bestNumT;
    if (
      this.TYPE.running &&
      this.TYPE.bestNumChars - 1 === this.POP.bestNumIdx &&
      bestPopAge <= this.POP_MS &&
      bestStr.length > 0
    ) {
      const prefix = bestStr.slice(0, -1);
      const active = bestStr.slice(-1);
      const pfxW = this.ctx.measureText(prefix).width;
      const aw = this.ctx.measureText(active).width;
      this.ctx.fillText(prefix, 0, 0);
      const s = this._popScale01(bestPopAge / this.POP_MS);
      this.ctx.save();
      const xLeft = -pfxW;
      this.ctx.translate(xLeft, 0);
      this.ctx.translate(aw / 2, 0);
      this.ctx.scale(s, s);
      this.ctx.textAlign = 'center';
      this.ctx.fillText(active, 0, 0);
      this.ctx.restore();
    } else {
      this.ctx.fillText(bestStr, 0, 0);
    }
    this.ctx.restore();

    // BEST label
    const bestLabelRight = bestRightX - bestNumW - gap;
    this.ctx.font = '700 16px Orbitron';
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = 'rgba(255,255,255,0.7)';

    const bestLblPopAge = performance.now() - this.POP.bestLblT;
    if (
      this.TYPE.running &&
      this.TYPE.bestChars - 1 === this.POP.bestLblIdx &&
      bestLblPopAge <= this.POP_MS &&
      bestLabel.length > 0
    ) {
      const prefix = bestLabel.slice(0, -1);
      const active = bestLabel.slice(-1);
      const pfxW = this.ctx.measureText(prefix).width;
      const aw = this.ctx.measureText(active).width;
      this.ctx.fillText(prefix, bestLabelRight, bestY);
      this.ctx.save();
      this.ctx.translate(bestLabelRight - pfxW - aw / 2, bestY);
      this.ctx.scale(
        this._popScale01(bestLblPopAge / this.POP_MS),
        this._popScale01(bestLblPopAge / this.POP_MS)
      );
      this.ctx.textAlign = 'center';
      this.ctx.fillText(active, 0, 0);
      this.ctx.restore();
    } else {
      this.ctx.fillText(bestLabel, bestLabelRight, bestY);
    }

    this._drawPopups();
  }

  // ---- internals ------------------------------------------------------------
  _applyDimensions() {
    // scoreboard
    this.canvas.width = Math.round(this.cssW * this.DPR);
    this.canvas.height = Math.round(this.cssH * this.DPR);
    this.canvas.style.width = this.cssW + 'px';
    this.canvas.style.height = this.cssH + 'px';
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

    // popup
    this.popup.width = Math.round(this.popupCssW * this.DPR);
    this.popup.height = Math.round(this.popupCssH * this.DPR);
    this.popup.style.width = this.popupCssW + 'px';
    this.popup.style.height = this.popupCssH + 'px';
    this.popupCtx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
  }

  _drawPopups() {
    this.popupCtx.clearRect(0, 0, this.popupCssW, this.popupCssH);
    if (!this.popups.length) return;

    const now = performance.now();
    const rightX = this.popupCssW - 1;
    const baseY = this.popupCssH - 6;
    const maxRise = this.SCORE_POPUP_RISE_PX;
    const topPad = 6;
    this.popupCtx.textBaseline = 'alphabetic';

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      const t = Math.min(1, (now - p.born) / p.life);
      const ease = 1 - Math.pow(1 - t, 2.6);
      const y = Math.max(topPad, baseY - ease * maxRise);
      const alpha = 1 - Math.pow(ease, 2.2);
      const text = (p.amount >= 0 ? '+' : '') + Math.round(p.amount);

      this.popupCtx.save();
      this.popupCtx.globalAlpha = alpha;
      this.popupCtx.textAlign = 'right';
      this.popupCtx.font = '700 22px Orbitron';

      // subtle shadow + outline
      this.popupCtx.shadowColor = 'rgba(0,0,0,0.85)';
      this.popupCtx.shadowBlur = 6;
      this.popupCtx.shadowOffsetX = 0;
      this.popupCtx.shadowOffsetY = 1;

      this.popupCtx.lineWidth = 2;
      this.popupCtx.strokeStyle = 'rgba(0,0,0,0.35)';

      this.popupCtx.fillStyle = p.color || '#FFFFFF';
      this.popupCtx.strokeText(text, rightX, y);
      this.popupCtx.fillText(text, rightX, y);
      this.popupCtx.restore();

      if (t >= 1) this.popups.splice(i, 1);
    }
  }

  _smoothCount(elapsedMs, perCharMs, totalChars, delayMs = 0) {
    const t = Math.max(0, elapsedMs - delayMs);
    const total = Math.max(1, perCharMs * totalChars);
    let p = Math.max(0, Math.min(1, t / total));
    p = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    return Math.floor(p * totalChars + 1e-6);
  }
  _popScale01(t) {
    t = Math.max(0, Math.min(1, t));
    if (t < 0.6) {
      const p = t / 0.6;
      return 0.7 + 0.38 * (1 - Math.pow(1 - p, 3));
    } else {
      const p = (t - 0.6) / 0.4;
      return 1.08 - 0.08 * (p * p);
    }
  }
  _randomBrightColor() {
    const h = Math.floor(Math.random() * 360);
    return `hsl(${h}, 100%, 65%)`;
  }
  _ensureVisible(color) {
    const c = (color || '').toLowerCase().trim();
    if (c === '#000000' || c === '#000') return '#262626';
    return color || '#FFFFFF';
  }
}
