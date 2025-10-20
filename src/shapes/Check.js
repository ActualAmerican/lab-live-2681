// ============================================================================
// Shape: Check  |  src/shapes/Check.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    0. Utility Functions (easing helpers)
//    1. Initialization
//    2. Intro Animation Helpers & State
//    3. Drawing Functions
//    4. Gameplay Logic (placeholder)
//    5. Scoring & Feedback (placeholder)
//    6. Skins & Effects (stub)
//    7. Debugging Tools (stub)
//    8. Structural Requirements
// ============================================================================
import { Shape } from './Shape.js';

// ---------------------------------------------------------------------------
// 0. Utility Functions (easing helpers)
// ---------------------------------------------------------------------------
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class Check extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Check') {
    super(x, y, size, '#808000'); // olive green
    this.name           = name;

    // Intro timing
    this.playIntro      = true;
    this.introTimer     = 0;
    this.introDelay     = 120;
    this.motionDuration = 1600;
    this.fadeInTime     = 900;
    this.glintTime      = this.introDelay + this.motionDuration;
    this.glintDuration  = 400;
    this.introDuration  = this.glintTime + this.glintDuration;

    // Travel distance
    const paSize       = window.playAreaSize ?? 600;
    this.moveDown      = paSize / 2 - this.size;
    this.startX        = x;
    this.startY        = y;
    this.initialYOffset = -this.moveDown; 
    this.sequenceDone = false;
this.isReadyToPlay = false;
  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers & State
  // -------------------------------------------------------------------------
  _getIntroOffset() {
    const tRaw = (this.introTimer - this.introDelay) / this.motionDuration;
    const t    = Math.min(Math.max(tRaw, 0), 1);
    const descentPct = 0.7;
    let ox = 0;
    let oy = this.initialYOffset;
    if (t <= descentPct) {
      const t1 = t / descentPct;
      const dy = this.moveDown * easeOutCubic(t1);
      oy = -this.moveDown + dy;
    } else {
      const ampX = this.size * 0.8;
      const t2   = (t - descentPct) / (1 - descentPct);
      ox = -ampX * Math.sin(Math.PI * t2);
      oy = 0;
    }
    return { ox, oy };
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();

    if (this.playIntro) {
      ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);
    }

    let tx = this.startX, ty = this.startY;
    if (this.playIntro) {
      const { ox, oy } = this._getIntroOffset();
      tx += ox;
      ty += oy;
    }

    ctx.translate(tx, ty);

    // Check path
    const shortLen = this.size * 1.2;
    const longLen  = this.size * 1.3;
    const strokeW  = this.size * 0.35;
    const p0 = { x: -shortLen * 0.4, y: 0 };
    const p1 = { x: 0,               y:  shortLen * 0.5 };
    const p2 = { x: longLen,         y: -longLen * 0.75 };
    const buildPath = () => {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    };

    ctx.strokeStyle = this.color;
    ctx.lineWidth   = strokeW;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'miter';
    buildPath(); ctx.stroke();

    // Narrow glint sweep
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + this.glintDuration
    ) {
      const tNorm = (this.introTimer - this.glintTime) / this.glintDuration;
      const band  = strokeW * 1.1; // narrower band
      const minX  = Math.min(p0.x, p1.x, p2.x) - strokeW;
      const maxX  = Math.max(p0.x, p1.x, p2.x) + strokeW;
      const span  = maxX - minX;
      const gx    = minX + span * tNorm;
      const grad  = ctx.createLinearGradient(gx - band, 0, gx + band, 0);
      grad.addColorStop(0,   'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth   = strokeW;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'miter';
      buildPath(); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // -------------------------------------------------------------------------
  update(dt) {
    if (!this.playIntro) return;
    this.introTimer += dt;
    if (this.introTimer >= this.introDuration) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}

  }
  handleClick() { return false; }
  checkBoundary() { return false; }
  reset() {
  this.introTimer = 0;
  this.playIntro = true;
  this.sequenceDone = false;
  this.isReadyToPlay = false;
}


  // -------------------------------------------------------------------------
  // 5. Scoring & Feedback (placeholder)
  // -------------------------------------------------------------------------
  /* updateScore(points) {} */

  // -------------------------------------------------------------------------
  // 6. Skins & Effects (stub)
  // -------------------------------------------------------------------------
  /* applySkin(skin) {} */

  // -------------------------------------------------------------------------
  // 7. Debugging Tools (stub)
  // -------------------------------------------------------------------------
  /* debugDraw(ctx) {} */
  // -------------------------------------------------------------------------
// 8. Structural Requirements
// -------------------------------------------------------------------------
get behaviorType() {
  return 'sequence';
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return this.sequenceDone ?? false;
}

}
