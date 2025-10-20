// ============================================================================
//  Shape: Square
//  File:   src/shapes/Square.js
// ----------------------------------------------------------------------------
//  Organized according to the standard blueprint:
//    1. Initialization
//    2. Intro Animation
//    3. Drawing Functions
//    4. Gameplay Logic
//    5. Scoring and Feedback (placeholder)
//    6. Skins and Effects   (stub)
//    7. Debugging Tools     (stub)
//    8. Structural Requirements
// ----------------------------------------------------------------------------

import { Shape } from './Shape.js';

// ---------------------------------------------------------------------------
//  Utility functions
// ---------------------------------------------------------------------------
function adjustColor(hex, amount) {
  let usePound = false;
  if (hex[0] === '#') {
    hex = hex.slice(1);
    usePound = true;
  }
  let num = parseInt(hex, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00ff) + amount;
  let b = (num & 0x0000ff) + amount;
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return (usePound ? '#' : '') + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  const bigint = parseInt(hex, 16);
  return { r: (bigint >> 16) & 0xff, g: (bigint >> 8) & 0xff, b: bigint & 0xff };
}
function rgbToHex(r, g, b) {
  return (
    '#' +
    ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)
  );
}
function mixColors(hex1, hex2, t) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex(c1.r * (1 - t) + c2.r * t, c1.g * (1 - t) + c2.g * t, c1.b * (1 - t) + c2.b * t);
}

// ---------------------------------------------------------------------------
//  Easing helpers
// ---------------------------------------------------------------------------
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

// ---------------------------------------------------------------------------
//  Class: Square
// ---------------------------------------------------------------------------
export class Square extends Shape {
  /* ========================================================================
   * 1. Initialization
   * ======================================================================*/
  constructor(x, y, size, color = '#13af51', name = 'Square') {
    super(x, y, size, color);
    this.name = name;

    // --- base geometry ----------------------------------------------------
    this.baseSize = size; // logical starting size (100 %)
    this.introStartScale = 2.0; // **200 %** scale for intro oversize
    this.size = size * this.introStartScale; // physical size starts oversize

    this.initialX = x;
    this.initialY = y;

    // --- growth & motion parameters --------------------------------------
    this.expansionRates = { 1: 0.01, 2: 0.02, 3: 0.02 }; // px/ms
    this.currentLevel = 1;
    this.expansionRate = this.expansionRates[this.currentLevel];
    this.movementRadius = 30; // circular motion radius (level 3)

    // --- level‑duration timers (ms) ---------------------------------------
    this.levelDurations = { 1: 60_000, 2: 120_000, 3: 180_000 }; // 1/2/3 min
    this.levelTimer = 0; // tracks elapsed time per level

    // --- guideline fade ---------------------------------------------------
    this.guidelineFade = 0; // 0‑>1 alpha multiplier
    this.guidelineDelay = 400; // ms after glint before fade starts
    this.guidelineFadeDuration = 600; // ms to reach full opacity
    this.guidelineTimer = 0; // internal timer after intro completes

    // --- visual feedback (shake on miss) ----------------------------------
    this.shakeDuration = 200;
    this.shakeTime = 0;
    this.shakeMagnitude = 5;

    // --- pulse‑sequence / state machine -----------------------------------
    this.mode = 'display'; // 'display' | 'input'
    this.displayTimer = 0;
    this.displayIndex = 0;
    this.pulseSequence = [];
    this.playerInput = [];

    // --- level‑transition helpers ----------------------------------------
    this.angle = 0; // for level‑3 orbit
    this.transitionProgress = 0; // fades from display‑>input markers

    // --- resize animation when sequence is correct -----------------------
    this.reducing = false; // true when shrinking after correct seq
    this.targetSize = this.size; // shrink target

    // --- Intro Animation settings ----------------------------------------
    this.playIntro = true;
    this.introTimer = 0;
    this.introDuration = 2500; // total intro ms
    this.fadeInTime = 1200; // fade‑in portion within intro
    this.glintTime = 1800; // glint sweep occurs at 1.8 s
    this.spinStart = this.fadeInTime; // movement starts when fade done
    this.spinDuration = this.glintTime - this.fadeInTime;
    this.isReadyToPlay = false;
    this.sequenceCompleted = false;

    // --- Gameplay penalties & bonuses ------------------------------------
    this.missSpeedMultiplier = 1.2;

    // initialize first sequence ------------------------------------------
    this.resetSequence(this.currentLevel, true);
  }

  /* ========================================================================
   * 2. Intro Animation
   * ======================================================================*/
  isIntroDone() {
    return !this.playIntro;
  }

