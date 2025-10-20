// ============================================================================
// Shape: Ellipse  |  src/shapes/Ellipse.js
// ----------------------------------------------------------------------------
// 1. Initialization
// 2. Intro Animation
// 3. Drawing Functions
// 4. Gameplay Logic (placeholder)
// 5. Scoring & Feedback (placeholder)
// 6. Skins & Effects (stub)
// 7. Debugging Tools (stub)
// 8. Structural Requirements
// ============================================================================

import { Shape } from "./Shape.js";

// --------------------------------------------------
// 1. Initialization
// --------------------------------------------------
export class Ellipse extends Shape {
  constructor(x, y, size, _ignoredColor, name = "Ellipse") {
    // Call parent constructor with cyan fill and slightly smaller size
    const scale = 0.78; // slightly smaller than before
    const adjustedSize = size * scale;
    super(x, y, adjustedSize, '#00FFFF');
    this.name = name;

    // ------------ Geometry (vertical oval) ------------
    this.baseSize = adjustedSize;
    this.radiusX  = adjustedSize * 1.15;
    this.radiusY  = adjustedSize * 1.35;

    // ------------ Intro timing / movement ------------
    this.playIntro   = true;
    this.introTimer  = 0;
    this.fadeInTime  = 900;

    this.hopDuration   = 400;
    this.hopArcHeight  = adjustedSize * 0.7;
    this.hopTiltAmp    = 0.50;

    this.hopOffsets  = [ -adjustedSize * 2.2, 0, adjustedSize * 2.2 ];
    this.hopSequence = [ 1, 0, 1, 2, 0, 1 ];
    this.hopIndex    = 0;
    this.hopTimer    = 0;

    const hopsCount   = this.hopSequence.length - 1;
    const hopSpan     = this.hopDuration * hopsCount;
    const glintOffset = 0;
    this.glintDuration = 400;
    this.glintTime     = this.fadeInTime + hopSpan + glintOffset;
    this.introDoneTime = this.glintTime + this.glintDuration;

    this._introPos = { x: this.x, y: this.y };
    this._introRot = 0;
    this._currentAlpha = 0;
    this.isReadyToPlay = false;
    this.objectiveCompleted = false;

  }

  // --------------------------------------------------
  // 2. Intro Animation (update)
  // --------------------------------------------------
  update(deltaTime) {
    if (this.playIntro) {
      this.introTimer += deltaTime;
      this._currentAlpha = Math.min(1, this.introTimer / this.fadeInTime);

      if (this.hopIndex < this.hopSequence.length) {
        this.hopTimer += deltaTime;
        const tRaw = Math.min(1, this.hopTimer / this.hopDuration);
        const ease = tRaw < 0.5
          ? 4 * tRaw * tRaw * tRaw
          : 1 - Math.pow(-2 * tRaw + 2, 3) / 2;

        const idxA   = this.hopSequence[this.hopIndex];
        const idxB   = this.hopIndex + 1 < this.hopSequence.length ? this.hopSequence[this.hopIndex + 1] : idxA;
        const startX = this.hopOffsets[idxA];
        const endX   = this.hopOffsets[idxB];

        const offX = startX + (endX - startX) * ease;
        const arcY = -this.hopArcHeight * Math.sin(Math.PI * ease);
        this._introPos.x = this.x + offX;
        this._introPos.y = this.y + arcY;

        const dir = endX - startX === 0 ? 0 : (endX > startX ? 1 : -1);
        this._introRot = -this.hopTiltAmp * Math.sin(Math.PI * ease) * dir;

        if (this.hopTimer >= this.hopDuration) {
          this.hopTimer = 0;
          this.hopIndex += 1;
        }
      }

      if (this.introTimer >= this.introDoneTime) {
  this.playIntro = false;
  this.isReadyToPlay = true;
}
    }
  }

  // --------------------------------------------------
  // 3. Drawing Functions
  // --------------------------------------------------
  draw(ctx) {
    ctx.save();

    let drawX = this.x,
        drawY = this.y,
        alpha = 1,
        rot   = 0;
    if (this.playIntro) {
      drawX = this._introPos.x;
      drawY = this._introPos.y;
      alpha = this._currentAlpha;
      rot   = this._introRot;
    }

    ctx.translate(drawX, drawY);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + this.glintDuration
    ) {
      const t = (this.introTimer - this.glintTime) / this.glintDuration;
      const glintX = -this.radiusX + this.radiusX * 2 * t;
      const grad = ctx.createLinearGradient(glintX - 20, 0, glintX + 20, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.65)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // --------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // --------------------------------------------------

  // --------------------------------------------------
  // 5. Scoring & Feedback (placeholder)
  // --------------------------------------------------

  // --------------------------------------------------
  // 6. Skins & Effects (stub)
  // --------------------------------------------------

  // --------------------------------------------------
  // 7. Debugging Tools (stub)
  // --------------------------------------------------
  reset() {
  this.playIntro = true;
  this.introTimer = 0;
  this.hopIndex = 0;
  this.hopTimer = 0;
  this._introRot = 0;
  this._introPos = { x: this.x, y: this.y };
  this._currentAlpha = 0;
  this.isReadyToPlay = false;
  this.objectiveCompleted = false;
}
// --------------------------------------------------
// 8. Structural Requirements
// --------------------------------------------------
get behaviorType() {
  return 'objective';
}

isReady() {
  return !this.playIntro;
}

isSequenceCompleted() {
  return this.objectiveCompleted ?? false;
}

}
