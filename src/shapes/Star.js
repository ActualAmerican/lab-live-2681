// ============================================================================
// Shape: Star  |  src/shapes/Star.js
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
function easeOutSin(t) {
  return Math.sin((t * Math.PI) / 2);
}

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class Star extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Star') {
    super(x, y, size, '#ffcf68ff'); // richer gold tone
    this.name          = name;
    // Intro animation state
    this.playIntro     = true;
    this.introTimer    = 0;
    this.introDuration = 2500;
    this.fadeInTime    = 1200;
    this.glintTime     = 1800;
    this.glintDuration = 400;
    this.isReadyToPlay = false;

  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers & State
  // -------------------------------------------------------------------------
  update(deltaTime, level) {
    if (this.playIntro) {
      this.introTimer += deltaTime;
      if (this.introTimer >= this.introDuration) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}

    }
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();

    // Intro sweep + spin + fade-in
    let scale = 1, offsetX = 0, rotation = 0;
    if (this.playIntro) {
      const tRaw = Math.min(this.introTimer / this.glintTime, 1);
      const t     = easeOutSin(tRaw);
      scale       = t;
      const startOffset = -this.size * 4;
      offsetX     = (1 - t) * startOffset;
      rotation    = (1 - t) * 2 * Math.PI;
      ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);
    }

    // Apply transforms
    ctx.translate(this.x + offsetX, this.y);
    if (rotation) ctx.rotate(rotation);
    ctx.scale(scale, scale);

    // Draw star path
    ctx.fillStyle = this.color;
    const outer = this.size;
    const inner = this.size * 0.5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle  = -Math.PI/2 + (i * 2 * Math.PI) / 5;
      const xOuter = Math.cos(angle) * outer;
      const yOuter = Math.sin(angle) * outer;
      const next   = angle + Math.PI/5;
      const xInner = Math.cos(next) * inner;
      const yInner = Math.sin(next) * inner;
      if (i === 0) ctx.moveTo(xOuter, yOuter);
      else          ctx.lineTo(xOuter, yOuter);
      ctx.lineTo(xInner, yInner);
    }
    ctx.closePath();
    ctx.fill();

    // Glint (perimeter dashed) during intro window
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + this.glintDuration
    ) {
      const t = (this.introTimer - this.glintTime) / this.glintDuration;
      // compute perimeter
      let perim = 0;
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI/2 + (i * 2 * Math.PI) / 5;
        const p1x = Math.cos(a1) * (i % 2 === 0 ? outer : inner);
        const p1y = Math.sin(a1) * (i % 2 === 0 ? outer : inner);
        const a2 = a1 + Math.PI/5;
        const p2x = Math.cos(a2) * ((i+1) % 2 === 0 ? outer : inner);
        const p2y = Math.sin(a2) * ((i+1) % 2 === 0 ? outer : inner);
        perim += Math.hypot(p2x - p1x, p2y - p1y);
      }
      const dashLen = perim * 0.15;
      const offset  = perim * t;

      ctx.save();
      ctx.strokeStyle    = 'rgba(255,255,255,0.8)';
      ctx.lineWidth      = 4;
      ctx.setLineDash([dashLen, perim]);
      ctx.lineDashOffset = -offset;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle  = -Math.PI/2 + (i * 2 * Math.PI) / 5;
        const xOuter = Math.cos(angle) * outer;
        const yOuter = Math.sin(angle) * outer;
        const next   = angle + Math.PI/5;
        const xInner = Math.cos(next) * inner;
        const yInner = Math.sin(next) * inner;
        if (i === 0) ctx.moveTo(xOuter, yOuter);
        else          ctx.lineTo(xOuter, yOuter);
        ctx.lineTo(xInner, yInner);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // -------------------------------------------------------------------------
  handleClick()             { return false; }
  checkBoundary()           { return false; }
  isSequenceCompleted()     { return false; }

  reset() {
  this.playIntro     = true;
  this.introTimer    = 0;
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
  return 'sequence'; // placeholder until gameplay defined
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return false; // will update when logic is added
}

onStart() {}
onComplete() {}
onFail() {}

}
