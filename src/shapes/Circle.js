// ----------------------------------------------------------------------------------
//  Shape: Circle
//  Organized according to the standard blueprint:
//    1. Initialization
//    2. Intro Animation
//    3. Drawing Functions
//    4. Gameplay Logic
//    5. Scoring and Feedback
//    6. Skins and Effects
//    7. Debugging Tools (placeholder)
//    8. Structural Requirements
// ----------------------------------------------------------------------------------

// src/shapes/Circle.js

import { Shape } from './Shape.js';

export class Circle extends Shape {
/* ========================================================================
   * 1. Initialization
   * ======================================================================*/
  constructor(x, y, size, _ignoredColor, name = 'Circle') {
    super(x, y, size, '#3399FF');
    this.name = name;
    this.platformWidth = 120;
    this.platformHeight = 12;
    this.playArea = {
      x: window.playAreaX ?? 100,
      y: window.playAreaY ?? 0,
      size: window.playAreaSize ?? 600
    };
    this.platformY = this.playArea.y + this.playArea.size - this.platformHeight;
    this.platformX = this.playArea.x + this.playArea.size / 2 - this.platformWidth / 2;
    this.platformTargetX = this.platformX;
    this.playIntro = true;
    this.glintDuration = 600;
    this.sequenceDone = false;
    this.objectiveCompleted = false;
    this.maxSpeed = 3.5;
    this.ballSize = size + 25;
    this.balls = [];
    this.crossingLog = [];
    this.crossingThreshold = 10;
    this.crossingWindow = 2000;
    this.lastSideTouched = null;
    this.paddleStunned = false;
    this.paddleStunTimer = 0;
    this.introActive = true;
    this.isReadyToPlay = false;
    this.introTimer = 0;
    this.introDuration = 2500;
    this.fadeInTime = 1200;
    this.glintTime = 1800;
    this.paddleMorphProgress = 0;
    this.currentLevel = 1;

    this.levelDurations = {
      1: 60000,
      2: 90000,
      3: 90000,
      4: 120000
    };

    this.bindMouse();
    this.resetSequence(1, true);
     // Start the paddle outro when this shape completes
    const bus = window.bus;
    if (bus) {
    this._onShapeComplete = () => { this.startOutro(); };
   bus.on('shape:complete', this._onShapeComplete);
    }
  }

/* ========================================================================
   * 2. Intro Animation 
   * ======================================================================*/
// Handled in update() and draw()

/* ========================================================================
   * 3. Drawing Functions
   * ======================================================================*/
  draw(ctx) {
  const { x: px, y: py, size: pSize } = this.playArea;
  const isInfinite = this.currentLevel >= 4;
  const borderColor = '#3399FF';
  const time = Date.now() * 0.006;
  const shadowBlur = isInfinite ? (18 + 8 * Math.abs(Math.sin(time))) : 0;

  // === Paddle ===
ctx.save();
const morphActive = this.introActive;
const outroActive = this.outroActive;

let currW, currH, drawX, drawY;
const minH = Math.max(1, window.playAreaBorderPx || 2);  // exact edge thickness
const minW = pSize;                      // full border width
const maxW = this.platformWidth;
const maxH = this.platformHeight;

if (morphActive) {
  // Intro: edge → paddle
  const m = Math.min(1, this.introTimer / this.introDuration);
  currW = minW + (maxW - minW) * m;
  currH = minH + (maxH - minH) * m;
  drawX = px + (pSize - currW) / 2;
  drawY = py + pSize - currH;            // bottom anchored to edge
} else if (outroActive) {
  // Outro: paddle → edge (height compress; keep width, center via update())
  const t = Math.min(1, this.outroTimer / this.outroDuration);
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  currW = maxW;
  currH = minH + (maxH - minH) * (1 - e); // shrink to edge thickness
  drawX = Math.max(px, Math.min(this.platformX, px + pSize - currW));
  drawY = py + pSize - currH;            // keep bottom locked to edge
} else {
  // Normal play
  currW = maxW;
  currH = maxH;
  drawX = Math.max(px, Math.min(this.platformX, px + pSize - currW));
  drawY = this.platformY;
}

// No paddle fade-in
ctx.globalAlpha = morphActive ? 1 : (this.paddleStunned ? 0.3 : 1);

if (isInfinite) {
  ctx.fillStyle = borderColor;
  ctx.shadowColor = borderColor;
  ctx.shadowBlur = shadowBlur;
} else {
  ctx.fillStyle = 'white';
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}
ctx.fillRect(drawX, drawY, currW, currH);
ctx.globalAlpha = 1;
ctx.restore();

  // === Balls ===
  for (let ball of this.balls) {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    let sx = ball.scaleX, sy = ball.scaleY;

    if (this.introActive) {
      const alpha = Math.min(1, this.introTimer / this.fadeInTime);
      ctx.globalAlpha = alpha;
      sx = 1; sy = 1;

      if (this.introTimer > this.fadeInTime && this.introTimer < this.glintTime - 80) {
        const t0 = this.fadeInTime;
        const t1 = this.glintTime - 80;
        let t = (this.introTimer - t0) / (t1 - t0);
        t = Math.max(0, Math.min(1, t));
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const amt = Math.sin(ease * Math.PI * 2 * 1.6) * (1 - ease * 0.6) * 0.28;
        sx = 1 + amt; sy = 1 - amt;
      }

      if (this.introTimer >= this.glintTime && this.introTimer < this.glintTime + 400) {
        const dur = 400;
        const lw = 6;
        const fudge = 1.0;
        const adjR = Math.max(1, ball.radius - (lw / 2) + fudge);
        const perim = 2 * Math.PI * adjR;
        const len = perim * 0.15;
        const t = (this.introTimer - this.glintTime) / dur;
        const offset = perim * t;
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, ball.radius, 0, Math.PI * 2); ctx.closePath();
        ctx.fillStyle = '#3399FF'; ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = 'rgba(255,255,255,0.82)';
        ctx.setLineDash([len, perim]);
        ctx.lineDashOffset = -offset;
        ctx.beginPath(); ctx.arc(0, 0, adjR, 0, Math.PI * 2); ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        ctx.restore();
        continue;
      }
    }

    ctx.scale(sx, sy);
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#3399FF';
    ctx.fill();
    ctx.restore();
  }
}

