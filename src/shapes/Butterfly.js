// ============================================================================
// Shape: Butterfly  |  src/shapes/Butterfly.js
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

export class Butterfly extends Shape {
  // ===========================================================================
  // 1. Initialization
  // ===========================================================================
  constructor(x, y, size, _ignoredColor, name = 'Butterfly') {
    super(x, y, size, '#FF8C00');
    this.name = name;

    this._drawScale = 4.6;
    this._vbSize = 655.35999;
    this._halfVB = this._vbSize * 0.5;
    this.playIntro = true;
    this.introTimer = 0;
    this.introDuration = 2500;
    this.fadeInTime = 1200;
    this.glintStartDelay = 200;
    this.glintDuration = 600;
    this.isReadyToPlay = false;
    this.sequenceDone = false;
    this.objectiveCompleted = false;
    this._introCenterX = x;
    this._introCenterY = y;

    const d = `m 258.71999,464.1208 c -15.78347,-2.8469 -27.41901,-14.30632 -31.33248,-30.8582 -1.23927,-5.24145 -1.57798,-9.00805 -1.3762,-15.30385 0.35187,-10.97877 2.92296,-20.57594 8.41175,-31.39876 2.07737,-4.09616 5.48778,-9.56516 8.0034,-12.83439 0.77744,-1.01035 1.41353,-1.91993 1.41353,-2.0213 0,-0.10137 -0.39963,-0.18431 -0.88808,-0.18431 -1.50661,0 -9.96143,-1.56925 -13.68947,-2.54082 -7.2986,-1.90211 -14.23015,-5.02096 -18.28582,-8.2277 -4.53678,-3.58714 -10.23463,-10.69006 -12.02594,-14.99148 -1.35621,-3.25662 -1.61743,-5.11804 -1.42212,-10.13362 0.20239,-5.19707 0.45435,-6.26551 3.38385,-14.34901 3.07415,-8.48264 3.39593,-9.9462 3.37649,-15.35737 -0.0144,-4.00897 -0.13444,-5.07519 -0.88266,-7.84 -2.13555,-7.89125 -7.10376,-15.30377 -16.759,-25.00428 -8.13303,-8.17115 -14.45402,-15.90814 -19.3783,-23.71934 -4.84794,-7.69011 -8.79209,-17.21936 -9.95543,-24.05276 -0.64982,-3.81707 -0.66877,-10.44373 -0.0384,-13.4403 2.58967,-12.31087 12.08868,-20.56659 26.72491,-23.227 4.56876,-0.83046 14.09108,-0.99256 19.77825,-0.33668 18.41357,2.12355 38.51986,9.31315 59.59234,21.30902 2.38183,1.35589 5.90983,3.29771 7.84,4.31514 14.28774,7.53138 25.63841,15.10909 35.8294,23.91969 7.08902,6.12879 15.40645,15.21806 19.17086,20.94986 0.72003,1.09633 1.38114,1.99334 1.46914,1.99334 0.088,0 0.74912,-0.89701 1.46915,-1.99334 3.7644,-5.7318 12.08184,-14.82107 19.17085,-20.94986 9.91586,-8.57274 20.78924,-15.91562 33.79525,-22.8222 3.00156,-1.59392 7.42554,-4.01851 9.83107,-5.38797 6.77207,-3.85533 10.13406,-5.60991 15.12792,-7.89512 16.50962,-7.55483 30.73613,-11.85038 44.5075,-13.43856 5.68718,-0.65588 15.20949,-0.49378 19.77826,0.33668 14.63623,2.66041 24.13523,10.91613 26.7249,23.227 0.63035,2.99657 0.61141,9.62323 -0.0384,13.4403 -2.43937,14.32884 -12.69371,31.02562 -29.34413,47.78002 -9.66668,9.72705 -14.61492,17.11202 -16.7486,24.99636 -0.74822,2.76481 -0.86826,3.83103 -0.88266,7.84 -0.0194,5.41117 0.30235,6.87473 3.37649,15.35737 2.9295,8.0835 3.18147,9.15194 3.38385,14.34901 0.19532,5.01558 -0.0659,6.877 -1.42211,10.13362 -1.79131,4.30142 -7.48917,11.40434 -12.02594,14.99148 -4.05567,3.20674 -10.98723,6.32559 -18.28583,8.2277 -3.72804,0.97157 -12.18285,2.54082 -13.68946,2.54082 -0.48845,0 -0.88809,0.0829 -0.88809,0.18431 0,0.10137 0.63609,1.01095 1.41354,2.0213 2.51561,3.26923 5.92603,8.73823 8.00339,12.83439 5.4888,10.82282 8.05989,20.41999 8.41175,31.39876 0.269,8.39298 -0.76231,15.09874 -3.31331,21.54384 -10.02384,25.32518 -38.00115,32.65941 -64.10452,16.80494 -4.35586,-2.64563 -8.50216,-5.90832 -12.71889,-10.00838 -6.49368,-6.31403 -11.52744,-13.04699 -15.71454,-21.01916 -1.94104,-3.69571 -4.90569,-10.77865 -5.32412,-12.72 -0.12328,-0.572 -0.34527,-1.04 -0.4933,-1.04 -0.14803,0 -0.37001,0.468 -0.4933,1.04 -0.41842,1.94135 -3.38308,9.02429 -5.32412,12.72 -4.18709,7.97217 -9.22085,14.70513 -15.71454,21.01916 -12.328,11.98693 -26.58556,18.40816 -40.65984,18.31212 -2.31451,-0.0158 -5.3602,-0.2365 -6.7682,-0.49047 z`;
    this._path = new Path2D(d);
  }

