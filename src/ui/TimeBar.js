// ui/TimeBar.js
// Self-contained time bar overlay that anchors to the PlayArea.

export default class TimeBar {
  constructor({ gameCanvas, playArea, bus, getMiniTimerColor }) {
    this.gameCanvas = gameCanvas;
    this.playArea = playArea;
    this.bus = bus || { on: () => {}, emit: () => {} };
    this.getMiniTimerColor =
      typeof getMiniTimerColor === 'function' ? getMiniTimerColor : () => '#ffffff';

    this.canvas = null;
    this.ctx = null;
    this.visible = false;

    this._onResize = this.updatePosition.bind(this);
  }

  mount() {
    if (this.canvas) return this.canvas;

    const c = document.createElement('canvas');
    c.id = 'timeBarCanvas';
    c.style.position = 'absolute';
    c.style.zIndex = '10';
    c.style.opacity = '0';
    c.style.transition = 'opacity 0.6s ease-in-out';
    c.style.pointerEvents = 'none';
    c.style.display = 'none';
    document.body.appendChild(c);

    this.canvas = c;
    this.ctx = c.getContext('2d');

    this.canvas.width = window.playAreaSize;
    this.canvas.height = 10;

    this.updatePosition();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('scroll', this._onResize, { passive: true });

    return this.canvas;
  }

  attachToPlayArea(playArea) {
    this.playArea = playArea || this.playArea;
    this.setWidthByPlayArea();
    this.updatePosition();
  }

  unmount() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('scroll', this._onResize);
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null;
    this.ctx = null;
  }

  updatePosition() {
    if (!this.canvas) return;
    this.canvas.width = window.playAreaSize;
    const rect = this.gameCanvas.getBoundingClientRect();
    this.canvas.style.left = rect.left + window.playAreaX + 'px';
    this.canvas.style.top = rect.top + window.playAreaY - 20 + 'px';
  }

  setWidthByPlayArea() {
    if (!this.canvas) return;
    this.canvas.width = window.playAreaSize;
    this.updatePosition();
  }

  show() {
    if (!this.canvas) this.mount();
    if (this.visible) return;
    this.updatePosition();
    this.canvas.style.display = 'block';
    requestAnimationFrame(() => {
      this.canvas.style.opacity = '1';
      this.visible = true;
    });
  }

  hide() {
    if (!this.canvas) return;
    this.canvas.style.opacity = '0';
    this.visible = false;
    setTimeout(() => {
      if (!this.visible) this.canvas.style.display = 'none';
    }, 600);
  }

  isVisible() {
    return this.visible;
  }

  draw({ remaining, duration, color }) {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const visualBuffer = 0.25;
    const rem = Math.max(0, remaining);
    const rawPct = rem > duration - visualBuffer ? (rem + visualBuffer) / duration : rem / duration;
    const pct = Math.max(0, Math.min(1, rawPct));

    const r = Math.min(4, h / 2);
    const rr = (x, y, w2, h2, rad) => {
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w2, h2, rad);
      } else {
        const rad2 = Math.max(0, Math.min(rad, Math.min(w2, h2) / 2));
        ctx.moveTo(x + rad2, y);
        ctx.arcTo(x + w2, y, x + w2, y + h2, rad2);
        ctx.arcTo(x + w2, y + h2, x, y + h2, rad2);
        ctx.arcTo(x, y + h2, x, y, rad2);
        ctx.arcTo(x, y, x + w2, y, rad2);
      }
    };

    // Fill
    const fillW = Math.max(0, w * pct);
    if (fillW > 0.001) {
      ctx.save();
      ctx.fillStyle = color || '#ffffff';
      ctx.beginPath();
      rr(0, 0, fillW, h, Math.min(r, fillW / 2));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Outline
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    rr(0.5, 0.5, w - 1, h - 1, Math.max(0, r - 0.5));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * One call per frame from main loop.
   * mode: 'mini' | 'objective' | 'hidden'
   */
  updateFrame({ mode, remaining, duration, color }) {
    if (mode === 'hidden') {
      if (this.isVisible()) this.hide();
      return;
    }
    this.show();
    const tint = mode === 'mini' ? this.getMiniTimerColor?.() || color : color;
    this.draw({ remaining, duration, color: tint || '#ffffff' });
  }
}
