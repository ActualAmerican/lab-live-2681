// ============================================================================
// Shape: SnowFlake  |  src/shapes/SnowFlake.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    0. Utility Functions (easing, Bézier)
//    1. Initialization
//    2. Intro Animation Helpers
//    3. Drawing Functions
//    4. Gameplay Logic (placeholder)
//    5. Scoring & Feedback (placeholder)
//    6. Skins & Effects (stub)
//    7. Debugging Tools (stub)
//    8. Structural Requirements
// ============================================================================

import { Shape } from './Shape.js';

// ---------------------------------------------------------------------------
// 0. Utility Functions
// ---------------------------------------------------------------------------
function easeInOut(t) { return (1 - Math.cos(Math.PI * t)) / 2; }
function cubicBezier2D(p0, p1, p2, p3, t) {
  const u = 1 - t, uu = u * u, uuu = uu * u, tt = t * t, ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  };
}

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class SnowFlake extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Snowflake') {
    super(x, y, size, '#7ad9ffff');
    this.name = name;

    // Intro timing (ms)
    this.playIntro               = true;
    this.introTimer              = 0;
    this.fadeInTime              = 1200;
    this.introDelay              = 180;
    this.personalAffectDuration  = 2600;
    this.glintDuration           = 400;
    this.introDuration           = this.introDelay + this.personalAffectDuration + this.glintDuration;

    // Path fractions
    this.arcPct     = 0.40;          // backward C‑arc
    this.descentPct = 1 - this.arcPct; // zig‑zag descent

    this.glintLength = this.size * 0.3;
    this.startX = x;
    this.startY = y;
    this.isReadyToPlay = false;
    this.sequenceCompleted = false;

  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers
  // -------------------------------------------------------------------------
  /** Compute positional offset along intro path. */
  getIntroPos(tNorm, moveDist) {
    const t = Math.min(Math.max(tNorm, 0), 1);

    // ---- Backward C‑arc ----
    if (t <= this.arcPct) {
      const tt = easeInOut(t / this.arcPct);
      const p0 = { x: 0,           y: 0 };
      const p1 = { x:  moveDist,   y: 0 };
      const p2 = { x:  moveDist,   y: -moveDist * 0.85 };
      const p3 = { x: 0,           y: -moveDist * 0.85 };
      return cubicBezier2D(p0, p1, p2, p3, tt);
    }

    // ---- Zig‑zag descent ----
    const tt    = easeInOut((t - this.arcPct) / this.descentPct);
    const start = this.getIntroPos(this.arcPct, moveDist);

    // vertical drop
    const oy = start.y * (1 - tt);

    // tighter & slower zig‑zag
    const waveCount = 4;                   // fewer cycles ⇒ slower
    const maxAmp    = moveDist * 0.15;     // tighter (smaller amplitude)
    const amp       = maxAmp * (1 - tt);   // taper
    const ox        = amp * Math.sin(tt * waveCount * Math.PI);
    return { x: start.x + ox, y: oy };
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();
    if (this.playIntro) ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);

    let tx = this.x, ty = this.y;
    if (this.playIntro && this.introTimer > this.introDelay && this.introTimer < this.introDelay + this.personalAffectDuration) {
      const tNorm   = (this.introTimer - this.introDelay) / this.personalAffectDuration;
      const moveDist= (window.playAreaSize ?? 600) / 2 - this.size;
      const { x: ox, y: oy } = this.getIntroPos(tNorm, moveDist);
      tx = this.startX + ox;
      ty = this.startY + oy;
    }

    ctx.translate(tx, ty);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = this.size * 0.1;
    ctx.lineCap     = 'round';
    this._drawBranches(ctx);

    const glintStart = this.introDelay + this.personalAffectDuration;
    if (this.playIntro && this.introTimer >= glintStart && this.introTimer < glintStart + this.glintDuration) {
      const tt = (this.introTimer - glintStart) / this.glintDuration;
      const totalW = this.size * 2 + this.glintLength * 2;
      const gx = -this.size - this.glintLength + totalW * tt;
      const grad = ctx.createLinearGradient(gx - this.glintLength, 0, gx + this.glintLength, 0);
      grad.addColorStop(0,   'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth   = this.size * 0.15;
      this._drawBranches(ctx);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (!this.playIntro) return;
    this.introTimer += deltaTime;
    if (this.introTimer >= this.introDuration) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}
  }

  // -------------------------------------------------------------------------
  // Helper: draw branches
  // -------------------------------------------------------------------------
  _drawBranches(ctx) {
    ctx.beginPath();
    const count = 6, sl = this.size * 0.3;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * 2 * Math.PI;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * this.size, Math.sin(ang) * this.size);
      const mx = Math.cos(ang) * this.size * 0.6;
      const my = Math.sin(ang) * this.size * 0.6;
      const a1 = ang + Math.PI / 6;
      const a2 = ang - Math.PI / 6;
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a1) * sl, my + Math.sin(a1) * sl);
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a2) * sl, my + Math.sin(a2) * sl);
    }
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // 5. Scoring & Feedback (placeholder)
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 6. Skins & Effects (stub)
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 7. Debugging Tools (stub)
  // -------------------------------------------------------------------------
  reset() {
  this.playIntro = true;
  this.introTimer = 0;
  this.isReadyToPlay = false;
  this.sequenceCompleted = false;
}
// ---------------------------------------------------------------------------
// 8. Structural Requirements
// ---------------------------------------------------------------------------
get behaviorType() {
  return 'sequence';
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return this.sequenceCompleted ?? false;
}

onStart() {}
onComplete() {}
onFail() {}

}
