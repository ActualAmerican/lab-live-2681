// ============================================================================
// Shape: Spiral  |  src/shapes/Spiral.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    0. Utility Functions (none)
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
export class Spiral extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Spiral') {
    // pink color
    super(x, y, size, '#FF69B4'); // balanced pink between salmon and magenta
    this.name = name;

    // Intro + glint configuration
    this.playIntro     = true;
    this.introTimer    = 0;
    this.introDuration = 2500;  // total intro time in ms
    this.fadeInTime    = 1200;  // fade-in period
    this.glintTime     = 1800;  // start of glint
    this.glintLength   = this.size * 0.2;
    this.glintDuration = 600;
    this.sequenceDone = false;
    this.objectiveCompleted = false;
    this.rotation  = 0;
    this.totalSpin = Math.PI * 2 * 4;
    this.isReadyToPlay = false;

  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers & State
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (!this.playIntro) return;
    this.introTimer += deltaTime;
    if (this.introTimer >= this.introDuration) {
  this.playIntro = false;
  this.isReadyToPlay = true;
  this.rotation  = 0;
}
 else {
      // decelerate spin: ease-out cubic
      const t     = this.introTimer / this.introDuration;
      const ease  = 1 - Math.pow(1 - t, 3);
      this.rotation = (1 - ease) * this.totalSpin;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();

    // fade-in and handle intro spin
    if (this.playIntro) {
      // fade in alpha
      ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);
      // apply spin
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.translate(-this.x, -this.y);
    }

    // Draw the spiral
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = this.size * 0.1;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();

    const turns     = 4;
    const steps     = 200;
    const maxRadius = this.size * 1.2;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * (Math.PI * 2 * turns);
      const r = (maxRadius * i) / steps;
      const px = this.x + r * Math.cos(t);
      const py = this.y + r * Math.sin(t);
      if (i === 0) ctx.moveTo(px, py);
      else        ctx.lineTo(px, py);
    }

    ctx.stroke();

    // surface glint effect
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + 400
    ) {
      const t = (this.introTimer - this.glintTime) / 400;
      const totalTravel = this.size * 2 + this.glintLength * 2;
      const glintX = -this.size - this.glintLength + totalTravel * t + this.x;

      const grad = ctx.createLinearGradient(
        glintX - this.glintLength, 0,
        glintX + this.glintLength, 0
      );
      grad.addColorStop(0,   'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth   = this.size * 0.15;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t2 = (i / steps) * (Math.PI * 2 * turns);
        const r2 = (maxRadius * i) / steps;
        const px2 = this.x + r2 * Math.cos(t2);
        const py2 = this.y + r2 * Math.sin(t2);
        if (i === 0) ctx.moveTo(px2, py2);
        else        ctx.lineTo(px2, py2);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // -------------------------------------------------------------------------
  handleClick() { return false; }
  checkBoundary() { return false; }
  isSequenceCompleted() { return false; }

  reset() {
  this.playIntro  = true;
  this.introTimer = 0;
  this.rotation   = 0;
  this.isReadyToPlay = false;
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
  // ---------------------------------------------------------------------------
// 8. Structural Requirements
// ---------------------------------------------------------------------------
get behaviorType() {
  return 'survival';
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return true;
}
resetSequence(level) {
  this.reset();
}

onStart() {}
onComplete() {}
onFail() {}

}
