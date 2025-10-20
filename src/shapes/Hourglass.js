// ============================================================================
// Shape: Hourglass  |  src/shapes/Hourglass.js
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
// 1. Initialization
// ---------------------------------------------------------------------------
export class Hourglass extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Hourglass') {
    // Purple
    super(x, y, size, '#9B59B6');
    this.name = name;

    // Intro configuration
    this.playIntro = true;
    this.introTimer = 0;
    this.introDuration = 2500; // ms total
    this.fadeInTime = 1200;    // ms fade-in
    this.spinStart = this.fadeInTime; // start spin right after fade-in
    this.spinDuration = (this.introDuration * 0.72) - this.spinStart; // spin until just before glint
    this.glintTime = this.fadeInTime + this.spinDuration; 
    this.glintDuration = 600;
    this.sequenceDone = false;
    this.isReadyToPlay = false;
    this.objectiveCompleted = false;

  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers
  // -------------------------------------------------------------------------
  // (Spin easing is applied directly in draw())

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();

    // Fade-in
    if (this.playIntro && this.introTimer < this.fadeInTime) {
      ctx.globalAlpha = this.introTimer / this.fadeInTime;
    }

    // Center pivot
    ctx.translate(this.x, this.y);

    // Spin before glint
    if (this.playIntro && this.introTimer >= this.spinStart && this.introTimer < this.glintTime) {
      const t = (this.introTimer - this.spinStart) / this.spinDuration;
      const eased = (1 - Math.cos(t * Math.PI)) / 2;
      ctx.rotate(eased * Math.PI); // 0 → 180°
    }

    // Draw rounded hourglass
    ctx.fillStyle = this.color;
    const topW = this.size;
    const waistW = this.size * 0.3;
    const halfH = this.size * 1.2;
    const pts = [
      { x: -topW, y: -halfH },
      { x:  topW, y: -halfH },
      { x:  waistW, y: 0      },
      { x:  topW, y:  halfH },
      { x: -topW, y:  halfH },
      { x: -waistW, y: 0      }
    ];
    const cr = this.size * 0.1; // corner radius

    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i];
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next = pts[(i + 1) % pts.length];
      const vPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
      const lenPrev = Math.hypot(vPrev.x, vPrev.y);
      const uPrev = { x: vPrev.x / lenPrev, y: vPrev.y / lenPrev };
      const vNext = { x: next.x - curr.x, y: next.y - curr.y };
      const lenNext = Math.hypot(vNext.x, vNext.y);
      const uNext = { x: vNext.x / lenNext, y: vNext.y / lenNext };
      const startX = curr.x + uPrev.x * cr;
      const startY = curr.y + uPrev.y * cr;
      const endX   = curr.x + uNext.x * cr;
      const endY   = curr.y + uNext.y * cr;

      if (i === 0) ctx.moveTo(startX, startY);
      else ctx.lineTo(startX, startY);
      ctx.quadraticCurveTo(curr.x, curr.y, endX, endY);
    }
    ctx.closePath();
    ctx.fill();

    // Glint as the exclamation point
 if (this.playIntro && this.introTimer >= this.glintTime && this.introTimer < this.glintTime + 400) {
      const t = (this.introTimer - this.glintTime) / 400;
      // compute perimeter
      let perim = 0;
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        perim += Math.hypot(p2.x - p1.x, p2.y - p1.y);
      }
      const highlightLen = perim * 0.15;
      const offset = perim * t;

      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineJoin = 'round';
      ctx.setLineDash([highlightLen, perim]);
      ctx.lineDashOffset = -offset;

      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (this.playIntro) {
      this.introTimer += deltaTime;
      if (this.introTimer >= this.introDuration) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}
    }
    // TODO: Add Hourglass-specific gameplay updates here
  }

  // -------------------------------------------------------------------------
  // 5. Scoring & Feedback (placeholder)
  // -------------------------------------------------------------------------
  // updateScore(points) {}

  // -------------------------------------------------------------------------
  // 6. Skins & Effects (stub)
  // -------------------------------------------------------------------------
  // applySkin(skin) {}

  // -------------------------------------------------------------------------
  // 7. Debugging Tools (stub)
  // -------------------------------------------------------------------------
  // debugDraw(ctx) {}
  reset() {
  this.playIntro = true;
  this.introTimer = 0;
  this.isReadyToPlay = false;
  this.objectiveCompleted = false;
}
// -------------------------------------------------------------------------
// 8. Structural Requirements
// -------------------------------------------------------------------------
get behaviorType() {
  return 'objective';
}

isReady() {
  return !this.playIntro;
}
handleClick() {
  // TODO: implement interaction
}

checkBoundary() {
  return false; // or custom logic
}

resetSequence(level) {
  this.reset();
}

isSequenceCompleted() {
  return this.objectiveCompleted ?? false;
}

}