  /* ========================================================================
   * 3. Drawing Functions
   * ======================================================================*/
  draw(ctx) {
    // ----- alpha fade (intro) -------------------------------------------
    if (this.playIntro && this.introTimer < this.fadeInTime) {
      ctx.globalAlpha = this.introTimer / this.fadeInTime;
    }

    // ----- position offsets (intro spin & shake) ------------------------
    let offsetX = 0;
    let offsetY = 0;
    if (this.playIntro && this.introTimer >= this.spinStart && this.introTimer < this.glintTime) {
      const t = (this.introTimer - this.spinStart) / this.spinDuration; // 0‑>1 within spin
      const segments = 4; // full square path
      const s = t * segments;
      const r = this.movementRadius;
      const ap = s - Math.floor(s); // local progress 0‑>1 within segment
      const ease = (1 - Math.cos(ap * Math.PI)) / 2; // smoothstep
      if (s < 1) offsetY = -r * ease;
      else if (s < 2) {
        offsetX = -r * ease;
        offsetY = -r;
      } else if (s < 3) {
        offsetX = -r;
        offsetY = -r + r * ease;
      } else {
        offsetX = -r + r * ease;
      }
    } else if (!this.playIntro && this.shakeTime > 0) {
      offsetX = (Math.random() - 0.5) * this.shakeMagnitude;
      offsetY = (Math.random() - 0.5) * this.shakeMagnitude;
    }
    const centerX = this.initialX + offsetX;
    const centerY = this.initialY + offsetY;

    // ----- clip to play area -------------------------------------------
    const paX = window.playAreaX ?? 100;
    const paY = window.playAreaY ?? 0;
    const paSize = window.playAreaSize ?? 600;

    ctx.save();
    ctx.resetTransform();
    ctx.beginPath();
    ctx.rect(paX, paY, paSize, paSize);
    ctx.clip();

    // ----- diagonal guidelines -----------------------------------------
    if (this.guidelineFade > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.15 * this.guidelineFade).toFixed(3)})`;
      ctx.lineWidth = 2;
      const L = paSize * 2;
      [45, 135, 225, 315].forEach((deg) => {
        const rad = (deg * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + L * Math.cos(rad), centerY + L * Math.sin(rad));
        ctx.stroke();
      });
    }

    ctx.restore();

    // ----- square fill --------------------------------------------------
    ctx.save();
    ctx.translate(centerX, centerY);
    const dark = adjustColor(this.color, -20);
    const light = adjustColor(this.color, 20);
    const mix = this.mode === 'input' ? this.transitionProgress : 0;
    ctx.fillStyle = mixColors(dark, light, mix);
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

    // ----- glint sweep --------------------------------------------------
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + 400
    ) {
      const t = (this.introTimer - this.glintTime) / 400; // 0‑>1 across square
      const gx = -this.size / 2 + this.size * t;
      const grad = ctx.createLinearGradient(gx - 12, 0, gx + 12, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    }

    // ----- pulse outline when displaying sequence ----------------------
    if (this.mode === 'display' && !this.playIntro) {
      const a = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      const elem = this.pulseSequence[this.displayIndex] || '';
      const h = this.size / 2;
      if (elem === 'top') {
        ctx.moveTo(-h, -h);
        ctx.lineTo(h, -h);
      } else if (elem === 'right') {
        ctx.moveTo(h, -h);
        ctx.lineTo(h, h);
      } else if (elem === 'bottom') {
        ctx.moveTo(-h, h);
        ctx.lineTo(h, h);
      } else if (elem === 'left') {
        ctx.moveTo(-h, -h);
        ctx.lineTo(-h, h);
      }
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ========================================================================
   * 4. Gameplay Logic
   * ======================================================================*/
  update(deltaTime, level) {
    // ---- level switch ---------------------------------------------------
    if (level !== this.currentLevel) {
      this.resetSequence(level, true);
    }

    // ---- intro animation progress --------------------------------------
    if (this.playIntro) {
      this.introTimer += deltaTime;

      // oversize held until spinStart
      if (this.introTimer < this.spinStart) {
        this.size = this.baseSize * this.introStartScale;
      } else {
        // then shrink swiftly to baseSize before intro ends
        const span = this.introDuration - this.spinStart;
        const tShrink = Math.min((this.introTimer - this.spinStart) / span, 1);
        const eased = easeOutQuad(tShrink);
        const currentScale = this.introStartScale - (this.introStartScale - 1) * eased;
        this.size = this.baseSize * currentScale;
      }

      // guidelines remain hidden during intro
      this.guidelineFade = 0;

      if (this.introTimer >= this.introDuration) {
        this.playIntro = false;
        this.isReadyToPlay = true;
        this.size = this.baseSize;
        this.guidelineTimer = 0;
        return;
      }

      return; // skip rest until intro completes
    }

    // ---- guideline fade timer (only once per level) --------------------
    if (this.guidelineFade < 1) {
      this.guidelineTimer += deltaTime;
      if (this.guidelineTimer > this.guidelineDelay) {
        const fadeT = (this.guidelineTimer - this.guidelineDelay) / this.guidelineFadeDuration;
        this.guidelineFade = Math.min(fadeT, 1);
      }
    }

    // ---- level timer ----------------------------------------------------
    this.levelTimer += deltaTime;

    // ---- growth & shrink logic -----------------------------------------
    if (this.reducing) {
      const lerp = 0.2;
      this.size += (this.targetSize - this.size) * lerp;
      if (Math.abs(this.size - this.targetSize) < 1) {
        this.size = this.targetSize;
        this.reducing = false;
        this.resetSequence(this.currentLevel, false);
      }
    } else {
      this.size += this.expansionRate * deltaTime;
    }

    // ---- orbital motion (level 3) --------------------------------------
    if (this.currentLevel === 3) {
      this.angle = (this.angle || 0) + 0.002 * deltaTime;
      this.x = this.initialX + this.movementRadius * Math.cos(this.angle);
      this.y = this.initialY + this.movementRadius * Math.sin(this.angle);
    } else {
      this.x = this.initialX;
      this.y = this.initialY;
    }

    // ---- shake decay ----------------------------------------------------
    if (this.shakeTime > 0) {
      this.shakeTime -= deltaTime;
      if (this.shakeTime < 0) this.shakeTime = 0;
    }

    // ---- sequence display / input state machine ------------------------
    if (this.mode === 'display') {
      this.displayTimer += deltaTime;
      if (this.displayTimer > 700) {
        this.displayTimer = 0;
        this.displayIndex++;
        if (this.displayIndex >= this.pulseSequence.length) {
          this.mode = 'input';
          this.playerInput = [];
          this.transitionProgress = 0;
        }
      }
    }

    // ---- fade markers during input -------------------------------------
    if (this.mode === 'input' && this.transitionProgress < 1) {
      this.transitionProgress = Math.min(1, this.transitionProgress + deltaTime / 300);
    }
  }

  /* ========================================================================
   * Boundary / Input Handling (logic mostly unchanged)
   * ======================================================================*/
  checkBoundary(playAreaX, playAreaY, playAreaSize) {
    if (this.currentLevel === 3) return false; // no boundary fail on level 3
    const half = this.size / 2;
    return (
      this.x - half < playAreaX ||
      this.x + half > playAreaX + playAreaSize ||
      this.y - half < playAreaY ||
      this.y + half > playAreaY + playAreaSize
    );
  }

  handleClick(x, y) {
    if (this.mode !== 'input' || this.playIntro) return false;

    // determine quadrant --------------------------------------------------
    const dx = x - this.x;
    const dy = this.y - y;
    let ad = Math.atan2(dy, dx) * (180 / Math.PI);
    if (ad < 0) ad += 360;
    let quad = '';
    if (ad >= 45 && ad < 135) quad = 'top';
    else if (ad >= 135 && ad < 225) quad = 'left';
    else if (ad >= 225 && ad < 315) quad = 'bottom';
    else quad = 'right';

    this.playerInput.push(quad);

    // local completion check (4 taps) ------------------------------------
    const localComplete = this.playerInput.length === 4;
    if (localComplete) {
      const correct = this.playerInput.every((v, i) => v === this.pulseSequence[i]);
      if (correct) {
        // shrink effect only; level persists until timer ends
        this.reducing = true;
        this.targetSize = this.size * 0.5;
      } else {
        this.shakeTime = this.shakeDuration;
        this.expansionRate *= this.missSpeedMultiplier;
        this.resetSequence(this.currentLevel, false);
      }
    }
    return true;
  }

  isLevelComplete() {
    return this.levelTimer >= this.levelDurations[this.currentLevel];
  }
  /* ========================================================================
   * 5. Scoring & Feedback (placeholder)
   * ======================================================================*/

  /* ========================================================================
   * 6. Skins and Effects (stub)
   * ======================================================================*/

  /* ========================================================================
   * 7. Debugging Tools (stub)
   * ======================================================================*/

  reset() {
    this.x = this.initialX;
    this.y = this.initialY;
    this.size = this.baseSize;
    this.angle = 0;
    this.levelTimer = 0;
    // keep guidelines visible across in‑level resets
    this.resetSequence(this.currentLevel, false);
  }

  resetSequence(level, isNewLevel = false) {
    this.currentLevel = level;
    this.expansionRate = this.expansionRates[level];
    this.pulseSequence = this.shuffleArray(['top', 'right', 'bottom', 'left']);
    this.mode = 'display';
    this.displayIndex = 0;
    this.displayTimer = 0;
    this.playerInput = [];
    this.levelTimer = 0;
    this.isReadyToPlay = false;
    this.sequenceCompleted = false;

    if (isNewLevel) {
      // reset guidelines only on new level, not in‑level resets
      this.guidelineFade = 0;
      this.guidelineTimer = 0;

      // restart intro sequence
      this.size = this.baseSize * this.introStartScale;
      this.targetSize = this.size;
      this.reducing = false;
      this.playIntro = true;
      this.introTimer = 0;
    }
  }

  shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // ---------------------------------------------------------------------------
  // 8. Structural Requirements
  // ---------------------------------------------------------------------------
  get behaviorType() {
    return 'sequence';
  }

  isReady() {
    return !this.playIntro;
  }

  isSequenceCompleted() {
    return this.isLevelComplete(); // use existing method for duration
  }

  onStart() {}
  onComplete() {}
  onFail() {}
} // end class Square
