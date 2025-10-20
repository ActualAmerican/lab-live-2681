// ============================================================================
// Shape: Gear  |  src/shapes/Gear.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    0. Utility Classes & Functions (none)
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
// 0. Utility Classes & Functions (none)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class Gear extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Gear') {
    super(x, y, size, '#8A8A8A');
    this.color = '#8A8A8A';
    this.name  = name;

    // Gear geometry parameters
    this.numTeeth          = 8;
    this.innerRadiusFactor = 0.7;
    this.holeRadiusFactor  = 0.25;

    // Combination-lock spin sequence: right-left-left-right-left, then return to zero
    this.spinAmplitude     = 0.7;
    this.spinSequence      = [1, -1, -1, 1, -1, 0];

    // Timing for intro and glint
    this.playIntro     = true;
    this.introTimer    = 0;
    this.introDuration = 3500;
    this.isReadyToPlay = false;
    this.objectiveCompleted = false;
    this.fadeInTime    = 1200;
    this.glintTime     = 3000;
  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers
  // -------------------------------------------------------------------------
  update(deltaTime, level) {
    if (!this.playIntro) return;
    this.introTimer += deltaTime;

    // Compute rotation during spin sequence
    if (this.introTimer < this.glintTime) {
      const seq     = this.spinSequence;
      const count   = seq.length;
      const segTime = this.glintTime / count;
      let idx       = Math.floor(this.introTimer / segTime);
      if (idx >= count) idx = count - 1;
      const t0      = idx * segTime;
      const t       = (this.introTimer - t0) / segTime;
      const easeT   = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const prevAmp = idx > 0 ? seq[idx - 1] * this.spinAmplitude : 0;
      const nextAmp = seq[idx] * this.spinAmplitude;
      this.rotation = prevAmp + (nextAmp - prevAmp) * easeT;
    } else {
      // maintain zero rotation smoothly
      this.rotation = 0;
    }

    // End intro after full duration
    if (this.introTimer >= this.introDuration) {
  this.playIntro = false;
  this.isReadyToPlay = true;
  this.rotation = 0;
}
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();
    // Fade-in effect
    if (this.playIntro) {
      ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);
    }

    // Center and apply rotation
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.lineJoin = 'round';

    // Build gear outline
    const teeth        = this.numTeeth;
    const outerR       = this.size;
    const innerR       = this.size * this.innerRadiusFactor;
    const holeR        = this.size * this.holeRadiusFactor;
    const angleStep    = (2 * Math.PI) / teeth;
    const innerSpan    = angleStep * 0.8;
    const outerSpan    = innerSpan * 0.8;
    const halfInner    = innerSpan / 2;
    const halfOuter    = outerSpan / 2;

    const path = new Path2D();
    path.moveTo(
      innerR * Math.cos(-halfInner),
      innerR * Math.sin(-halfInner)
    );
    for (let i = 0; i < teeth; i++) {
      const base  = i * angleStep;
      const ia1   = base - halfInner;
      const ia2   = base + halfInner;
      const oa1   = base - halfOuter;
      const oa2   = base + halfOuter;

      path.lineTo(
        outerR * Math.cos(oa1),
        outerR * Math.sin(oa1)
      );
      path.arc(0, 0, outerR, oa1, oa2);
      path.lineTo(
        innerR * Math.cos(ia2),
        innerR * Math.sin(ia2)
      );
      const nextInner = (base + angleStep) - halfInner;
      path.arc(0, 0, innerR, ia2, nextInner);
    }
    path.closePath();

    // Fill gear body
    ctx.fillStyle = this.color;
    ctx.fill(path);

    // Cut out center hole
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(0, 0, holeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Surface glint (same as Kite)
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + 400
    ) {
      const t       = (this.introTimer - this.glintTime) / 400;
      const diam    = outerR * 2;
      const offsetX = -outerR + diam * t;
      const grad    = ctx.createLinearGradient(offsetX - 12, 0, offsetX + 12, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = grad;
      ctx.fillRect(-outerR, -outerR, diam, diam);
      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // -------------------------------------------------------------------------
  handleClick() { return false; }
  checkBoundary() { return false; }

  reset() {
  this.playIntro  = true;
  this.introTimer = 0;
  this.isReadyToPlay = false;
  this.objectiveCompleted = false;
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
  return 'objective';
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return this.objectiveCompleted ?? false;
}

}
