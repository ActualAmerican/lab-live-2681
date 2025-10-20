// ----------------------------------------------------------------------------------
//  Shape: Heart
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

// src/shapes/Heart.js
import { Shape } from './Shape.js';

// Utility: sample a cubic Bézier curve
function cubicBezier(t, p0, p1, p2, p3) {
  const mt = 1 - t;
  return (
    mt ** 3 * p0 +
    3 * mt ** 2 * t * p1 +
    3 * mt * t ** 2 * p2 +
    t ** 3 * p3
  );
}

// Utility: sample the full border of the Heart using its exact Bézier curves
function getHeartBorderPoints(x, y, baseSize, steps = 120) {
  // The shape consists of two Bézier segments
  // First segment (left)
  const p0 = [0, baseSize / 4];
  const p1 = [-baseSize / 2, -baseSize / 2];
  const p2 = [-baseSize, baseSize / 2];
  const p3 = [0, baseSize];
  // Second segment (right)
  const q0 = [0, baseSize];
  const q1 = [baseSize, baseSize / 2];
  const q2 = [baseSize / 2, -baseSize / 2];
  const q3 = [0, baseSize / 4];

  const pts = [];
  // Sample first Bézier (left)
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    pts.push([
      x + cubicBezier(t, p0[0], p1[0], p2[0], p3[0]),
      y + cubicBezier(t, p0[1], p1[1], p2[1], p3[1])
    ]);
  }
  // Sample second Bézier (right)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([
      x + cubicBezier(t, q0[0], q1[0], q2[0], q3[0]),
      y + cubicBezier(t, q0[1], q1[1], q2[1], q3[1])
    ]);
  }
  return pts;
}

export class Heart extends Shape {
 /* ========================================================================
   * 1. Initialization
   * ======================================================================*/
  constructor(x, y, size, _ignoredColor, name = 'Heart') {
    super(x, y - size * 0.2, size, '#FF0000');
    this.name = name;
    this.baseSize = size * 1.4;
    this.pulseAmplitude = 0.15;
    this.playIntro = true;
    this.introTimer = 0;
    this.introDuration = 2500;
    this.fadeInTime = 1200;
    this.glintTime = 1800;
    this.isReadyToPlay = false;

    this.currentLevel = 1;
    this.rhythms = {
      1: [[800, 800, 800], [700, 700, 700], [900, 900, 900]],
      2: [
        [800, 400, 800, 400],
        [700, 700, 500, 1100],
        [600, 900, 600, 900],
        [500, 500, 1000, 500],
        [900, 600, 900, 600]
      ],
      3: [
        [600, 400, 600, 400, 600, 400],
        [500, 1000, 500, 1000, 500, 1000],
        [700, 700, 700, 700, 700, 700],
        [500, 800, 300, 800, 500, 800],
        [400, 400, 800, 400, 400, 800],
        [550, 450, 550, 450, 550, 450],
        [500, 700, 500, 900, 500, 700],
        [450, 450, 450, 450, 450, 450],
        [400, 600, 800, 600, 400, 600],
        [600, 600, 600, 600, 600, 600]
      ]
    };
    this.playArea = {
      x: window.playAreaX ?? 100,
      y: window.playAreaY ?? 0,
      size: window.playAreaSize ?? 600
    };
    this.markerTravelTime = 1100;
    this.perfectWindow = 150;
    this.hittableWindowEnd = 800;
    this.missWindowEnd = 400;
    this.earlyWindowAllowance = 120;
    this.startSize = this.baseSize * 0.3;
    this.endSize = this.baseSize;
    this.startX = this.playArea.x + this.playArea.size + 50;
    this.rhythmPattern = [];
    this.mode = 'display';
    this.displayIndex = 0;
    this.displayTimer = 0;
    this.inputStartTime = 0;
    this.beatMarkers = [];
    this.mistakes = 0;
    this.maxMistakes = 3;
    this.sequencesRepeated = 0;
    this.changeEvery = 1;
    this.inputFlashTimer = 0;
    this.shakeTimer = 0;
    this.shakeDuration = 200;
    this.broken = false;
    this.fallTimer = 0;
    this.crackPath = null;
    this.lastClickTime = 0;
    this.stunTimer = 0;
    this.stunDuration = 600;
    this.beatFadeOutDuration = 350;
    this.resetSequence(1, true);
  }

