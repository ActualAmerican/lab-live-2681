// ============================================================================
// Shape: Octagon  |  src/shapes/Octagon.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
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
// Utility Functions (shared)
// ---------------------------------------------------------------------------
/** Smooth ease‑in/out sine */
function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class Octagon extends Shape {
  constructor(x, y, size) {
    super(x, y, size, '#800020');
    this.name = 'Octagon';

    // Intro state -----------------------------------------------------------
    this.playIntro  = true;
    this.introTimer = 0;
    this.fadeInTime = 1200;

    // Cardinal move pattern (up, left, down, right)
    this.cardinals = [
      { dx: 0,  dy: -1 },
      { dx: -1, dy:  0 },
      { dx: 0,  dy:  1 },
      { dx: 1,  dy:  0 },
    ];
    this.moveDist = this.size * 1.10;

    // Segment timings
    this.moveOutDuration = 200;
    this.moveInDuration  = 370;
    this.numCardinals    = this.cardinals.length;

    // Derived intro duration
    this.personalAffectDuration =
      (this.moveOutDuration + this.moveInDuration) * this.numCardinals;
    this.glintDuration = 400;
    this.introDelay    = 210;
    this.introDuration =
      this.introDelay + this.personalAffectDuration + this.glintDuration;

    this.startX = x;
    this.startY = y;
    this.isReadyToPlay = false;
    this.sequenceCompleted = false;
  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers
  // -------------------------------------------------------------------------
  /**
   * Computes positional offsets during the intro’s cardinal hop pattern.
   * @returns {{ox:number, oy:number}}
   */
  getIntroOffsets() {
    let t = this.introTimer - this.introDelay;
    if (t < 0) return { ox: 0, oy: 0 };

    // Iterate through OUT/IN segments for each cardinal
    for (let i = 0; i < this.numCardinals; i++) {
      // OUT segment
      if (t < this.moveOutDuration) {
        const segT = easeInOutSine(t / this.moveOutDuration);
        const { dx, dy } = this.cardinals[i];
        return { ox: this.moveDist * dx * segT, oy: this.moveDist * dy * segT };
      }
      t -= this.moveOutDuration;

      // IN segment
      if (t < this.moveInDuration) {
        const segT = easeInOutSine(t / this.moveInDuration);
        const { dx, dy } = this.cardinals[i];
        return { ox: this.moveDist * dx * (1 - segT), oy: this.moveDist * dy * (1 - segT) };
      }
      t -= this.moveInDuration;
    }
    // After animation complete → center
    return { ox: 0, oy: 0 };
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();

    // ---- Fade In ----------------------------------------------------------
    if (this.playIntro) {
      const alpha = Math.min(1, this.introTimer / this.fadeInTime);
      ctx.globalAlpha = alpha;
    }

    // ---- Intro Translation ------------------------------------------------
    let tx = this.x, ty = this.y;
    if (
      this.playIntro &&
      this.introTimer > this.introDelay &&
      this.introTimer < this.introDelay + this.personalAffectDuration
    ) {
      const { ox, oy } = this.getIntroOffsets();
      tx = this.startX + ox;
      ty = this.startY + oy;
    }

    ctx.translate(tx, ty);

    // ---- Octagon Fill -----------------------------------------------------
    const sides = 8;
    const angleOffset = Math.PI / sides;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = angleOffset + (i * 2 * Math.PI) / sides;
      const px = this.size * Math.cos(angle);
      const py = this.size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // ---- Glint after motion ----------------------------------------------
    if (
      this.playIntro &&
      this.introTimer >= this.introDelay + this.personalAffectDuration &&
      this.introTimer < this.introDelay + this.personalAffectDuration + this.glintDuration
    ) {
      const t = (this.introTimer - (this.introDelay + this.personalAffectDuration)) / this.glintDuration;
      const totalTravel = this.size * 2 + this.size * 0.2 * 2;
      const glintLen = this.size * 0.2;
      const glintX = -this.size - glintLen + totalTravel * t;

      const grad = ctx.createLinearGradient(glintX - glintLen, 0, glintX + glintLen, 0);
      grad.addColorStop(0,   'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');

      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = angleOffset + (i * 2 * Math.PI) / sides;
        const px = this.size * Math.cos(angle);
        const py = this.size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.clip();

      ctx.fillStyle = grad;
      ctx.fillRect(-this.size - glintLen, -this.size, (this.size + glintLen) * 2, this.size * 2);
      ctx.restore();
    }

    ctx.restore();

    // Additional gameplay drawing would go below when implemented.
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // -------------------------------------------------------------------------
  update(deltaTime /*, level */) {
    if (this.playIntro) {
      this.introTimer += deltaTime;
      if (this.introTimer >= this.introDuration) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}

      return; // skip gameplay while intro plays
    }
    // TODO: add gameplay update logic later
  }

  // -------------------------------------------------------------------------
  // 5. Scoring & Feedback (placeholder)
  // -------------------------------------------------------------------------
  /*
    updateScore(points) {
      // TODO: implement scoring logic
    }
  */

  // -------------------------------------------------------------------------
  // 6. Skins & Effects (stub)
  // -------------------------------------------------------------------------
  /*
    applySkin(skin) {
      // TODO: implement skin application
    }
  */

  // -------------------------------------------------------------------------
  // 7. Debugging Tools (stub)
  // -------------------------------------------------------------------------
  /*
    debugDraw(ctx) {
      // TODO: draw hitboxes, motion paths, etc.
    }
  */
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

}