  // ===========================================================================
  // 2. Intro Animation Helpers & State
  // ===========================================================================
  update(deltaTime) {
    if (!this.playIntro) return;

    this.introTimer += deltaTime;

    const totalTime = this.introDuration + this.glintStartDelay + this.glintDuration;
    if (this.introTimer >= totalTime) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}

  }

  // ===========================================================================
  // 3. Drawing Functions
  // ===========================================================================
  draw(ctx) {
    ctx.save();

    const alpha = Math.min(1, this.introTimer / this.fadeInTime);
    ctx.globalAlpha = alpha;

    let drawX = this._introCenterX;
    let drawY = this._introCenterY;
    let rotation = 0;

    if (this.introTimer < this.introDuration) {
      const t = this.introTimer / this.introDuration;
      const ease = t * t * (3 - 2 * t); // Smoothstep
      const theta = ease * 2 * Math.PI;

      const ampX = this.size * 3.2;
      const ampY = this.size * 2;

      drawX += Math.sin(theta) * ampX * (1 - ease * 0.3); // damped as it centers
      drawY += Math.sin(theta * 2) * ampY * 0.5 * (1 - ease * 0.3);

      const tiltAmount = Math.sin(theta * 1.5) * 0.3 * (1 - ease * 0.4); // smooth fade
      rotation = tiltAmount;
    }

    ctx.translate(drawX, drawY);
    ctx.rotate(rotation);

    const scale = (this.size * this._drawScale) / this._vbSize;
    ctx.scale(scale, scale);
    ctx.translate(-this._halfVB, -this._halfVB);
    ctx.fillStyle = this.color;
    ctx.fill(this._path);

    const glintStart = this.introDuration + this.glintStartDelay;
    const glintEnd = glintStart + this.glintDuration;

    if (this.introTimer >= glintStart && this.introTimer <= glintEnd) {
      const gT = (this.introTimer - glintStart) / this.glintDuration;
      const glintX = this._vbSize * (0.1 + 0.8 * gT);
      const gradient = ctx.createLinearGradient(glintX - 40, 0, glintX + 40, 0);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.7)');
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
resetSequence(level) {
  this.reset();
}

isSequenceCompleted() {
  return true;
}

}