 /* ========================================================================
   * 2. Intro Animation 
   * ======================================================================*/

 /* ========================================================================
   * 3. Drawing Functions
   * ======================================================================*/
  draw(ctx) {
    const now = performance.now();

    // ---- Heart Pulse Animation: Custom Smooth Ba-Boom Intro Sequence ----
    let scale = 1;
    // Ba-Boom timings
    const baBoom1Start = 700, baBoom1End = 950;
    const baBoom2Start = 1100, baBoom2End = 1400;
    // New: Lock out pulse/gameplay until after glint
    let canPulse = true;

    if (this.playIntro) {
      if (this.introTimer < baBoom1Start) {
        scale = 1;
        canPulse = false;
      } else if (this.introTimer < baBoom1End) {
        const t = (this.introTimer - baBoom1Start) / (baBoom1End - baBoom1Start);
        scale = 1 + this.pulseAmplitude * (Math.sin(Math.PI * t) ** 1.5);
        canPulse = false;
      } else if (this.introTimer < baBoom2Start) {
        scale = 1;
        canPulse = false;
      } else if (this.introTimer < baBoom2End) {
        const t = (this.introTimer - baBoom2Start) / (baBoom2End - baBoom2Start);
        scale = 1 + this.pulseAmplitude * 1.12 * (Math.sin(Math.PI * t) ** 1.6);
        canPulse = false;
      } else if (this.introTimer < this.glintTime + 650) {
        scale = 1;
        canPulse = false;
      } else {
        // After glint, pulse/gameplay kicks in
        canPulse = true;
      }
      ctx.globalAlpha = Math.min(1, this.introTimer / this.fadeInTime);
    }

    if (!this.playIntro || canPulse) {
      // Regular pulse animation after intro
      const phase = ((now % this.markerTravelTime) / this.markerTravelTime) * 2 * Math.PI;
      scale = 1 + this.pulseAmplitude * Math.sin(phase);
    }

    let shakeOffsetX = 0;
    let heartFillColor = this.stunTimer > 0 ? '#bbb' : this.color;
    if (this.shakeTimer > 0 || this.stunTimer > 0) {
      const shakeT = (this.shakeTimer > 0 ? this.shakeTimer : this.stunTimer) / this.shakeDuration;
      shakeOffsetX = Math.sin(shakeT * 20) * 5 * shakeT;
    }

    if (this.broken && this.fallTimer < 1000) {
      const t = this.fallTimer / 1000;
      const fallDistance = this.baseSize * 1.5 * t;
      const rotationAngle = t * Math.PI / 4;
      const sep = 20 * t;
      const deflate = 1 - 0.5 * t;
      const squishX = 1 - 0.4 * t;
      const squishY = 1 - 0.6 * t;
      const fadeAlpha = 1 - t;

      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      const leftX = this.x - fallDistance * 0.3 - sep + shakeOffsetX;
      const leftY = this.y + fallDistance;
      ctx.translate(leftX, leftY);
      ctx.rotate(-rotationAngle);
      ctx.scale(squishX * deflate, squishY * deflate);
      this.drawHalfAndCrackPath(ctx, 'left');
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = fadeAlpha;
      const rightX = this.x + fallDistance * 0.3 + sep + shakeOffsetX;
      const rightY = this.y + fallDistance;
      ctx.translate(rightX, rightY);
      ctx.rotate(rotationAngle);
      ctx.scale(squishX * deflate, squishY * deflate);
      this.drawHalfAndCrackPath(ctx, 'right');
      ctx.restore();

      ctx.globalAlpha = 1;
      return;
    }

    // ===== Draw the Heart shape =====
    if (!this.broken) {
      ctx.save();
      ctx.translate(this.x + shakeOffsetX, this.y);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(0, this.baseSize / 4);
      ctx.bezierCurveTo(
        -this.baseSize / 2, -this.baseSize / 2,
        -this.baseSize, this.baseSize / 2,
        0, this.baseSize
      );
      ctx.bezierCurveTo(
        this.baseSize, this.baseSize / 2,
        this.baseSize / 2, -this.baseSize / 2,
        0, this.baseSize / 4
      );
      ctx.closePath();
      ctx.fillStyle = heartFillColor;
      ctx.fill();
      if (this.crackPath) {
        ctx.globalCompositeOperation = 'destination-out';
        this.drawCrackPath(ctx);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    // ===== Glint effect =====
    if (this.playIntro && this.introTimer >= this.glintTime && this.introTimer < this.glintTime + 400 && !this.broken) {
      // Get actual points along the border (using true Bézier heart)
      const outlinePts = getHeartBorderPoints(this.x, this.y, this.baseSize, 120);
      // Compute perimeter length
      let perim = 0;
      for (let i = 1; i < outlinePts.length; i++) {
        const dx = outlinePts[i][0] - outlinePts[i - 1][0];
        const dy = outlinePts[i][1] - outlinePts[i - 1][1];
        perim += Math.hypot(dx, dy);
      }
      // Animate the glint as a highlight dashing around border
      const highlightLen = perim * 0.18;
      const glintT = (this.introTimer - this.glintTime) / 400;
      const offset = perim * glintT;

      ctx.save();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(255,255,255,0.84)";
      ctx.setLineDash([highlightLen, perim]);
      ctx.lineDashOffset = -offset;

      ctx.beginPath();
      ctx.moveTo(outlinePts[0][0], outlinePts[0][1]);
      for (let i = 1; i < outlinePts.length; i++) {
        ctx.lineTo(outlinePts[i][0], outlinePts[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ===== INPUT-PHASE MARKERS =====
    if (this.mode === 'input' && !this.broken) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.playArea.x, this.playArea.y, this.playArea.size, this.playArea.size);
      ctx.clip();
      const startX = this.playArea.x + this.playArea.size + 50;
      for (let marker of this.beatMarkers) {
        if (now < marker.spawnTime && !marker.fading) continue;
        let tNorm = (now - marker.spawnTime) / this.markerTravelTime;
        tNorm = Math.min(Math.max(tNorm, 0), 1);
        const xPos = startX + tNorm * (this.x - startX);

        let fadeAlpha = 1;
        if (marker.fading) {
          let ratio = marker.fadeOutTimer / this.beatFadeOutDuration;
          fadeAlpha = 1 - Math.pow(Math.min(1, Math.max(0, ratio)), 1.5);
        }

        // OUTLINE ONLY, pink
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.translate(xPos, this.y);
        ctx.scale((this.baseSize * scale) / this.baseSize, (this.baseSize * scale) / this.baseSize);
        ctx.beginPath();
        ctx.moveTo(0, this.baseSize / 4);
        ctx.bezierCurveTo(
          -this.baseSize / 2, -this.baseSize / 2,
          -this.baseSize, this.baseSize / 2,
          0, this.baseSize
        );
        ctx.bezierCurveTo(
          this.baseSize, this.baseSize / 2,
          this.baseSize / 2, -this.baseSize / 2,
          0, this.baseSize / 4
        );
        ctx.closePath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FF7BAA';
        ctx.stroke();
        ctx.restore();

        // Masked (overlapping) white part
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.beginPath();
        ctx.translate(this.x, this.y);
        ctx.scale(scale, scale);
        ctx.moveTo(0, this.baseSize / 4);
        ctx.bezierCurveTo(
          -this.baseSize / 2, -this.baseSize / 2,
          -this.baseSize, this.baseSize / 2,
          0, this.baseSize
        );
        ctx.bezierCurveTo(
          this.baseSize, this.baseSize / 2,
          this.baseSize / 2, -this.baseSize / 2,
          0, this.baseSize / 4
        );
        ctx.closePath();
        ctx.clip();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = fadeAlpha;
        ctx.translate(xPos, this.y);
        ctx.scale((this.baseSize * scale) / this.baseSize, (this.baseSize * scale) / this.baseSize);
        ctx.beginPath();
        ctx.moveTo(0, this.baseSize / 4);
        ctx.bezierCurveTo(
          -this.baseSize / 2, -this.baseSize / 2,
          -this.baseSize, this.baseSize / 2,
          0, this.baseSize
        );
        ctx.bezierCurveTo(
          this.baseSize, this.baseSize / 2,
          this.baseSize / 2, -this.baseSize / 2,
          0, this.baseSize / 4
        );
        ctx.closePath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFF';
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // ===== FEEDBACK FLASH =====
    if (this.inputFlashTimer > 0 && !this.broken) {
      ctx.save();
      ctx.globalAlpha = this.inputFlashTimer / 200;
      ctx.strokeStyle = '#FF5A7A';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.x + shakeOffsetX, this.y + this.baseSize / 4);
      ctx.bezierCurveTo(
        this.x + shakeOffsetX - this.baseSize / 2, this.y - this.baseSize / 2,
        this.x + shakeOffsetX - this.baseSize, this.y + this.baseSize / 2,
        this.x + shakeOffsetX, this.y + this.baseSize
      );
      ctx.bezierCurveTo(
        this.x + shakeOffsetX + this.baseSize, this.y + this.baseSize / 2,
        this.x + shakeOffsetX + this.baseSize / 2, this.y - this.baseSize / 2,
        this.x + shakeOffsetX, this.y + this.baseSize / 4
      );
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      this.inputFlashTimer = Math.max(0, this.inputFlashTimer - 16);
    }
  }

  /* ========================================================================
   * 4. Gameplay Logic
   * ======================================================================*/
  resetSequence(level, isNewLevel = false) {
    this.currentLevel = level;
    this.playIntro = true;
    this.introTimer = 0;
    const options =
    this.rhythms[level] ||
    this.rhythms[3] ||
    this.rhythms[1] ||
    [[600, 600, 600]]; // final fallback
    const idx = Math.floor(Math.random() * options.length) || 0;
    this.rhythmPattern = options[idx] || options[0] || [600, 600, 600];
    this.mode = 'display';
    this.displayIndex = 0;
    this.displayTimer = this.rhythmPattern[0] || 0;
    this.beatMarkers = [];
    this.inputStartTime = 0;
    this.mistakes = 0;
    this.broken = false;
    this.fallTimer = 0;
    this.crackPath = null;
    this.sequencesRepeated = 0;
    this.changeEvery = level === 1 ? 1 : 2;
    this.inputFlashTimer = 0;
    this.shakeTimer = 0;
    this.lastClickTime = 0;
    this.stunTimer = 0;
  }

  startInputPhase(now) {
    this.mode = 'input';
    this.inputStartTime = now;
    this.beatMarkers = [];
    let cumulative = 0;
    for (let interval of this.rhythmPattern) {
      cumulative += interval;
      const target = this.inputStartTime + cumulative;
      const spawn = Math.max(this.inputStartTime, target - this.markerTravelTime);
      const distance = this.startX - this.x;
      const heartRightEdge = this.x + this.baseSize / 2;
      const tNorm = (this.startX - heartRightEdge) / distance;
      const markerSizeAtT = this.startSize + (this.endSize - this.startSize) * tNorm;
      const markerLeftEdgeAtT = (this.startX - tNorm * distance) - markerSizeAtT / 2;
      const adjustment = (heartRightEdge - markerLeftEdgeAtT) / distance;
      const tNormContact = tNorm + adjustment;
      const firstContactTime = spawn + tNormContact * this.markerTravelTime;
      this.beatMarkers.push({
        spawnTime: spawn,
        targetTime: target,
        firstContactTime: firstContactTime,
        hit: false,
        judged: false,
        fading: false,
        fadeOutTimer: 0,
        fadeOutStart: null
      });
    }
    const minSpacing = 200;
    this.beatMarkers.sort((a, b) => a.spawnTime - b.spawnTime);
    for (let i = 1; i < this.beatMarkers.length; i++) {
      const prev = this.beatMarkers[i - 1];
      const curr = this.beatMarkers[i];
      if (curr.spawnTime < prev.spawnTime + minSpacing) {
        curr.spawnTime = prev.spawnTime + minSpacing;
        curr.targetTime = curr.spawnTime + this.markerTravelTime;
        const tNorm = (this.startX - (this.x + this.baseSize / 2)) / (this.startX - this.x);
        const markerSizeAtT = this.startSize + (this.endSize - this.startSize) * tNorm;
        const markerLeftEdgeAtT = (this.startX - tNorm * (this.startX - this.x)) - markerSizeAtT / 2;
        const adjustment = ((this.x + this.baseSize / 2) - markerLeftEdgeAtT) / (this.startX - this.x);
        const tNormContact = tNorm + adjustment;
        curr.firstContactTime = curr.spawnTime + tNormContact * this.markerTravelTime;
      }
    }
    this.lastClickTime = 0;
  }

  update(deltaTime, level) {
    const now = performance.now();
    if (this.stunTimer > 0) {
      this.stunTimer -= deltaTime;
      if (this.stunTimer < 0) this.stunTimer = 0;
    }
    if (level !== this.currentLevel) {
      this.resetSequence(level, true);
      return;
    }
    if (this.playIntro) {
  this.introTimer += deltaTime;
  if (this.introTimer >= this.introDuration) {
    this.playIntro = false;
    this.isReadyToPlay = true;
  }
  return;
}

    if (this.broken && this.fallTimer < 1000) {
      this.fallTimer += deltaTime;
      return;
    }
    if (this.mode === 'display') {
      this.displayTimer += deltaTime;
      const interval = this.rhythmPattern[this.displayIndex];
      if (this.displayTimer >= interval) {
        this.displayTimer -= interval;
        this.displayIndex++;
        if (this.displayIndex >= this.rhythmPattern.length) {
          this.startInputPhase(now);
        }
      }
      return;
    }
    if (this.mode === 'input') {
      for (let marker of this.beatMarkers) {
        if (marker.fading) {
          marker.fadeOutTimer += deltaTime;
          if (marker.fadeOutTimer > this.beatFadeOutDuration) marker.fading = false;
          continue;
        }
        if ((marker.judged || marker.hit) && !marker.fading && marker.fadeOutStart == null) {
          marker.fading = true;
          marker.fadeOutStart = now;
          marker.fadeOutTimer = 0;
        }
        if (marker.judged || marker.hit) continue;
        if (now > marker.targetTime + this.missWindowEnd) {
          marker.judged = true;
          marker.fading = true;
          marker.fadeOutStart = now;
          marker.fadeOutTimer = 0;
          this.shakeTimer = this.shakeDuration;
          this.registerMistake();
          if (this.broken) return;
        }
      }
      const allDone = this.beatMarkers.every(
        m => (m.judged || m.hit) && (!m.fading || m.fadeOutTimer > this.beatFadeOutDuration)
      );
      if (allDone) {
        if (this.mistakes === 0) {
          this.sequencesRepeated++;
          if (this.sequencesRepeated >= this.changeEvery) {
            this.sequencesRepeated = 0;
            const opts = this.rhythms[this.currentLevel];
            this.rhythmPattern = opts[Math.floor(Math.random() * opts.length)];
          }
        }
        this.mode = 'display';
        this.displayIndex = 0;
        this.displayTimer = this.rhythmPattern[0];
        this.beatMarkers = [];
        this.lastClickTime = 0;
      }
      this.inputFlashTimer = Math.max(0, this.inputFlashTimer - deltaTime);
      this.shakeTimer = Math.max(0, this.shakeTimer - deltaTime);
    }
  }

  /* ========================================================================
   * 5. Scoring & Feedback (placeholder)
   * ======================================================================*/

  registerMistake() {
    this.shakeTimer = this.shakeDuration;
    this.mistakes++;
    if (this.mistakes <= this.maxMistakes) {
      this.crackPath = this.generateCrackPath(this.mistakes);
    }
    if (this.mistakes >= this.maxMistakes) {
      this.broken = true;
      this.fallTimer = 0;
    }
  }

  generateCrackPath(level) {
    const h = this.baseSize;
    let yStart = -h * 0.1;
    let yEnd = level === 1 ? h * 0.4 : level === 2 ? h * 0.8 : h;
    let bottomX = level === 3 ? (Math.random() > 0.5 ? 1 : -1) * h * 0.2 : 0;
    const segments = Math.floor((yEnd - yStart) / (h * 0.05));
    const xOffsetMax = h * 0.12;
    const points = [{ x: 0, y: yStart }];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const y = yStart + t * (yEnd - yStart);
      let randX =
        level < 3
          ? (Math.random() * 2 - 1) * xOffsetMax * (1 - t * 0.3)
          : t * bottomX + (Math.random() * 2 - 1) * xOffsetMax * (1 - t * 0.2);
      points.push({ x: randX, y });
    }
    points.push({ x: bottomX, y: yEnd + h * 0.02 });
    return points;
  }

  drawHalfAndCrackPath(ctx, side) {
    if (!this.crackPath) return;
    const pts = this.crackPath;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x || 0, pts[i].y || 0);
      else ctx.lineTo(pts[i].x || 0, pts[i].y || 0);
    }
    if (side === 'left') {
      ctx.bezierCurveTo(
        -this.baseSize, this.baseSize / 2,
        -this.baseSize / 2, -this.baseSize / 2,
        0, this.baseSize / 4
      );
    } else {
      ctx.bezierCurveTo(
        this.baseSize, this.baseSize / 2,
        this.baseSize / 2, -this.baseSize / 2,
        0, this.baseSize / 4
      );
    }
    ctx.closePath();
    ctx.fillStyle = 'gray';
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    this.drawCrackPath(ctx);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  drawCrackPath(ctx) {
    if (!this.crackPath) return;
    ctx.beginPath();
    const pts = this.crackPath;
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(pts[i].x || 0, pts[i].y || 0);
      else ctx.lineTo(pts[i].x || 0, pts[i].y || 0);
    }
    ctx.strokeStyle = 'black';
    ctx.stroke();
  }

  // === Input Handling ===
  handleClick(x, y) {
    if (this.playIntro || this.mode === 'display' || this.broken || this.stunTimer > 0) {
      return false;
    }
    const now = performance.now();
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.baseSize * 2) {
      return false;
    }
    let matched = false;
    for (let marker of this.beatMarkers) {
      if (marker.judged || marker.hit || marker.fading) continue;
      const hittableStartTime = marker.firstContactTime - this.earlyWindowAllowance;
      const hittableEndTime = marker.targetTime + this.hittableWindowEnd;
      if (now >= hittableStartTime && now <= hittableEndTime) {
        marker.hit = true;
        marker.judged = true;
        marker.fading = true;
        marker.fadeOutStart = now;
        marker.fadeOutTimer = 0;
        this.inputFlashTimer = 200;
        this.lastClickTime = now;
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (now - this.lastClickTime < 180) {
        this.stunTimer = this.stunDuration;
        this.shakeTimer = this.stunDuration;
      }
      this.lastClickTime = now;
      return false;
    }
    return matched;
  }

  checkBoundary() {
    if (this.broken && this.fallTimer >= 1000) {
      return true;
    }
    return false;
  }

  isSequenceCompleted() {
  return !this.broken;
}


  // === Reset ===
  reset() {
    this.resetSequence(this.currentLevel, true);
  }

  /* ========================================================================
   * 6. Skins and Effects (stub)
   * ======================================================================*/

  /* ========================================================================
   * 7. Debugging Tools (stub)
   * ======================================================================*/

  // ========================================================================
// 8. Structural Requirements
// ========================================================================
get behaviorType() {
  return 'sequence';
}

isReady() {
  return !this.playIntro;
}

}

