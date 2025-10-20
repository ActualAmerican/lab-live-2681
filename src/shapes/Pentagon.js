// ============================================================================
// Shape: Pentagon  |  src/shapes/Pentagon.js
// ----------------------------------------------------------------------------
//  Blueprint Sections
//    1. Initialization
//    2. Intro Animation Helpers
//    3. Drawing Functions
//    4. Gameplay Logic
//    5. Scoring & Feedback (placeholder)
//    6. Skins & Effects (stub)
//    7. Debugging Tools (stub)
//    8. Structural Requirements
// ============================================================================

import { Shape } from './Shape.js';

// ---------------------------------------------------------------------------
// Utility Classes & Functions (support for all sections)
// ---------------------------------------------------------------------------
class Platform {
  constructor(x, y, width, height, speed, color = '#228B22') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.color = color;
    this.glintDuration = 600;
    this.sequenceDone = false;
    this.objectiveCompleted = false;
  }
  update(deltaTime) {
    this.y += this.speed * deltaTime;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
// Smoother easing (easeInOutSine)
function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class Pentagon extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Pentagon') {
    super(x, y, size, '#7CFC00');
    this.name   = name;
    this.startX = x;
    this.startY = y;

    // --- Play‑area cache ----------------------------------------------------
    this.playArea = {
      x:    window.playAreaX   ?? 100,
      y:    window.playAreaY   ?? 0,
      size: window.playAreaSize?? 600
    };

    // --- Intro state --------------------------------------------------------
    this.playIntro     = true;
    this.introTimer    = 0;
    this.introDuration = (window.EDGE_VEIL_MS || 3000);
    this.fadeInTime    = 1200; // keep for piece glints only; base/platform won't fade
    this.glintTime     = 1800;

    // --- Physics ------------------------------------------------------------
    this.vy         = 0;
    this.gravity    = 0.002;
    this.isCharging = false;
    this.chargeTime = 0;
    this.maxCharge  = 1000;
    this.jumpFactor = 0.005;
    this.isJumping  = false;
    this.scaleX     = 1;
    this.scaleY     = 1;

    // Calculate apothem (distance from center to side)
    this.apothem = size * Math.cos(Math.PI / 5) - 2;

    // --- Platform tracking --------------------------------------------------
    this.borderHeight          = Math.max(1, window.playAreaBorderPx || 2);
    this.platformHeight        = 12;
    this.platforms             = [];
    this.platformSpawnTimer    = 0;
    this.platformSpawnInterval = 1200;
    this.currentSpeed          = 0;
    this.basePlatform          = null;
    this.currentPlatform       = null;
    this.shouldLaunchBase      = false;
    this.initialFall           = false;
    this.initialLaunched       = false;

    // Create initial base platform
    const { x: ax, y: ay, size: asz } = this.playArea;
    const baseY = ay + asz - this.borderHeight;
    this.basePlatform = new Platform(ax, baseY, asz, this.borderHeight, 0, '#FFFFFF');
    this.platforms.push(this.basePlatform);
    this.groundY = baseY - this.apothem;
    this.isReadyToPlay = false;
    this.sequenceDone = false;
    this.objectiveCompleted = false;
    
    // ── Outro: base platform returns to thin bottom edge
this.outroActive   = false;
this.outroTimer    = 0;
this.outroDuration = (window.EDGE_VEIL_OUTRO_PADDLE_MS || window.EDGE_VEIL_OUTRO_MS || 180);
this._outroFromW   = 0;
this._outroFromH   = 0;
this._outroFromX   = 0;

// Start the platform outro when this shape completes
const bus = window.bus;
if (bus) {
  this._onShapeComplete = () => { this.startOutro(); };
  bus.on('shape:complete', this._onShapeComplete);
}
    // Input listeners --------------------------------------------------------
    window.addEventListener('mousedown', () => this.handleMouseDown());
    window.addEventListener('mouseup',   () => this.handleMouseUp());
  }

  // -------------------------------------------------------------------------
  // 2. Intro Animation Helpers
  // -------------------------------------------------------------------------
  /**
   * Compute offsets & squash values for bouncy left/right hop intro.
   * Adds counter‑tilt rotation like Ellipse intro.
   * @returns {{ox:number, oy:number, sx:number, sy:number, rot:number}}
   */
  getIntroOffsets() {
    // Timings (ms)
    const hopDuration    = 440;
    const settleDuration = 180;
    const hopPause       = 65;
    const hop1Start      = 250;
    const hop1End        = hop1Start + hopDuration;
    const settle1Start   = hop1End;
    const settle1End     = settle1Start + settleDuration;
    const hop2Start      = settle1End + hopPause;
    const hop2End        = hop2Start + hopDuration;
    const settle2Start   = hop2End;
    const settle2End     = settle2Start + settleDuration;

    // Motion constants
    const squishAmt  = 0.24;
    const hopDist    = this.size * 1.13;
    const hopHeight  = this.size * 0.68;
    const hopTiltAmp = 0.5; // rad ~29°

    // Defaults
    let ox = 0, oy = 0, sx = 1, sy = 1, rot = 0;

    // Helper for squash
    const applySquish = (t) => {
      const q = easeInOutSine(t);
      sy = 1 - squishAmt * q;
      sx = 1 + squishAmt * q;
    };

    // First hop (left)
    if (this.introTimer >= hop1Start && this.introTimer < hop1End) {
      const t   = (this.introTimer - hop1Start) / hopDuration;
      const arc = easeInOutSine(t);
      ox  = -hopDist * arc;
      oy  = -hopHeight * Math.sin(Math.PI * arc);
      rot =  hopTiltAmp * Math.sin(Math.PI * arc); // tilt right (CW) opposite move left
      if (t < 0.22) applySquish(t / 0.22);
      else if (t > 0.77) applySquish(1 - (t - 0.77) / 0.23);
    }
    // Settle after hop 1
    else if (this.introTimer >= settle1Start && this.introTimer < settle1End) {
      const t = easeInOutSine((this.introTimer - settle1Start) / settleDuration);
      ox = -hopDist * (1 - t);
    }
    // Second hop (right)
    else if (this.introTimer >= hop2Start && this.introTimer < hop2End) {
      const t   = (this.introTimer - hop2Start) / hopDuration;
      const arc = easeInOutSine(t);
      ox  = hopDist * arc;
      oy  = -hopHeight * Math.sin(Math.PI * arc);
      rot = -hopTiltAmp * Math.sin(Math.PI * arc); // tilt left (CCW) opposite move right
      if (t < 0.22) applySquish(t / 0.22);
      else if (t > 0.77) applySquish(1 - (t - 0.77) / 0.23);
    }
    // Settle after hop 2
    else if (this.introTimer >= settle2Start && this.introTimer < settle2End) {
      const t = easeInOutSine((this.introTimer - settle2Start) / settleDuration);
      ox = hopDist * (1 - t);
    }

    return { ox, oy, sx, sy, rot };
  }

  // -------------------------------------------------------------------------
  // 3. Drawing Functions
  // -------------------------------------------------------------------------
  draw(ctx) {
    const { x: ax, y: ay, size: asz } = this.playArea;
    ctx.save();

    const introProg = Math.min(1, this.introTimer / this.introDuration);

    // Draw platforms or intro morph platform
    if (this.playIntro) {
      const t     = introProg;
      const minW  = asz;
      const maxW  = this.size * 2 * 1.3;
      const currW = minW + (maxW - minW) * t;
      const currX = ax + (asz - currW) / 2;
      const minH  = this.borderHeight;
      const maxH  = this.platformHeight;
      const currH = minH + (maxH - minH) * t;
      const currY = ay + asz - currH;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(currX, currY, currW, currH);
      ctx.fillRect(currX, currY, currW, currH);
    } else {
      this.platforms.forEach(p => p.draw(ctx));
    }

    // Compute sprite transform values
    let drawX = this.x, drawY = this.y, sx = this.scaleX, sy = this.scaleY, rot = 0;
    if (this.playIntro) {
      const intro = this.getIntroOffsets();
      drawX = this.startX + intro.ox;
      drawY = this.startY + intro.oy;
      sx    = intro.sx;
      sy    = intro.sy;
      rot   = intro.rot;
    }

    // Draw pentagon
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(rot);      // apply counter-tilt
    ctx.scale(sx, sy);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a  = -Math.PI / 2 + i * (2 * Math.PI / 5);
      const px = this.size * Math.cos(a);
      const py = this.size * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Intro glint (unchanged)
    if (
      this.playIntro &&
      this.introTimer >= this.glintTime &&
      this.introTimer < this.glintTime + 400
    ) {
      ctx.save();
      ctx.translate(drawX, drawY);
      const g  = (this.introTimer - this.glintTime) / 400;
      const gx = -this.size + 2 * this.size * g;
      const grad = ctx.createLinearGradient(gx - 12, 0, gx + 12, 0);
      grad.addColorStop(0,   'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a2  = -Math.PI / 2 + i * (2 * Math.PI / 5);
        const px2 = this.size * Math.cos(a2);
        const py2 = this.size * Math.sin(a2);
        if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      }
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = grad;
      ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 4. Gameplay Logic
  // -------------------------------------------------------------------------

  startOutro() {
  if (this.outroActive) return;
  this.outroActive = true;
  this.outroTimer  = 0;

  // Capture current base platform rect as the starting shape
  const p = this.basePlatform || { x: this.playArea.x, y: this.playArea.y + this.playArea.size - this.platformHeight, width: this.size * 2 * 1.3, height: this.platformHeight };
  this._outroFromW = p.width;
  this._outroFromH = p.height;
  this._outroFromX = p.x;
}

  update(deltaTime, level) {
    const { x: ax, y: ay, size: asz } = this.playArea;

    // Intro progression
    if (this.playIntro) {
      this.introTimer += deltaTime;
      if (this.introTimer >= this.introDuration) {
  this.playIntro       = false;
  this.isReadyToPlay   = true;
  this.isJumping       = true;
  this.initialFall     = true;
    // ensure the veil is fully closed *this frame*
  const bus = window.bus;
  bus && bus.emit('playArea/finishEdgeMasks');

        // Morph base platform when intro ends
        const normalW = this.size * 2;
        const finalW  = normalW * 1.3;
        const finalX  = ax + (asz - finalW) / 2;
        const finalY  = ay + asz - this.platformHeight;
        this.basePlatform    = new Platform(finalX, finalY, finalW, this.platformHeight, 0, '#FFFFFF');
        this.platforms       = [this.basePlatform];
        this.currentPlatform = null;
        this.groundY         = finalY - this.apothem;
      }
      return; // stop gameplay during intro
    }
// ── Platform outro morph: platform → thin bottom edge
if (this.outroActive) {
  this.outroTimer += deltaTime;
  const t = Math.min(1, this.outroTimer / this.outroDuration);
  // easeInOut (same feel as veil/paddle outros)
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  // lerp geometry toward the bottom edge (full width, thin height, centered)
  const { x: ax, y: ay, size: asz } = this.playArea;
  const targetW = asz;
  const targetH = this.borderHeight;
  const w = this._outroFromW + (targetW - this._outroFromW) * e;
  const h = this._outroFromH + (targetH - this._outroFromH) * e;
  const x = this._outroFromX + ((ax + (asz - targetW) / 2) - this._outroFromX) * e;
  const y = ay + asz - h;

  // keep the live basePlatform in lockstep so draw() stays simple
  if (this.basePlatform) {
    this.basePlatform.x = x;
    this.basePlatform.y = y;
    this.basePlatform.width  = w;
    this.basePlatform.height = h;
  }

  if (t >= 1) this.outroActive = false;
}
    // Standing on moving platform
    if (!this.isJumping && !this.isCharging && this.currentPlatform) {
      this.y = this.currentPlatform.y - this.apothem;
    }

    // Spawn moving platforms
    const speed = 0.06 + (level - 1) * 0.02;
    this.currentSpeed = speed;
    this.platformSpawnTimer += deltaTime;
    if (this.platformSpawnTimer >= this.platformSpawnInterval) {
      this.platformSpawnTimer -= this.platformSpawnInterval;
      const w      = this.size * 2;
      const spawnY = ay - this.platformHeight;
      const spawnX = ax + Math.random() * (asz - w);
      this.platforms.push(new Platform(spawnX, spawnY, w, this.platformHeight, speed));
    }

    // Update platforms
    this.platforms.forEach(p => p.update(deltaTime));
    this.platforms = this.platforms.filter(p => p.y < ay + asz + p.height);

    // Platform left screen
    if (this.currentPlatform && !this.platforms.includes(this.currentPlatform)) {
      this.currentPlatform = null;
      this.isJumping = true;
    }

    // Charging logic
    if (this.isCharging) {
      this.chargeTime = Math.min(this.chargeTime + deltaTime, this.maxCharge);
      const t = this.chargeTime / this.maxCharge;
      this.scaleY = 1 - 0.3 * t;
      this.scaleX = 1 + 0.3 * t;
      return;
    }

    // Launch base after depart
    if (this.shouldLaunchBase && !this.initialLaunched) {
      if (this.y + this.apothem < this.basePlatform.y) {
        this.basePlatform.speed = this.currentSpeed;
        this.initialLaunched    = true;
        this.shouldLaunchBase   = false;
      }
    }

    // Physics
    if (this.isJumping) {
      this.vy += this.gravity * deltaTime;
      this.y  += this.vy * deltaTime;

      if (this.vy > 0) {
  for (let p of this.platforms) {
    const bot = this.y + this.apothem;
    if (
      bot >= p.y && bot <= p.y + p.height &&
      this.x >= p.x && this.x <= p.x + p.width
    ) {
      this.isJumping       = false;
      this.vy              = 0;
      this.y               = p.y - this.apothem;
      this.currentPlatform = p;

      // NEW: if we landed on the white base, turn it green like the others
      if (p === this.basePlatform && p.color !== '#228B22') {
        p.color = '#228B22';
      }

      if (this.initialFall) this.initialFall = false;
      break;
    }
  }
}
    }
  }

  // Input Handlers
  handleMouseDown() {
    if (!this.playIntro && !this.isJumping && !this.isCharging) {
      this.isCharging      = true;
      this.chargeTime      = 0;
      this.currentPlatform = null;
    }
  }
  handleMouseUp() {
    if (this.isCharging) {
      this.isCharging       = false;
      this.shouldLaunchBase = true;
      this.isJumping        = true;
      this.vy               = -this.chargeTime * this.jumpFactor;
      this.scaleX           = 1;
      this.scaleY           = 1;
    }
  }

  // Misc Helpers
  checkBoundary() {
    const { y: ay, size: asz } = this.playArea;
    return this.y - this.size > ay + asz || this.y + this.size < ay;
  }
  

  // Reset
  reset() {
    this.x = this.startX;
    this.y = this.startY;
    const { x: ax, y: ay, size: asz } = this.playArea;
    this.playIntro        = true;
    this.introTimer       = 0;
    this.vy               = 0;
    this.isJumping        = false;
    this.isCharging       = false;
    this.chargeTime       = 0;
    this.scaleX           = 1;
    this.scaleY           = 1;
    this.shouldLaunchBase = false;
    this.initialFall      = false;
    this.initialLaunched  = false;
    this.currentPlatform  = null;
    const baseY = ay + asz - this.borderHeight;
    this.basePlatform = new Platform(ax, baseY, asz, this.borderHeight, 0, '#FFFFFF');
    this.platforms   = [this.basePlatform];
    this.groundY     = baseY - this.apothem;
    this.isReadyToPlay = false;

  }

  // -------------------------------------------------------------------------
  // 5. Scoring & Feedback (placeholder)
  // -------------------------------------------------------------------------
  /*
    // Example:
    updateScore(points) {
      // TODO: implement
    }
  */

  // -------------------------------------------------------------------------
  // 6. Skins & Effects (stub)
  // -------------------------------------------------------------------------
  /*
    applySkin(skin) {
      // TODO: implement skin application
    }
  */

  // -------------------------------------------------------------------------
  // 7. Debugging Tools (stub)
  // -------------------------------------------------------------------------
  /*
    debugDraw(ctx) {
      // TODO: draw hitboxes, etc.
    }
  */
 // ---------------------------------------------------------------------------
// 8. Structural Requirements
// ---------------------------------------------------------------------------
get behaviorType() {
  return 'survival';
}

isReady() {
  return !this.playIntro;
}
resetSequence(level) {
  this.reset();
  const bus = window.bus;
if (bus) {
  bus.emit('playArea/clearEdgeMasks', { animate: false });
bus.emit('playArea/hideTopEdge');     // uses universal EDGE_VEIL_MS / OUTRO_MS
bus.emit('playArea/hideBottomEdge');  // same
}
}
handleClick() {
  this.handleMouseDown(); // or whatever logic fits
}

}
