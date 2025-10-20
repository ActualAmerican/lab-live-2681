// ============================================================================
// Shape: Key  |  src/shapes/Key.js
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

export class Key extends Shape {
  // ===========================================================================
  // 1. Initialization
  // ===========================================================================
  constructor(x, y, size, _ignoredColor, name = 'Key') {
    super(x, y, size, '#c07245ff');
    this.name = name;

    this._drawScale = 4.2;
    this._vbSize = 655.35999;
    this._halfVB = this._vbSize / 2;
    this.sequenceDone = false;
    this.playIntro = true;
    this.introTimer = 0;
    this.introDuration = 2200;
    this.fadeInTime = 1000;
    this.glintStartDelay = 300;
    this.glintDuration = 600;
    this.isReadyToPlay = false;
    this.objectiveCompleted = false;


    const d = `m 324.75736,527.01587 c -5.19169,-0.55047 -9.621,-2.33247 -12.50667,-5.03167 -2.91495,-2.72659 -2.95614,-2.88923 -3.07049,-12.12146 -0.0741,-5.9817 -0.20351,-8.14332 -0.50243,-8.3914 -0.27109,-0.22499 -9.43808,-0.3631 -28.0602,-0.42275 l -27.65758,-0.0886 -1.35886,-0.75172 c -6.50957,-3.60106 -9.76573,-16.16326 -6.77044,-26.12021 1.21835,-4.05004 3.56262,-7.6901 5.87161,-9.11713 2.59198,-1.60193 2.6142,-1.60308 31.26037,-1.60714 l 26.76268,-0.004 0.19295,-0.72 c 0.31981,-1.19337 0.21846,-18.27798 -0.11153,-18.8 -0.26402,-0.41767 -2.87085,-0.48394 -20.0751,-0.51036 -10.87442,-0.0167 -20.27568,-0.14228 -20.89168,-0.27906 -3.98784,-0.88547 -7.33762,-5.05047 -9.01631,-11.21058 -1.0026,-3.6791 -1.00386,-11.04811 -0.003,-14.68393 0.98552,-3.57838 2.50135,-6.42327 4.53882,-8.51839 2.92654,-3.00933 1.79041,-2.87768 24.83415,-2.87768 17.68255,0 19.97662,-0.0565 20.423,-0.50286 0.45425,-0.45425 0.50285,-7.6917 0.50285,-74.88685 v -74.38401 l -0.72,-0.29146 c -0.396,-0.1603 -2.448,-0.58322 -4.56,-0.93981 -4.99695,-0.8437 -14.07973,-3.43225 -19.17291,-5.4642 -11.76022,-4.6918 -21.00973,-10.59145 -28.85172,-18.40262 -9.05674,-9.02115 -13.98198,-17.66538 -16.50527,-28.96818 -0.64711,-2.89871 -0.7497,-4.2167 -0.74719,-9.6 0.004,-8.29295 0.8031,-12.30284 3.95988,-19.86711 8.78506,-21.05073 33.50104,-37.97399 62.75721,-42.97042 8.69155,-1.48436 10.84785,-1.64247 22.4,-1.64247 11.55216,0 13.70845,0.15811 22.4,1.64247 21.29535,3.63686 40.72271,13.70712 52.55562,27.24242 7.21942,8.25807 11.42795,16.36486 13.42322,25.85683 0.62151,2.95668 0.73581,4.46434 0.73826,9.73828 0.002,5.3833 -0.10008,6.70129 -0.7472,9.6 -2.52328,11.3028 -7.44853,19.94703 -16.50527,28.96818 -6.18943,6.16511 -12.40263,10.56979 -20.96212,14.86053 -8.09375,4.05728 -18.70073,7.57664 -27.38251,9.08544 l -4.16,0.72296 -0.16,130.70144 c -0.13581,110.94357 -0.22765,130.87075 -0.6075,131.82144 -1.49573,3.74345 -5.50724,6.77314 -10.81235,8.16603 -1.64844,0.43281 -7.09378,1.16377 -7.94015,1.06586 -0.176,-0.0204 -1.41918,-0.15357 -2.76263,-0.29601 z m 10.33327,-299.68705 c 19.12297,-2.47511 34.96227,-14.18663 38.34574,-28.35271 1.25134,-5.23916 1.14657,-9.28372 -0.37553,-14.49611 -4.546,-15.5677 -23.78984,-27.3409 -44.90085,-27.46991 -22.35133,-0.1366 -42.51689,12.93151 -46.078,29.86041 -0.61081,2.90371 -0.61059,8.15 4.8e-4,11.03464 2.4694,11.65729 12.55191,21.59705 27.03752,26.65474 8.55452,2.98683 17.18113,3.90658 25.97064,2.76894 z`;
    this._path = new Path2D(d);
  }

  // ===========================================================================
  // 2. Intro Animation Helpers & State
  // ===========================================================================
  update(deltaTime) {
    if (!this.playIntro) return;
    this.introTimer += deltaTime;
    const total = this.introDuration + this.glintStartDelay + this.glintDuration;
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

    const alpha = Math.min(1, this.introTimer / this.fadeInTime);
    ctx.globalAlpha = alpha;

    const t = Math.min(1, this.introTimer / this.introDuration);
    const swingPhase = t * 5 * Math.PI; // ~2.5 full cycles
    const decay = 1 - t;
    const swingAngle = Math.sin(swingPhase) * 0.65 * decay; // up to ~37°, damped

    ctx.translate(this.x, this.y);
    ctx.rotate(swingAngle);

    const scale = (this.size * this._drawScale) / this._vbSize;
    ctx.scale(scale, scale);
    ctx.translate(-this._halfVB, -this._halfVB);

    ctx.fillStyle = this.color;
    ctx.fill(this._path);

    // Glint
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
  this.objectiveCompleted = false;
}
// ===========================================================================
// 8. Structural Requirements
// ===========================================================================
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
