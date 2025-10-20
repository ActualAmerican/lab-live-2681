// ============================================================================
// Shape: Shapeless  |  src/shapes/Shapeless.js
// ----------------------------------------------------------------------------
// Blueprint Sections
//   0. Utility Functions
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

// ---------------------------------------------------------------------------
// 0. Utility Functions
// ---------------------------------------------------------------------------
function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}
function randomRGBColor() {
  const r = Math.floor(rand(100, 255));
  const g = Math.floor(rand(100, 255));
  const b = Math.floor(rand(100, 255));
  return `rgb(${r},${g},${b})`;
}
function randomDarkColor() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 60%, 35%)`;
}
function randomCodeSnippet() {
  const snippets = [
    'if(x>y){', 'return null;', 'const a = []', 'while(true)',
    'function()', 'for(let i)', '!== undefined', 'setTimeout(',
    'x => x*x', 'console.log', 'Help', '???'
  ];
  return snippets[Math.floor(Math.random() * snippets.length)];
}

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class Shapeless extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'Shapeless') {
    super(x, y, size * 1.1, '#ffffff');
    this.name = name;

    this.numPoints = 30;
    this.radius = size * 1.05;
    this.angles = [];
    this.offsets = [];
    for (let i = 0; i < this.numPoints; i++) {
      this.angles.push((Math.PI * 2 * i) / this.numPoints);
      this.offsets.push(rand(0.8, 1.1));
    }

    this.time = 0;
    this.rotation = 0;
    this.glitchColor = randomRGBColor();
    this.glitchTimer = 0;

    // Intro and Glint
    this.playIntro     = true;
    this.introTimer    = 0;
    this.fadeInTime    = 1000;
    this.introDuration = 2400;
    this.glintTime     = 1600;
    this.glintDuration = 800;
    this._spawned      = false;
    this._codeBursts   = [];
    this._glintCount   = 30;

    this.lightPulseTime = 500;
    this.lightFadeDuration = 400;
    this.isReadyToPlay = false;

  }

  // ---------------------------------------------------------------------------
  // 2. Intro Animation Helpers & State
  // ---------------------------------------------------------------------------
  update(dt) {
    this.time += dt / 1000;
    this.rotation -= dt * 0.00022;

    for (let i = 0; i < this.offsets.length; i++) {
      this.offsets[i] += Math.sin(this.time * 3 + i) * 0.0025;
    }

    this.glitchTimer += dt;
    if (this.glitchTimer > 70) {
      this.glitchColor = randomRGBColor();
      this.glitchTimer = 0;
    }

    if (this.playIntro) {
      this.introTimer += dt;

      if (!this._spawned && this.introTimer >= this.glintTime) {
        for (let i = 0; i < this._glintCount; i++) {
          const delay = Math.random() * this.glintDuration * 0.6;
          const life  = this.glintDuration * (0.6 + Math.random() * 0.4);
          this._codeBursts.push({
            text: randomCodeSnippet(),
            angle: Math.random() * Math.PI * 2,
            radius: this.size * (1.1 + Math.random() * 1.3),
            size: 14 + Math.random() * 8,
            start: this.glintTime + delay,
            duration: life,
            color: randomDarkColor()
          });
        }
        this._spawned = true;
      }

      if (this.introTimer >= this.introDuration + this.glintDuration) {
        this.playIntro = false;
      }
      this.isReadyToPlay = true;

    }
  }

  // ---------------------------------------------------------------------------
  // 3. Drawing Functions
  // ---------------------------------------------------------------------------
  draw(ctx) {
    const alpha = Math.min(1, this.introTimer / this.fadeInTime);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = alpha;

    const scaleT = Math.min(1, Math.max(0, (this.introTimer - this.lightPulseTime) / (this.fadeInTime - this.lightPulseTime)));
    const drawScale = smoothstep(scaleT);

    // RGB light intro pulse + fade out
    if (this.introTimer < this.lightPulseTime + this.lightFadeDuration) {
      ctx.save();
      const pulse = Math.min(1, this.introTimer / this.lightPulseTime);
      const radius = 20 + 40 * pulse;

      let lightAlpha = 0.4;
      if (this.introTimer > this.lightPulseTime) {
        const fadeT = (this.introTimer - this.lightPulseTime) / this.lightFadeDuration;
        lightAlpha = 0.4 * (1 - fadeT);
      }

      ctx.globalAlpha = lightAlpha;

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, 'rgba(255,0,255,0.7)');
      grad.addColorStop(0.5, 'rgba(0,255,255,0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Exit early if shape hasn't begun scaling in
    if (this.introTimer < this.lightPulseTime) {
      ctx.restore();
      return;
    }

    ctx.scale(drawScale, drawScale);
    ctx.beginPath();

    const tension = 0.3;
    const coords = [];

    for (let i = 0; i <= this.numPoints; i++) {
      const idx = i % this.numPoints;
      const angle = this.angles[idx];
      const r = this.radius * this.offsets[idx];
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      coords.push({ x, y });

      if (i === 0) ctx.moveTo(x, y);
      else {
        const prev = coords[i - 1];
        const cp1x = lerp(prev.x, x, tension);
        const cp1y = prev.y;
        const cp2x = x;
        const cp2y = lerp(prev.y, y, tension);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      }
    }

    ctx.closePath();

    // Fill
    const t = performance.now() * 0.0015;
    const r = Math.floor(80 + Math.sin(t * 2) * 80);
    const g = Math.floor(80 + Math.cos(t * 3) * 80);
    const b = Math.floor(180 + Math.sin(t * 1.7) * 50);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
    ctx.fill();

    // Outline
    ctx.strokeStyle = this.glitchColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Glint burst
    this._codeBursts.forEach(b => {
      const dt = this.introTimer - b.start;
      if (dt > 0 && dt < b.duration) {
        const tN = dt / b.duration;
        const alpha = tN < 0.5 ? tN * 2 : 1 - (tN - 0.5) * 2;
        const px = this.x + Math.cos(b.angle) * b.radius;
        const py = this.y + Math.sin(b.angle) * b.radius;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = b.color;
        ctx.font = `${b.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(b.text, px, py);
        ctx.restore();
      }
    });
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
  onStart() {}
onComplete() {}
onFail() {}

// ---------------------------------------------------------------------------
  debugDraw(ctx) {}

  reset() {
    this.playIntro = true;
    this.introTimer = 0;
    this._codeBursts = [];
    this._spawned = false;
    this.glitchColor = randomRGBColor();
    this.glitchTimer = 0;
    this.isReadyToPlay = false;

  }
  // ---------------------------------------------------------------------------
// 8. Structural Requirements
// ---------------------------------------------------------------------------
get behaviorType() {
  return 'survival';
}

isReady() {
  return !this.playIntro;
}

}
