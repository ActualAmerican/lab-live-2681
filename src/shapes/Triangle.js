// src/shapes/Triangle.js

import { Shape } from './Shape.js';

/* ============================================================================
 *  Shape: Triangle
 *  Organized according to the standard blueprint:
 *    1. Initialization
 *    2. Intro Animation
 *    3. Drawing Functions
 *    4. Gameplay Logic           (placeholder – to be implemented)
 *    5. Scoring and Feedback     (placeholder – to be implemented)
 *    6. Skins and Effects        (placeholder – to be implemented)
 *    7. Debugging Tools          (optional)
 *    8. Structural Requirements
 * ========================================================================== */

// ---------------------------------------------------------------------------
//  Helper Functions (shared utilities for this shape)
// ---------------------------------------------------------------------------

// Centroid calculation for an equilateral triangle centered at (x, y)
function getTriangleCentroid(x, y, size) {
  // Vertices: top (A), left (B), right (C)
  const Ax = x;
  const Ay = y - size;
  const Bx = x - size;
  const By = y + size;
  const Cx = x + size;
  const Cy = y + size;
  // Centroid: average of vertices
  return {
    cx: (Ax + Bx + Cx) / 3,
    cy: (Ay + By + Cy) / 3
  };
}

// Cubic ease‑in‑out helper for smooth transitions
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------

export class Triangle extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Triangle') {
    const triangleScale = 0.82;
    super(x, y, size * triangleScale, '#23a39b');

    this.name = name;
    this.baseSize = size * triangleScale;

    // Intro‑animation state
    this.playIntro      = true;
    this.introTimer     = 0;
    this.introDuration  = 2500;  // full intro length (ms)
    this.fadeInTime     = 1200;  // fade‑in opacity (ms)
    this.glintTime      = 1800;  // when surface glint starts (ms)
    this.glintDuration  = 400;   // length of glint sweep (ms)
    this.sequenceDone = false;
    this.objectiveCompleted = false;
    this.introSpinAngle = 0;     // current spin angle during intro (rad)
    this.centroid       = getTriangleCentroid(this.x, this.y, this.size);

    // Snap‑rotation timestamps (right, left, up, down)
    // Smoother & longer than default square intro (450 ms each)
    this.snapTimes = [450, 900, 1350, 1800];
    this.isReadyToPlay = false;

  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation  (update loop)
  // -------------------------------------------------------------------------
  update(deltaTime /*, level */) {
    // Handle intro‑animation timing & spin before gameplay begins
    if (this.playIntro) {
      this.introTimer += deltaTime;

      const quarter = Math.PI / 2;
      const snapTimes = this.snapTimes;

      if (this.introTimer < snapTimes[0]) {
        // upright → right (0 → 90°)
        const t = this.introTimer / snapTimes[0];
        this.introSpinAngle = easeInOutCubic(t) * quarter;
      } else if (this.introTimer < snapTimes[1]) {
        // right → left (90 → 270°)
        const t = (this.introTimer - snapTimes[0]) / (snapTimes[1] - snapTimes[0]);
        this.introSpinAngle = quarter + easeInOutCubic(t) * Math.PI;
      } else if (this.introTimer < snapTimes[2]) {
        // left → down (270 → 450° (90°))
        const t = (this.introTimer - snapTimes[1]) / (snapTimes[2] - snapTimes[1]);
        this.introSpinAngle = (Math.PI * 1.5) + easeInOutCubic(t) * quarter;
      } else if (this.introTimer < snapTimes[3]) {
        // down → upright (360 → 0°)
        const t = (this.introTimer - snapTimes[2]) / (snapTimes[3] - snapTimes[2]);
        this.introSpinAngle = (2 * Math.PI) - easeInOutCubic(t) * (2 * Math.PI);
      } else {
        this.introSpinAngle = 0; // stabilize upright
      }

      if (this.introTimer >= this.introDuration) {
        this.playIntro = false;
        this.introSpinAngle = 0;
        this.isReadyToPlay = true;

      }
    }

    /* --------------------------------------------------------------------
     * 4. Gameplay Logic (placeholder)
     * --------------------------------------------------------------------
     * Shooter‑style mechanics inspired by Space Invaders will be implemented
     * here.  Expected systems:
     *   • Targeting and projectile emission from the triangle
     *   • Enemy waves or obstacles
     *   • Collision detection & fail conditions
     *   • Difficulty scaling based on `level`
     * ------------------------------------------------------------------ */
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();

    // Fade‑in opacity during intro
    if (this.playIntro) {
      ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);
    }

    // Spin around the centroid (not around the top tip)
    const { cx, cy } = this.centroid;
    if (this.playIntro && this.introSpinAngle !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(this.introSpinAngle);
      ctx.translate(-cx, -cy);
    }

    // --- base triangle fill ---
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.size);
    ctx.lineTo(this.x - this.size, this.y + this.size);
    ctx.lineTo(this.x + this.size, this.y + this.size);
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();

    // --- surface glint effect ---
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer <= this.glintTime + this.glintDuration
    ) {
      const t = (this.introTimer - this.glintTime) / this.glintDuration;
      const startX = this.x - this.size;
      const endX = this.x + this.size;
      const glintX = startX + (endX - startX) * t;

      // Horizontal gradient sweep
      const grad = ctx.createLinearGradient(
        glintX - this.size * 0.2, 0,
        glintX + this.size * 0.2, 0
      );
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      // Clip to triangle shape
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - this.size);
      ctx.lineTo(this.x - this.size, this.y + this.size);
      ctx.lineTo(this.x + this.size, this.y + this.size);
      ctx.closePath();
      ctx.clip();

      ctx.fillStyle = grad;
      ctx.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
      ctx.restore();
    }

    ctx.restore();
  }

  /* ------------------------------------------------------------------------
   * 5. Scoring and Feedback (placeholder)
   * ------------------------------------------------------------------------
   *   • Score increments per enemy hit / hazard avoided
   *   • Visual & audio feedback (e.g., hit flashes, sound effects)
   *   • Combo or multiplier handling
   * ---------------------------------------------------------------------- */

  /* ------------------------------------------------------------------------
   * 6. Skins and Effects (placeholder)
   * ------------------------------------------------------------------------
   *   • Integrate with SkinManager to apply alternate art styles
   *   • Trail / particle emitters attached to vertices
   *   • Unlockable cosmetic variants
   * ---------------------------------------------------------------------- */

  /* ------------------------------------------------------------------------
   * 7. Debugging Tools (optional)
   * ------------------------------------------------------------------------
   *   Uncomment or expand as needed for dev‑only overlays, bounding boxes,
   *   hit‑area visualization, etc.
   * ---------------------------------------------------------------------- */

  reset() {
    this.playIntro      = true;
    this.introTimer     = 0;
    this.introSpinAngle = 0;
    this.centroid       = getTriangleCentroid(this.x, this.y, this.size);
    this.isReadyToPlay = false;

  }
  // ------------------------------------------------------------------------
// 8. Structural Requirements
// ------------------------------------------------------------------------
get behaviorType() {
  return 'survival';
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return true;
}

onStart() {}
onComplete() {}
onFail() {}

handleClick() {
  // (Add triangle click logic or leave empty if not interactive)
}

checkBoundary(x, y, size) {
  return false; // or actual check logic if needed
}

resetSequence(level) {
  this.reset();
}

}
