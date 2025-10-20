// ============================================================================
// Shape: IceCream  |  src/shapes/IceCream.js
// ----------------------------------------------------------------------------
// Blueprint Sections
//   0. Utility Classes & Functions (none)
//   1. Initialization
//   2. Intro Animation Helpers & State
//   3. Drawing Functions
//   4. Gameplay Logic (placeholder)
//   5. Scoring & Feedback (placeholder)
//   6. Skins & Effects (stub)
//   7. Debugging Tools (stub)
//   8. Structural Requirements
// ============================================================================

import { Shape } from './Shape.js';

export class IceCream extends Shape {
  // ===========================================================================
  // 1. Initialization
  // ===========================================================================
  constructor(x, y, size, _ignoredColor, name = 'IceCream') {
    super(x, y, size * 0.97, '#C290EC'); // Slightly smaller
    this.name = name;

    this._drawScale = 3.8;
    this._vbSize = 655.35999;
    this._halfVB = this._vbSize * 0.5;

    this.sequenceDone = false;
    this.objectiveCompleted = false;
    this.playIntro = true;
    this.introTimer = 0;
    this.introDuration = 650;
    this.fadeInTime = 500;
    this.wobbleDuration = 1000;
    this.glintStartDelay = 200;
    this.glintDuration = 600;
    this.isReadyToPlay = false;


    // Full SVG Path (no truncation)
    const d = `m 323.99999,618.89411 c -6.59954,-1.43378 -12.28865,-6.65195 -18.30793,-16.79243 -14.25468,-24.01437 -28.86978,-74.80269 -40.89188,-142.10169 -0.6288,-3.52 -1.34971,-7.552 -1.60202,-8.96 -1.26806,-7.07644 -4.4216,-27.87773 -6.71906,-44.32 -0.65759,-4.70623 -2.5931,-20.36564 -3.20372,-25.92 -0.28056,-2.552 -0.57096,-4.928 -0.64535,-5.28 -0.0897,-0.4243 -1.07767,-1.12532 -2.9315,-2.08 -12.17845,-6.2716 -17.07149,-15.78405 -12.77393,-24.8335 l 1.12319,-2.36512 -2.4639,-1.80559 c -5.12721,-3.75731 -10.50035,-9.85533 -13.49518,-15.31579 -4.79813,-8.74841 -5.55832,-19.84159 -1.94207,-28.33967 2.48301,-5.83497 5.9212,-9.66995 13.26379,-14.7945 0.5883,-0.41059 0.56961,-0.49568 -0.5156,-2.34731 -2.80063,-4.77855 -5.28254,-11.52937 -6.38316,-17.36222 -0.9134,-4.84068 -0.9826,-12.79121 -0.15071,-17.3163 1.59847,-8.69488 5.34006,-15.95506 11.48832,-22.29189 5.24456,-5.40542 11.24267,-9.14944 18.18217,-11.3493 l 3.07277,-0.97408 0.20995,-4.14817 c 1.53102,-30.25041 21.26479,-58.52594 55.17319,-79.0549 14.70068,-8.90014 33.20788,-16.46497 51.43263,-21.02312 18.05237,-4.51504 34.03793,-6.52329 52.32,-6.57291 9.14255,-0.0248 9.50945,-0.002 11.64426,0.7352 1.32437,0.45711 2.718,1.22353 3.49127,1.92 3.19962,2.88183 3.41629,7.79028 0.47789,10.82637 -0.54678,0.56496 -2.61054,1.98119 -4.58613,3.14718 -8.61625,5.08531 -14.19982,10.38576 -17.20067,16.32847 -2.99045,5.92213 -2.41418,13.4526 1.66344,21.73716 2.29007,4.65277 4.1379,7.27394 10.23345,14.51632 9.60299,11.40971 12.24906,15.53892 14.99753,23.40368 2.06826,5.91835 2.4786,8.33103 2.44907,14.4 -0.0653,13.41521 -4.12045,23.88128 -12.38403,31.96213 l -2.08832,2.04213 0.92481,1.503 c 1.33052,2.16237 2.41416,5.24066 2.84358,8.07771 0.7693,5.08262 -1.12543,11.11897 -4.91238,15.65013 l -1.76772,2.11511 1.40408,1.00834 c 2.48845,1.78706 6.53739,5.81638 8.52534,8.48402 11.16063,14.9765 9.10321,34.32204 -5.61931,52.83742 -1.39946,1.76 -4.46485,5.144 -6.81197,7.52 l -4.26749,4.32 1.15287,2.45944 c 4.3008,9.17494 -0.5284,18.60772 -12.7481,24.90056 -1.85383,0.95468 -2.84183,1.6557 -2.9315,2.08 -0.0744,0.352 -0.3648,2.728 -0.64535,5.28 -0.61062,5.55436 -2.54613,21.21377 -3.20373,25.92 -2.29745,16.44227 -5.451,37.24356 -6.71906,44.32 -0.2523,1.408 -0.97321,5.44 -1.60201,8.96 -6.33301,35.45179 -14.06934,69.31381 -21.16511,92.64 -12.25217,40.27702 -23.54858,61.11067 -35.51335,65.4963 -2.42265,0.88801 -7.49242,1.27682 -9.88136,0.75782 z`;
    this._path = new Path2D(d);
  }

