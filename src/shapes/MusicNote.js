// ============================================================================
// Shape: MusicNote  |  src/shapes/MusicNote.js
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
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
export class MusicNote extends Shape {
  constructor(x, y, size, _ignoredColor, name = 'MusicNote') {
    super(x, y, size * 0.7, ' #000000ff'); // Slightly smaller again
    this.name = name;

    this._drawScale = 5;
    this._vbSize = 655.35999;
    this._halfVB = this._vbSize / 2;

    this.playIntro = true;
    this.introTimer = 0;
    this.fadeInTime = 800;
    this.introDuration = 1300;
    this.glintStart = this.introDuration;
    this.glintDuration = 600;
    this.isReadyToPlay = false;
    this.sequenceCompleted = false;

    this._introCenterX = x;
    this._introCenterY = y;

    const stepX = size * 1.8;
    const stepY = size * 1.2;
    this.jumpPoints = [
      { x: x - stepX * 2, y: y - stepY * 2 },
      { x: x - stepX, y: y - stepY },
      { x: x, y: y },
    ];

    this._path = new Path2D(
      `m 221.6,588.58163 c -10.13303,-0.51373 -22.14524,-2.88012 -32.33171,-6.3693 -10.1747,-3.48514 -21.17539,-9.73242 -29.13656,-16.54661 -13.74319,-11.76319 -22.18502,-26.75294 -24.63443,-43.74218 -0.7487,-5.19305 -0.50278,-16.54045 0.47166,-21.76355 3.09596,-16.59462 11.66425,-32.49977 24.78121,-46.00085 9.84728,-10.13566 20.0558,-17.52999 33.48983,-24.25766 34.55653,-17.3057 75.20138,-19.4699 107.39654,-5.71851 1.82467,0.77936 3.3909,1.41702 3.48052,1.41702 0.0896,0 0.16293,-58.83921 0.16293,-130.75381 0,-145.33537 -0.20816,-132.20337 2.17306,-137.08618 1.48543,-3.04595 5.57039,-7.28174 8.92612,-9.25573 4.94463,-2.90864 10.54433,-4.97265 17.54082,-6.46543 3.14465,-0.67095 4.35602,-0.75145 11.36,-0.75494 6.11363,-0.003 8.57988,0.12317 11.2,0.57317 9.63254,1.65438 17.90628,4.62936 28.8,10.3556 18.5139,9.73174 34.79103,25.98816 46.7268,46.66733 2.00686,3.47696 6.77614,13.11954 9.10075,18.4 0.65858,1.496 3.13272,7.83199 5.49809,14.07999 7.97073,21.05433 10.71041,27.62015 14.02007,33.6 5.09164,9.19955 8.45652,13.65277 16.65334,22.03974 5.27277,5.39509 10.81245,10.49731 15.44778,14.22788 4.59131,3.69516 14.60466,10.19277 19.38041,12.57585 5.01327,2.50161 11.82376,6.37304 13.03482,7.40965 3.36097,2.87687 3.65995,7.78768 0.66575,10.93523 -2.34997,2.47033 -9.58343,5.28072 -16.11775,6.26216 -4.12934,0.62021 -13.2362,0.60814 -18.07367,-0.024 -4.42415,-0.5781 -12.54284,-2.28045 -17.53639,-3.67709 -11.73359,-3.28176 -22.27148,-8.52019 -34.9148,-17.35629 -14.76695,-10.32026 -23.80695,-18.215 -37.09231,-32.39317 -4.45277,-4.752 -9.60712,-9.97893 -11.45411,-11.6154 -10.47505,-9.28113 -19.60835,-15.19296 -27.53445,-17.8226 -3.21461,-1.06651 -12.5886,-3.24439 -12.84798,-2.98501 -0.0741,0.0741 -0.18126,55.06364 -0.23806,122.1989 l -0.10327,122.06411 -0.71499,4.31907 c -1.52709,9.22469 -3.67769,15.91892 -7.78942,24.24628 -7.7289,15.65313 -20.44088,29.64137 -36.93925,40.64788 C 280.61289,581.9165 250.7238,590.05818 221.6,588.58163 Z`
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Intro Animation Helpers & State
  // ---------------------------------------------------------------------------
  update(deltaTime) {
    if (!this.playIntro) return;
    this.introTimer += deltaTime;
    if (this.introTimer >= this.introDuration + this.glintDuration) {
      this.playIntro = false;
      this.isReadyToPlay = true;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Drawing Functions
  // ---------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();
    const alpha = Math.min(1, this.introTimer / this.fadeInTime);
    ctx.globalAlpha = alpha;

    let drawX = this._introCenterX;
    let drawY = this._introCenterY;
    let scaleX = 1,
      scaleY = 1;

    const t = Math.min(1, this.introTimer / this.introDuration);
    if (this.playIntro && t < 1) {
      const ease = smoothstep(t);

      const [p0, p1, p2] = this.jumpPoints;
      const cp1 = { x: p0.x + 30, y: p0.y - 50 };
      const cp2 = { x: p1.x - 30, y: p1.y - 50 };
      const cp3 = { x: p1.x + 30, y: p1.y - 50 };
      const cp4 = { x: p2.x - 30, y: p2.y - 50 };

      const mid =
        ease < 0.5
          ? bezier(p0, cp1, cp2, p1, ease * 2)
          : bezier(p1, cp3, cp4, p2, (ease - 0.5) * 2);

      drawX = mid.x;
      drawY = mid.y;

      const bounce = Math.sin(ease * Math.PI * 4) * 0.15 * (1 - ease);
      scaleY = 1 + bounce;
      scaleX = 1 - bounce;
    }

    ctx.translate(drawX, drawY);
    ctx.scale(scaleX, scaleY);

    const scale = (this.size * this._drawScale) / this._vbSize;
    ctx.scale(scale, scale);
    ctx.translate(-this._halfVB, -this._halfVB);

    ctx.fillStyle = this.color;
    ctx.fill(this._path);

    // White outline
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke(this._path);

    // Surface glint
    const glintT = this.introTimer - this.glintStart;
    if (glintT >= 0 && glintT <= this.glintDuration) {
      const g = glintT / this.glintDuration;
      const glintX = this._vbSize * (0.1 + 0.8 * g);
      const grad = ctx.createLinearGradient(glintX - 35, 0, glintX + 35, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fill(this._path);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 4. Gameplay Logic (placeholder)
  // ---------------------------------------------------------------------------
  handleClick() {
    return false;
  }
  checkBoundary() {
    return false;
  }

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
  // ---------------------------------------------------------------------------
  debugDraw(ctx) {}

  reset() {
    this.playIntro = true;
    this.introTimer = 0;
    this.isReadyToPlay = false;
    this.sequenceCompleted = false;
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
    return this.sequenceCompleted ?? false;
  }
}
