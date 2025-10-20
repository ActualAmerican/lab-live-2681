// ============================================================================
// Shape: CrescentMoon  |  src/shapes/CrescentMoon.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    0. Utility Functions
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
// 0. Utility Functions
// ---------------------------------------------------------------------------
const easeOut = t => 1 - Math.pow(1 - t, 2);
const easeInOut = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class CrescentMoon extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'CrescentMoon') {
    super(x, y, size * 0.93, '#FFD700'); // Yellow, slightly smaller
    this.name = name;

    this._drawScale = 5;
    this._vbSize = 655.35999;
    this._halfVB = this._vbSize / 2;

    this.playIntro = true;
    this.introTimer = 0;
    this.introDuration = 2600; // slightly faster
    this.fadeInTime = 900;
    this.glintStart = this.introDuration;
    this.glintDuration = 500;
    this.sequenceDone = false;
    this._introCenterX = x;
    this._introCenterY = y;
    this.isReadyToPlay = false;
    this.objectiveCompleted = false;


    this._path = new Path2D(`m 318.07999,496.73467 c -26.53232,-1.61192 -52.77821,-9.58584 -75.74805,-23.01347 -19.09748,-11.16394 -36.64219,-26.82153 -49.79745,-44.44121 -17.54598,-23.50043 -28.54382,-50.423 -32.3531,-79.2 -1.24873,-9.43341 -1.56787,-15.42666 -1.37028,-25.73329 0.38486,-20.07546 3.99093,-38.59995 11.13121,-57.18135 8.79099,-22.87712 22.47758,-43.58549 40.10279,-60.67719 21.0723,-20.43444 46.71312,-34.87663 75.07488,-42.28592 10.10716,-2.64041 18.34765,-4.02872 30.78817,-5.18701 6.13073,-0.57081 23.85532,-0.20114 30.80314,0.64244 12.12338,1.47197 23.23614,3.9543 34.40646,7.68558 5.00697,1.67251 7.55952,2.64729 14.69077,5.61022 6.85674,2.84887 17.81421,8.87682 25.63146,14.10043 5.92309,3.95789 13.20385,9.40157 12.00171,8.97342 -1.44335,-0.51405 -9.19037,-2.41963 -12.32171,-3.03085 -7.81608,-1.52564 -13.79975,-2.07331 -22.88,-2.09412 -9.50675,-0.0218 -13.76355,0.36787 -23.04,2.1091 -25.68326,4.82087 -48.55563,16.95077 -67.19953,35.63792 -22.3527,22.40455 -36.31865,52.09577 -39.69741,84.39558 -1.43383,13.70688 -0.61978,30.11048 2.13524,43.02644 0.36704,1.72073 0.79281,3.74374 0.94616,4.49558 0.78143,3.83116 3.16148,11.50663 5.57936,17.99302 8.84319,23.72335 24.9507,45.1816 45.43618,60.52956 17.67304,13.24085 37.87829,21.39896 60.64,24.48413 6.21803,0.84281 23.24823,0.84077 29.44,-0.004 7.43932,-1.0144 17.00095,-3.02362 21.6,-4.53889 0.84728,-0.27916 0.21001,0.25382 -5.12,4.28215 -28.81492,21.77782 -65.53591,33.87862 -101.92,33.58606 -3.96,-0.0318 -7.992,-0.10601 -8.96,-0.16482 z`);
  }

  // ---------------------------------------------------------------------------
  // 2. Intro Animation Helpers & State
  // ---------------------------------------------------------------------------
  update(deltaTime) {
    if (!this.playIntro) return;
    this.introTimer += deltaTime;
    if (this.introTimer >= this.introDuration + this.glintDuration) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}

  }

  // ---------------------------------------------------------------------------
  // 3. Drawing Functions
  // ---------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();
    const alpha = Math.min(1, this.introTimer / this.fadeInTime);
    ctx.globalAlpha = alpha;

    let drawX = this._introCenterX;
    let drawY = this._introCenterY;

    const t = Math.min(1, this.introTimer / this.introDuration);
    if (this.playIntro && t < 1) {
      const spiralEase = easeInOut(t);
      const spiralRadius = this.size * 2.2 * (1 - spiralEase);
      const spiralAngle = spiralEase * 2 * Math.PI * 1.3; // slight increase for smoother slow-down
      drawX += spiralRadius * Math.cos(spiralAngle);
      drawY += spiralRadius * Math.sin(spiralAngle);
    }

    ctx.translate(drawX, drawY);

    const scale = (this.size * this._drawScale) / this._vbSize;
    ctx.scale(scale, scale);
    ctx.translate(-this._halfVB, -this._halfVB);

    ctx.fillStyle = this.color;
    ctx.fill(this._path);

    const glintT = this.introTimer - this.glintStart;
    if (glintT >= 0 && glintT <= this.glintDuration) {
      const g = glintT / this.glintDuration;
      const glintX = this._vbSize * (0.1 + 0.8 * g);
      const grad = ctx.createLinearGradient(glintX - 35, 0, glintX + 35, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fill(this._path);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // ---------------------------------------------------------------------------
  handleClick() { return false; }
  checkBoundary() { return false; }
  isSequenceCompleted() { return false; }

  // ---------------------------------------------------------------------------
  // 5. Scoring & Feedback (placeholder)
  // ---------------------------------------------------------------------------
  onScoreUpdate(score) {}

  // ---------------------------------------------------------------------------
  // 6. Skins & Effects (stub)
  // ---------------------------------------------------------------------------
  applySkin(skin) {}

  // ---------------------------------------------------------------------------
  // 7. Debugging Tools (stub)
  // ---------------------------------------------------------------------------
  debugDraw(ctx) {}

  reset() {
  this.playIntro = true;
  this.introTimer = 0;
  this.isReadyToPlay = false;
  this.objectiveCompleted = false;
}
// ---------------------------------------------------------------------------
// 8. Structural Requirements
// ---------------------------------------------------------------------------
get behaviorType() {
  return 'objective';
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return this.objectiveCompleted ?? false;
}
resetSequence(level) {
  this.reset();
}

}