  // ===========================================================================
  // 2. Intro Animation Helpers & State
  // ===========================================================================
  update(deltaTime) {
    if (!this.playIntro) return;
    this.introTimer += deltaTime;

    const total = this.introDuration + this.wobbleDuration + this.glintStartDelay + this.glintDuration;
    if (this.introTimer >= total) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}

  }

  // ===========================================================================
  // 3. Drawing Functions
  // ===========================================================================
  draw(ctx) {
    ctx.save();

    const tRaw = Math.min(1, this.introTimer / this.introDuration);
    const t = tRaw * tRaw * (3 - 2 * tRaw);

    let drawX = this.x;
    let drawY = this.y;
    let tilt = 0;

    if (this.playIntro) {
      const startX = this.x - this.size * 4.2;
      drawX = startX + (this.x - startX) * t;
      tilt = -0.4 * (1 - t);
    }

    const wobbleStart = this.introDuration;
    const wobbleEnd = wobbleStart + this.wobbleDuration;

    if (this.introTimer >= wobbleStart && this.introTimer < wobbleEnd) {
      const wobbleT = (this.introTimer - wobbleStart) / this.wobbleDuration;
      const decay = 1 - wobbleT;
      const bounce = Math.sin(wobbleT * Math.PI * 4);
      tilt = 0.35 * bounce * decay;
    }

    const alpha = Math.min(1, this.introTimer / this.fadeInTime);
    ctx.globalAlpha = alpha;

    // Pivot from the bottom (metronome effect)
    ctx.translate(drawX, drawY + this.size * 1.1);
    ctx.rotate(tilt);
    ctx.translate(0, -this.size * 1.1);

    // Clip and transform
    ctx.beginPath();
    ctx.rect(-this.size, -this.size * 2, this.size * 2, this.size * 4);
    ctx.clip();

    const scale = (this.size * this._drawScale) / this._vbSize;
    ctx.scale(scale, scale);
    ctx.translate(-this._halfVB, -this._halfVB);
    ctx.fillStyle = this.color;
    ctx.fill(this._path);

    // Glint effect
    const glintStart = wobbleEnd + this.glintStartDelay;
    const glintEnd = glintStart + this.glintDuration;

    if (this.introTimer >= glintStart && this.introTimer <= glintEnd) {
      const gT = (this.introTimer - glintStart) / this.glintDuration;
      const glintX = this._vbSize * (0.1 + 0.8 * gT);
      const gradient = ctx.createLinearGradient(glintX - 40, 0, glintX + 40, 0);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fill(this._path);
    }

    ctx.restore();
  }

  // ===========================================================================
  // 4. Gameplay Logic (placeholder)
  // ===========================================================================
  handleClick() { return false; }
  checkBoundary() { return false; }

  // ===========================================================================
  // 5. Scoring & Feedback (placeholder)
  // ===========================================================================
  onScoreUpdate(score) {}

  // ===========================================================================
  // 6. Skins & Effects (stub)
  // ===========================================================================
  applySkin(skin) {}

  // ===========================================================================
  // 7. Debugging Tools (stub)
  // ===========================================================================
  debugDraw(ctx) {}

 reset() {
  this.playIntro = true;
  this.introTimer = 0;
  this.isReadyToPlay = false;
}
// ===========================================================================
// 8. Structural Requirements
// ===========================================================================
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

}
