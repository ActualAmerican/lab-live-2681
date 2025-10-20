// ============================================================================
// Shape: Sun  |  src/shapes/Sun.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    0. Utility Classes & Functions (none)
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
// 1. Initialization
// ---------------------------------------------------------------------------
export class Sun extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Sun') {
    super(x, y, size, '#FF4500'); // gold-ish sun
    this.name = name;

    // Intro / personal affect timings
    this.playIntro     = true;
    this.introTimer    = 0;
    this.introDuration = 2600;  // slightly swifter total time for loops
    this.fadeInTime    = 1200;  // fade-in period
    this.loopCount     = 2;     // how many oval loops

    // Oval parameters (radius)
    this.ovalA    = size * 0.3;  // horizontal radius
    this.ovalB    = size * 0.15; // vertical radius
    this.scaleAmp = 0.25;        // scale oscillation amplitude

    // Glint triggers after loops complete and exit
    this.exitDelay     = 200;                      // time to ease back to center
    this.glintDelay    = this.introDuration + this.exitDelay;
    this.glintDuration = 400;

    // Precompute for ease-out quad
    this.exitDuration  = this.exitDelay;
    this.isReadyToPlay = false;
  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers & State
  // -------------------------------------------------------------------------
  update(deltaTime, level) {
    if (this.playIntro) {
      this.introTimer += deltaTime;
      // after glint completes, end intro
      if (this.introTimer >= this.glintDelay + this.glintDuration) {
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

    // Alpha fade-in
    if (this.introTimer < this.fadeInTime) {
      ctx.globalAlpha = this.introTimer / this.fadeInTime;
    }

    // Compute translation & scale during intro loops and exit
    let dx = 0, dy = 0, scale = 1;
    if (this.introTimer < this.introDuration) {
      const t = this.introTimer / this.introDuration;
      const phase = t * this.loopCount * Math.PI * 2;
      dx    = this.ovalA * Math.cos(phase);
      dy    = this.ovalB * Math.sin(phase);
      scale = 1 + this.scaleAmp * Math.sin(phase);
    } else if (this.introTimer < this.glintDelay) {
      // ease back to center over exitDelay
      const exitT = (this.introTimer - this.introDuration) / this.exitDuration;
      const ee = exitT * (2 - exitT); // easeOutQuad
      dx = this.ovalA * (1 - ee);
      dy = 0;
      scale = 1;
    }

    // Apply transforms
    ctx.translate(this.x + dx, this.y + dy);
    ctx.scale(scale, scale);

    // Draw sun shape
    const spikes = 12;
    const outer = this.size;
    const inner = this.size * 0.6;
    const step  = Math.PI / spikes;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = (i % 2 === 0 ? outer : inner);
      const a = i * step;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](
        Math.cos(a) * r,
        Math.sin(a) * r
      );
    }
    ctx.closePath();
    ctx.fillStyle = this.color;
    ctx.fill();

    // Glint after loops and exit
    if (
      this.introTimer >= this.glintDelay &&
      this.introTimer < this.glintDelay + this.glintDuration
    ) {
      const gt = (this.introTimer - this.glintDelay) / this.glintDuration;

      // prepare perimeter points
      const pts = [];
      for (let i = 0; i <= spikes * 2; i++) {
        const idx = i % (spikes * 2);
        const r   = (idx % 2 === 0 ? outer : inner);
        const a   = idx * step;
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      // compute perimeter length
      let perim = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        perim += Math.hypot(p2.x - p1.x, p2.y - p1.y);
      }

      const highlight = perim * 0.15;
      const dashOff   = perim * gt;

      ctx.save();
      ctx.setLineDash([highlight, perim - highlight]);
      ctx.lineDashOffset = -dashOff;
      ctx.lineWidth      = this.size * 0.05;
      ctx.strokeStyle    = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // -------------------------------------------------------------------------
  handleClick()         { return false; }
  checkBoundary()       { return false; }
  isSequenceCompleted() { return false; }

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
  return 'sequence'; // or update when gameplay is finalized
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return false;
}

onStart() {}
onComplete() {}
onFail() {}

}