/* ========================================================================
   * 4. Gameplay Logic
   * ======================================================================*/
  trackPaddleCrossing() {
    const now = performance.now();
    const left = this.playArea.x;
    const right = left + this.playArea.size;
    const paddleLeft = this.platformX;
    const paddleRight = this.platformX + this.platformWidth;
    let currentSide = null;
    if (paddleLeft <= left) currentSide = 'left';
    else if (paddleRight >= right) currentSide = 'right';
    if (currentSide && currentSide !== this.lastSideTouched) {
      this.crossingLog.push(now);
      this.lastSideTouched = currentSide;
    }
    const cutoff = now - this.crossingWindow;
    this.crossingLog = this.crossingLog.filter(t => t >= cutoff);
    if (this.crossingLog.length >= this.crossingThreshold) {
      this.paddleStunned = true;
      this.paddleStunTimer = 1500;
      this.crossingLog = [];
    }
  }

  startOutro() {
  if (this.outroActive) return;
  this.outroActive = true;
  this.outroTimer = 0;
  this._outroFromX = this.platformX;
  // steer toward center while blocking mouse control
  const centerX = this.playArea.x + this.playArea.size / 2 - this.platformWidth / 2;
  this.platformTargetX = centerX;
}

  update(deltaTime, level) {
    if (level !== this.currentLevel) this.resetSequence(level);
    this.trackPaddleCrossing();

    if (this.paddleStunned) {
      this.paddleStunTimer -= deltaTime;
      if (this.paddleStunTimer <= 0) this.paddleStunned = false;
    } else if (!this.outroActive) {
  this.platformX = this.platformTargetX;
}

    if (this.introActive) {
      this.introTimer += deltaTime;
      this.paddleMorphProgress = Math.min(1, this.introTimer / this.introDuration);
      const centerX = this.playArea.x + this.playArea.size / 2 - this.platformWidth / 2;
      this.platformX = centerX;
      if (this.introTimer >= this.introDuration) {
  this.introActive = false;
  this.paddleMorphProgress = 1;

  // ensure the veil is fully closed *this frame*
  const bus = window.bus;
  bus && bus.emit('playArea/finishEdgeMasks');

  this.platformX = this.platformTargetX;
  this.isReadyToPlay = true;
}
      return;
    }
// ── Paddle outro: glide to center and compress to the edge thickness
if (this.outroActive) {
  this.outroTimer += deltaTime;
  const t = Math.min(1, this.outroTimer / this.outroDuration);
  // simple ease (same as veil outro timing feel)
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const centerX = this.playArea.x + this.playArea.size / 2 - this.platformWidth / 2;
  this.platformX = this._outroFromX + (centerX - this._outroFromX) * ease;

  if (t >= 1) {
    this.outroActive = false; // finished morph back into the edge
  }
}
    for (let ball of this.balls) {
      if (!ball.launched) {
        ball.launchDelay -= deltaTime;
        if (ball.launchDelay <= 0) {
          ball.vx = ball.baseVX;
          ball.vy = ball.baseVY;
          ball.launched = true;
        }
        continue;
      }

      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, ball.vx));
      ball.vy = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, ball.vy));

      const left = this.playArea.x;
      const right = left + this.playArea.size;
      const top = this.playArea.y;
      if (ball.x - ball.radius <= left) {
        ball.x = left + ball.radius;
        ball.vx *= -1;
        this.triggerSquish(ball, 'vertical');
      }
      if (ball.x + ball.radius >= right) {
        ball.x = right - ball.radius;
        ball.vx *= -1;
        this.triggerSquish(ball, 'vertical');
      }
      if (ball.y - ball.radius <= top) {
        ball.y = top + ball.radius;
        ball.vy *= -1;
        this.triggerSquish(ball, 'horizontal');
      }

      const paddleTop = this.platformY;
      const paddleBottom = this.platformY + this.platformHeight;
      const paddleLeft2 = this.platformX;
      const paddleRight2 = this.platformX + this.platformWidth;
      const ballBottom = ball.y + ball.radius;
      const ballTop = ball.y - ball.radius;
      const ballLeft2 = ball.x - ball.radius;
      const ballRight2 = ball.x + ball.radius;
      const isColliding =
        ballBottom >= paddleTop &&
        ballTop <= paddleBottom &&
        ballRight2 >= paddleLeft2 &&
        ballLeft2 <= paddleRight2 &&
        ball.vy > 0;
      if (isColliding) {
        ball.vy *= -1;
        const offset = (ball.x - this.platformX) / this.platformWidth - 0.5;
        ball.vx += offset * 1.2;
        ball.y = this.platformY - ball.radius;
        this.triggerSquish(ball, 'horizontal');
      }

      if (ball.squishTimer > 0) {
        ball.squishTimer -= deltaTime;
        const progress = 1 - ball.squishTimer / ball.squishDuration;
        const wobble = Math.sin(progress * Math.PI * 2);
        const amount = 0.25 * (1 - progress) * wobble;
        if (ball.lastBounce === 'horizontal') {
          ball.scaleX = 1 + amount;
          ball.scaleY = 1 - amount;
        } else {
          ball.scaleX = 1 - amount;
          ball.scaleY = 1 + amount;
        }
      } else {
        ball.scaleX = 1;
        ball.scaleY = 1;
      }
    }
  }

  bindMouse() {
    window.addEventListener('mousemove', e => {
      if (this.introActive || this.outroActive || this.paddleStunned) return;
      const rect = document.getElementById('gameCanvas').getBoundingClientRect();
      const rawTarget = e.clientX - rect.left - this.platformWidth / 2;
      const minX = this.playArea.x;
      const maxX = this.playArea.x + this.playArea.size - this.platformWidth;
      this.platformTargetX = Math.max(minX, Math.min(maxX, rawTarget));
    });
  }

  resetSequence(level) {
    this.currentLevel = level;
    this.introActive = true;
    this.introTimer = 0;
    this.paddleMorphProgress = 0;
    this.isReadyToPlay = false;
    this.balls = [];

    const cx = this.playArea.x + this.playArea.size / 2;
    const cy = this.playArea.y + this.playArea.size / 2;

    const ballCount = level === 1 ? 1 : level === 2 ? 2 : 3;
    const speedMultiplier = level >= 4 ? 1.35 : 1 + 0.05 * (level - 1);
    const speed = 2.0 * speedMultiplier;

    this.platformWidth = level >= 4 ? 100 : 120;

    const baseDelay = 600;
    for (let i = 0; i < ballCount; i++) {
      this.balls.push({
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        launchDelay: i * baseDelay,
        launched: false,
        radius: this.ballSize / 2,
        scaleX: 1,
        scaleY: 1,
        squishTimer: 0,
        squishDuration: 180,
        lastBounce: null,
        baseVX: (Math.random() > 0.5 ? 1 : -1) * speed * (0.9 + Math.random() * 0.2),
        baseVY: -speed
      });
    }
    const bus = window.bus;
if (bus) {
  bus.emit('playArea/clearEdgeMasks', { animate: false });
// universal veil speed/behavior (set in OverlayFX defaults)
bus.emit('playArea/hideBottomEdge');
}
  }

  triggerSquish(ball, direction) {
    ball.lastBounce = direction;
    ball.squishTimer = ball.squishDuration;
  }

/* ========================================================================
   * 5. Scoring and Feedback
   * ======================================================================*/
  handleClick() {
    return false;
  }

  checkBoundary() {
    const bottom = this.playArea.y + this.playArea.size;
    return this.balls.some(ball => ball.y - ball.radius > bottom);
  }

  isSequenceCompleted() {
  return true;
}

  reset() {
    this.resetSequence(this.currentLevel);
  }

/* ========================================================================
   * 6. Skins and Effects (stub)
   * ======================================================================*/

/* ========================================================================
   * 7. Debugging Tools (stub)
   * ======================================================================*/
  // -------------------------------------------------------------------------
// 8. Structural Requirements
// -------------------------------------------------------------------------
  get behaviorType() {
  return 'survival';
}

isReady() {
  return !this.introActive;
}

}
