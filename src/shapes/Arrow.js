// ============================================================================
// Shape: Arrow  |  src/shapes/Arrow.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    0. Utility Functions (shared helpers)
//    1. Initialization
//    2. Intro Animation Helpers & State
//    3. Drawing Functions
//    4. Gameplay Logic
//    5. Scoring & Feedback (placeholder)
//    6. Skins & Effects (stub)
//    7. Debugging Tools (stub)
//    8. Structural Requirements
// ============================================================================

// ---------------------------------------------------------------------------
// 0. Utility Functions
// ---------------------------------------------------------------------------
/** Smooth S‑curve easing (smoother‑step) */
import { Shape } from './Shape.js';

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class Arrow {
  /**
   * Arrow shape – swims in like a fish; click / tap rotates it 90° CCW.
   */
  constructor(_x, _y, size, _ignoredColor, name = 'Arrow') {
    // ----- Cached play‑area bounds -----
    const paX = window.playAreaX ?? 100;
    const paY = window.playAreaY ?? 0;
    const paS = window.playAreaSize ?? 600;
    const cx = paX + paS / 2;
    const cy = paY + paS / 2;

    // ----- Geometry & display -----
    this.size = size;
    this.color = '#FF91A4';
    this.name = name;

    // Tail starts at play‑area center
    this.initialX = cx - size;
    this.initialY = cy;
    this.x = this.initialX;
    this.y = this.initialY;

    // Movement / rotation
    this.angle = 0; // current orientation
    this.targetAngle = 0; // snaps in 90° steps
    this.angularSpeed = 0.02; // rad per ms
    this.baseSpeed = 0.2; // px per ms
    this.speed = this.baseSpeed;

    this.glintDuration = 600;
    this.sequenceDone = false;
    this.objectiveCompleted = false;

    this.currentLevel = 1;
    this.playIntro = true;
    this.isReadyToPlay = false;
    this.introTimer = 0;
    this.introDuration = 2500; // total timeline
    this.fadeInTime = 1200; // fade period
    this.glintTime = 1800; // glint start (400 ms window)

    // Intro swim state cache
    this._introSwimLast = { x: 0, y: 0, rot: 0 };
    this.isReadyToPlay = false;
  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers & State
  // -------------------------------------------------------------------------
  /**
   * Update `_introSwimLast` to create a more pronounced fish‑like ripple.
   * Horizontal glide from off‑screen left → center with 4 wave cycles whose
   * amplitude starts at 35 % of size and decays to 0 by arrival.
   */
  _updateIntroSwim() {
    const swimEnd = this.glintTime - 260; // stop just before glint
    const tRaw = this.introTimer / swimEnd;
    const tClamp = Math.max(0, Math.min(1, tRaw));
    const ease = tClamp * tClamp * (3 - 2 * tClamp); // smoother‑step

    // Horizontal interpolation
    const startX = this.initialX - this.size * 4.5;
    const endX = this.initialX;
    const posX = startX + (endX - startX) * ease;

    // Vertical ripple (4 diminishing waves)
    const waves = 4;
    const amp0 = this.size * 0.35; // 35 % of size
    const ripple = amp0 * Math.sin(ease * Math.PI * waves) * (1 - ease);

    // Nose tilts with ripple phase
    const tiltAmp = Math.PI / 14; // ~13° max
    const tilt = tiltAmp * Math.sin(ease * Math.PI * waves) * (1 - ease);

    this._introSwimLast = {
      x: posX - this.initialX,
      y: ripple,
      rot: tilt,
    };
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    const paX = window.playAreaX ?? 100;
    const paY = window.playAreaY ?? 0;
    const paS = window.playAreaSize ?? 600;

    ctx.save();
    ctx.beginPath();
    ctx.rect(paX, paY, paS, paS);
    ctx.clip();

    // ---- Compute transform ----
    let drawX = this.x;
    let drawY = this.y;
    let drawRot = this.angle;

    if (this.playIntro) {
      ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);
      drawX = this.initialX + this._introSwimLast.x;
      drawY = this.initialY + this._introSwimLast.y;
      drawRot = this._introSwimLast.rot;
    }

    // ---- Arrow polygon ----
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(drawRot);
    ctx.fillStyle = this.color;

    const ef = this.size * 2;
    const bl = ef * 0.6;
    const ah = ef * 0.3;
    const hw = ef * 0.7;
    const pts = [
      { x: 0, y: -ah / 2 },
      { x: bl, y: -ah / 2 },
      { x: bl, y: -hw / 2 },
      { x: ef, y: 0 },
      { x: bl, y: hw / 2 },
      { x: bl, y: ah / 2 },
      { x: 0, y: ah / 2 },
    ];

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();

    // ---- Perimeter glint ----
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + 400
    ) {
      let perim = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        perim += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
      }
      const dashLen = perim * 0.15;
      const offset = perim * ((this.introTimer - this.glintTime) / 400);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.setLineDash([dashLen, perim]);
      ctx.lineDashOffset = -offset;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore(); // arrow transform
    ctx.restore(); // clip rect
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic
  // -------------------------------------------------------------------------
  update(deltaTime, level) {
    // Restart intro on level change
    if (level !== this.currentLevel) {
      this.currentLevel = level;
      this.reset();
    }

    // Intro phase
    if (this.playIntro) {
      this.introTimer += deltaTime;
      const swimEnd = this.glintTime - 260;
      if (this.introTimer < swimEnd) this._updateIntroSwim();
      else this._introSwimLast = { x: 0, y: 0, rot: 0 };
      if (this.introTimer >= this.introDuration) {
        this.playIntro = false;
        this.isReadyToPlay = true;
      }

      return; // skip gameplay during intro
    }

    // Adjust speed by level
    this.speed = this.baseSpeed * (level === 2 ? 1.5 : level === 3 ? 2 : 1);

    // Smoothly rotate toward targetAngle
    const maxDelta = this.angularSpeed * deltaTime;
    let diff = ((this.targetAngle - this.angle + Math.PI) % (2 * Math.PI)) - Math.PI;
    if (Math.abs(diff) <= maxDelta) this.angle = this.targetAngle;
    else this.angle += Math.sign(diff) * maxDelta;

    // Move forward
    const d = this.speed * deltaTime;
    this.x += Math.cos(this.angle) * d;
    this.y += Math.sin(this.angle) * d;
  }

  // Handle click / tap -------------------------------------------------------
  handleClick() {
    this.targetAngle = (this.targetAngle - Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
    return true;
  }

  // -------------------------------------------------------------------------
  // Helper: Polygon points & Boundary check
  // -------------------------------------------------------------------------
  getArrowPolygonPoints() {
    const ef = this.size * 2,
      bl = ef * 0.6,
      ah = ef * 0.3,
      hw = ef * 0.7;
    const pts = [
      { x: 0, y: -ah / 2 },
      { x: bl, y: -ah / 2 },
      { x: bl, y: -hw / 2 },
      { x: ef, y: 0 },
      { x: bl, y: hw / 2 },
      { x: bl, y: ah / 2 },
      { x: 0, y: ah / 2 },
    ];
    const c = Math.cos(this.angle),
      s = Math.sin(this.angle);
    return pts.map((p) => ({ x: this.x + p.x * c - p.y * s, y: this.y + p.x * s + p.y * c }));
  }

  checkBoundary(px, py, ps) {
    const poly = this.getArrowPolygonPoints();
    const allL = poly.every((pt) => pt.x < px),
      allR = poly.every((pt) => pt.x > px + ps);
    const allT = poly.every((pt) => pt.y < py),
      allB = poly.every((pt) => pt.y > py + ps);
    return allL || allR || allT || allB;
  }

  // -------------------------------------------------------------------------
  // Reset -------------------------------------------------------------------
  reset() {
    const paX = window.playAreaX ?? 100,
      paY = window.playAreaY ?? 0,
      ps = window.playAreaSize ?? 600;
    const cx = paX + ps / 2,
      cy = paY + ps / 2;
    this.initialX = cx - this.size;
    this.initialY = cy;
    this.x = this.initialX;
    this.y = this.initialY;
    this.angle = 0;
    this.targetAngle = 0;
    this.speed = this.baseSpeed;
    this.playIntro = true;
    this.introTimer = 0;
    this._introSwimLast = { x: 0, y: 0, rot: 0 };
  }

  resetSequence(level) {
    this.currentLevel = level;
    this.reset();
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

  forceComplete() {
    console.log(`🛠️ Forcing completion of Arrow`);
    this.playIntro = false;
    this.isReadyToPlay = true;
    this.sequenceDone = true; // Because Arrow is a survival shape
    // Optional: Stop arrow movement or clean up trails here if needed
  }

  // -------------------------------------------------------------------------
  // 5. Scoring & Feedback (placeholder)
  // -------------------------------------------------------------------------
  // TODO: add score logic

  // -------------------------------------------------------------------------
  // 6. Skins & Effects (stub)
  // -------------------------------------------------------------------------
  // TODO: implement different arrow skins

  // -------------------------------------------------------------------------
  // 7. Debugging Tools (stub)
  // -------------------------------------------------------------------------
  // TODO: debug rendering helpers
}
