//PlayArea.js
// src/PlayArea.js
import EventBus from './libs/EventBus.js';

export default class PlayArea {
  constructor(canvas, { top = 100, padding = 0, borderPx = 3 } = {}) {
    this._introRect = null;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.top = top; // distance from canvas top
    this.padding = padding; // internal padding if you want some later
    this.borderPx = borderPx; // logical px (we’ll scale for DPR)
    this.cornerRadiusPx = 8;
    this.dpr = window.devicePixelRatio || 1;

    // geometry we export to shapes (keeps your current API intact)
    this.x = 0;
    this.y = 0;
    this.size = 0;

    // visual state
    this._fadeAlpha = 1; // for smooth return between shapes
    this._fadeVel = 0;
    this._pulseOn = false; // ∞-mode border pulse
    this._pulseColor = '#FFFFFF';

    this.bus = new EventBus(); // local, if you ever want to listen

    this._compute();
    this.exportGlobals();
    this._locked = false;
  }
  // --- keep the play area permanently visible once the game starts ---
  lockVisible() {
    // prevent any future intros/fades from muting the border
    this._locked = true;
    this._introActive = false;
    this._fadeAlpha = 1; // fully visible
    this._fadeDuration = 0;
  }

  unlockVisible() {
    this._locked = false;
  }

  resetIntro() {
    // hard-clear any previous intro/fade so a new run starts from a clean state
    this._intro = null;
    this._introRect = null;
    this._handoffMs = 0;
    this._introActive = false;

    // cancel any in-flight fade tween and start fully hidden (caller will fade in)
    this._fadeStart = null;
    this._fadeFrom = 0;
    this._fadeTarget = 0;
    this._fadeDuration = 0;
    this._fadeAlpha = 0;

    // allow new intros after prior lockVisible()
    this._locked = false;
  }

  setTop(top) {
    this.top = top;
    this._compute();
    this.exportGlobals();
  }

  setPulse(active, color = '#FFFFFF') {
    this._pulseOn = !!active;
    if (color) this._pulseColor = color;
  }

  fadeInBorders(durationMs = 250) {
    // allow fade-in even when locked (lock only prevents intros)
    this._fadeFrom = Number.isFinite(this._fadeAlpha) ? this._fadeAlpha : 0;
    this._fadeTarget = 1;
    this._fadeDuration = Math.max(1, durationMs | 0);
    this._fadeStart = performance.now();
  }

  fadeOutBorders(durationMs = 250, opts = {}) {
    // If an intro is running, ignore fade-out unless explicitly forced.
    if ((this._intro || this._introActive) && !opts.force) return;

    this._fadeFrom = Number.isFinite(this._fadeAlpha) ? this._fadeAlpha : 1;
    this._fadeTarget = 0;
    this._fadeDuration = Math.max(1, durationMs | 0);
    this._fadeStart = performance.now();
  }

  fadeTo(alpha = 1, durationMs = 250) {
    this._fadeFrom = Number.isFinite(this._fadeAlpha) ? this._fadeAlpha : alpha > 0 ? 0 : 1;
    this._fadeTarget = Math.max(0, Math.min(1, alpha));
    this._fadeDuration = Math.max(1, durationMs | 0);
    this._fadeStart = performance.now();
  }
  // --- Intro state ---
  beginIntro(variant = 'wipe', ms = 2000) {
    // If locked, keep border visible and skip any intro/fade churn
    if (this._locked) {
      this._intro = null;
      this._introActive = false;
      this._fadeAlpha = 1;
      return;
    }

    // Intro is now running (guards fadeOutBorders while active)
    this._introActive = true;
    this._intro = { variant, t0: performance.now(), dur: ms };

    // draw static border on FX for ~2 frames after the anim completes, then swap
    this._handoffMs = 34;

    // cache rect once to avoid subpixel/layout drift during the intro
    this._introRect = this.canvas.getBoundingClientRect();
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this._compute();
    this.exportGlobals();
  }

  exportGlobals() {
    window.playAreaX = this.x;
    window.playAreaY = this.y;
    window.playAreaSize = this.size;
    window.playAreaBorderPx = this.borderPx; // NEW: for paddle/platform alignment
  }

  _compute() {
    const c = this.canvas;
    const w = c.width;
    const h = c.height;

    // Make the play area a perfect square, centered horizontally.
    const usableH = Math.max(0, h - this.top);
    const size = Math.max(0, Math.min(w, usableH)) - this.padding * 2;

    this.size = Math.floor(size);
    this.x = Math.floor((w - this.size) / 2);
    this.y = Math.floor(this.top + (usableH - this.size) / 2);
  }

  draw(deltaMs = 0) {
    const ctx = this.ctx;
    const { x, y, size } = this;

    // evolve fade tween (works for both fade-in and fade-out)
    if (this._fadeStart != null) {
      const t = Math.min(1, (performance.now() - this._fadeStart) / (this._fadeDuration || 1));
      const ease = t * t * (3 - 2 * t);
      this._fadeAlpha = this._fadeFrom + (this._fadeTarget - this._fadeFrom) * ease;
      if (t >= 1) this._fadeStart = null;
    }

    // DPR-aligned geometry
    const d = this.dpr;
    const lwDev = Math.max(1, Math.round(this.borderPx * d)); // device px
    const axC = Math.round(x * d) / d;
    const ayC = Math.round(y * d) / d;
    const asC = Math.round(size * d) / d;

    // color & subtle halo (keeps your previous look)
    let color = this._pulseOn ? this._pulseColor : '#FFFFFF';
    let shadow = this._pulseOn ? this._pulseColor : 'transparent';
    let shadowBlur = 0;
    if (this._pulseOn) {
      const t = performance.now() * 0.004;
      shadowBlur = 22 + 10 * Math.abs(Math.sin(t));
    }

    // keep exporting x/y/size as your shapes expect
    this.exportGlobals();
  }

  // Draw the infinite-mode glow on the full-screen FX canvas (not clipped by game canvas)
  drawGlowFX(fxCtx) {
    if (!this._pulseOn || !fxCtx) return;

    // Map play-area (canvas space) → viewport CSS pixels
    const rect = this._introRect || this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;

    const ax = rect.left + this.x * scaleX;
    const ay = rect.top + this.y * scaleY;
    const as = this.size * scaleX;

    // ── Smooth, slower pulse (~2.1s) to match HUD
    const dur = 2100;
    const phase = (performance.now() % dur) / dur;
    const ease = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2); // cosine ease in/out

    // Thicker core so it reads like the HUD “saber” border
    const dpr = window.devicePixelRatio || 1;
    const corePx = 2;

    fxCtx.save();

    // Preserve hue better than 'lighter' (less wash-out toward white)
    fxCtx.globalCompositeOperation = 'screen';

    // ── PASS 1: wide halo (HUD: 32px → 48px), subtle alpha
    fxCtx.globalAlpha = (0.2 + 0.08 * ease) * this._fadeAlpha;
    fxCtx.shadowColor = this._pulseColor;
    fxCtx.shadowBlur = 32 + 16 * ease; // 32px at rest, 48px at peak
    fxCtx.fillStyle = this._pulseColor;

    fxCtx.fillRect(ax, ay, as, corePx);
    fxCtx.fillRect(ax, ay + as - corePx, as, corePx);
    fxCtx.fillRect(ax, ay, corePx, as);
    fxCtx.fillRect(ax + as - corePx, ay, corePx, as);

    // ── PASS 2: inner halo (HUD: 16px → 24px)
    fxCtx.globalAlpha = (0.35 + 0.15 * ease) * this._fadeAlpha;
    fxCtx.shadowBlur = 16 + 8 * ease; // 16px at rest, 24px at peak

    fxCtx.fillRect(ax, ay, as, corePx);
    fxCtx.fillRect(ax, ay + as - corePx, as, corePx);
    fxCtx.fillRect(ax, ay, corePx, as);
    fxCtx.fillRect(ax + as - corePx, ay, corePx, as);

    fxCtx.restore();
  }

  drawIntroFX(fxCtx) {
    if (!fxCtx) return;
    // evolve fade tween even when the main loop is gated during intros
    if (this._fadeStart != null) {
      const t = Math.min(1, (performance.now() - this._fadeStart) / (this._fadeDuration || 1));
      const ease = t * t * (3 - 2 * t);
      this._fadeAlpha = this._fadeFrom + (this._fadeTarget - this._fadeFrom) * ease;
      if (t >= 1) this._fadeStart = null;
    }
    const phase = this._introPhase();
    if (phase === 'done') return;

    // Map game-canvas-aligned rect → viewport CSS px for the FX layer
    const rect = this._introRect || this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.canvas.width;
    const d = this.dpr;

    // Use the SAME alignment/thickness math as draw() so there is no “jump”
    const lwDev = Math.max(1, Math.round(this.borderPx * d));
    const axC = Math.round(this.x * d) / d;
    const ayC = Math.round(this.y * d) / d;
    const asC = Math.round(this.size * d) / d;
    const edgeC = lwDev / d;

    const dpr = window.devicePixelRatio || 1;
    const snap = (v) => Math.round(v * dpr) / dpr;

    const ax = snap(rect.left + axC * scaleX);
    const ay = snap(rect.top + ayC * scaleX);
    const as = snap(asC * scaleX);
    const edge = snap(edgeC * scaleX);

    const color = '#FFFFFF';
    const p = this._introProgress();

    fxCtx.save();
    fxCtx.fillStyle = color;
    fxCtx.globalAlpha = this._fadeAlpha;

    // Helper to draw the full static border (identical outline to gameplay),
    // rendered as a single ring path using even-odd so semi-transparent layers don’t halo.
    const drawFullBorder = () => {
      const r = Math.max(0, snap((this.cornerRadiusPx || 0) * scaleX));
      const rIn = Math.max(0, snap(r - edge));

      const xOut = ax,
        yOut = ay,
        wOut = as,
        hOut = as,
        radOut = r;
      const xIn = ax + edge,
        yIn = ay + edge,
        wIn = as - 2 * edge,
        hIn = as - 2 * edge,
        radIn = Math.max(0, rIn);

      fxCtx.beginPath();

      if (typeof fxCtx.roundRect === 'function') {
        // Outer rounded rect, then inner (reversed) — even-odd keeps it a ring
        fxCtx.roundRect(xOut, yOut, wOut, hOut, radOut);
        fxCtx.roundRect(xIn, yIn, wIn, hIn, radIn);
      } else {
        // Fallback round-rect helper
        const rr = (ctx, x, y, w, h, r) => {
          const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
          ctx.moveTo(x + rad, y);
          ctx.arcTo(x + w, y, x + w, y + h, rad);
          ctx.arcTo(x + w, y + h, x, y + h, rad);
          ctx.arcTo(x, y + h, x, y, rad);
          ctx.arcTo(x, y, x + w, y, rad);
          ctx.closePath();
        };
        rr(fxCtx, xOut, yOut, wOut, hOut, radOut);
        rr(fxCtx, xIn, yIn, wIn, hIn, radIn);
      }

      try {
        fxCtx.fill('evenodd');
      } catch {
        fxCtx.fill();
      }
    };

    if (phase === 'anim') {
      const v = this._intro?.variant || 'wipe';

      if (v === 'scale') {
        // Ripple with initial fade-in + tiny snap bump at the end of each layer
        const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
        const smoothstep = (a, b, x) => {
          const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
          return t * t * (3 - 2 * t);
        };

        const LAYERS = 3;
        const SPACING = 0.2;
        const s0 = 0.72; // start closer to final
        const BUMP = 0.04; // ~4% overshoot “snap”
        const cx = ax + as / 2,
          cy = ay + as / 2;

        // global fade-in over the first ~18% so it never pops on
        const fadeIn = smoothstep(0.0, 0.18, p);

        for (let i = 0; i < LAYERS; i++) {
          const lag = i * SPACING;
          const prog = easeInOut(p);
          const u = Math.max(0, Math.min(1, (prog - lag) / (1 - lag)));
          if (u <= 0) continue;

          // base scale toward final
          let s = s0 + (1 - s0) * u;

          // snap bump as the layer arrives (ends cleanly at 1.0 so no residue)
          const tEnd = smoothstep(0.82, 1.0, u);
          s *= 1 + Math.sin(Math.PI * tEnd) * BUMP;

          fxCtx.save();
          fxCtx.translate(cx, cy);
          fxCtx.scale(s, s);
          fxCtx.translate(-cx, -cy);

          fxCtx.globalAlpha = (0.4 + 0.2 * i) * fadeIn * this._fadeAlpha;
          drawFullBorder();
          fxCtx.restore();
        }

        // lock: final frame is a full static border, identical to base canvas
        if (p >= 0.999) {
          fxCtx.globalAlpha = 1;
          drawFullBorder();
        }
      } else if (v === 'wipe') {
        // Rounded-corner perimeter wipe (clockwise). Matches final border exactly.
        const r = Math.max(0, snap((this.cornerRadiusPx || 0) * scaleX));
        const rIn = Math.max(0, snap(r - edge));
        const rc = Math.max(0, r - edge * 0.5); // centerline radius for speed
        const straight = Math.max(0, as - 2 * r);
        const arcLen = rc * (Math.PI / 2); // quarter-arc length
        const total = straight * 4 + arcLen * 4;

        let prog = total * p; // length to draw so far

        // helpers
        const take = (L) => {
          const t = Math.max(0, Math.min(prog, L));
          prog -= t;
          return t;
        };
        const arcSeg = (cx, cy, a0, frac) => {
          if (frac <= 0) return;
          const a1 = a0 + (Math.PI / 2) * Math.max(0, Math.min(1, frac));
          fxCtx.beginPath();
          fxCtx.arc(cx, cy, r, a0, a1, false);
          if (rIn > 0) fxCtx.arc(cx, cy, rIn, a1, a0, true);
          fxCtx.closePath();
          // use evenodd to keep ring thickness without compositing swaps
          try {
            fxCtx.fill('evenodd');
          } catch {
            fxCtx.fill();
          }
        };

        // 1) top straight (→)
        {
          const len = take(straight);
          if (len > 0) fxCtx.fillRect(ax + r, ay, len, edge);
        }
        // 2) top-right corner (↷)
        {
          const len = take(arcLen);
          arcSeg(ax + as - r, ay + r, 1.5 * Math.PI, len / Math.max(1e-6, arcLen));
        }
        // 3) right straight (↓)
        {
          const len = take(straight);
          if (len > 0) fxCtx.fillRect(ax + as - edge, ay + r, edge, len);
        }
        // 4) bottom-right corner (↷)
        {
          const len = take(arcLen);
          arcSeg(ax + as - r, ay + as - r, 0, len / Math.max(1e-6, arcLen));
        }
        // 5) bottom straight (←)
        {
          const len = take(straight);
          if (len > 0) fxCtx.fillRect(ax + as - r - len, ay + as - edge, len, edge);
        }
        // 6) bottom-left corner (↷)
        {
          const len = take(arcLen);
          arcSeg(ax + r, ay + as - r, 0.5 * Math.PI, len / Math.max(1e-6, arcLen));
        }
        // 7) left straight (↑)
        {
          const len = take(straight);
          if (len > 0) fxCtx.fillRect(ax, ay + as - r - len, edge, len);
        }
        // 8) top-left corner (↷)
        {
          const len = take(arcLen);
          arcSeg(ax + r, ay + r, Math.PI, len / Math.max(1e-6, arcLen));
        }

        // Lock to the exact static border on the very last frame
        if (p >= 0.999) {
          fxCtx.globalAlpha = 1;
          drawFullBorder();
        }
      } else if (v === 'grid') {
        // Center-out tracers + corners that GROW IN (angle + alpha), rounded and snapped.
        const r = Math.max(0, snap((this.cornerRadiusPx || 0) * scaleX));
        const rIn = Math.max(0, snap(r - edge));
        const straight = Math.max(0, as - 2 * r); // straight run excluding corners
        const half = straight / 2;

        // progress + easing
        const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
        const u = easeInOut(p);
        const L = half * Math.max(0, Math.min(1, u)); // tracer length from center

        // Corner growth is tied to how close tracers are to the corners (distance-based).
        // Starts ~70% of the way out, then ramps to full over the last ~30%.
        const cornerProg = Math.max(0, Math.min(1, (L - half * 0.7) / Math.max(1e-6, half * 0.3)));
        const cornerFrac = 1 - Math.pow(1 - cornerProg, 3); // easeOutCubic for sweep
        const cornerAlpha = cornerFrac; // alpha grows with sweep

        // ---- Tracers (center → corners), pixel-snapped like HUD
        // top
        fxCtx.fillRect(ax + as / 2 - L, ay, L, edge);
        fxCtx.fillRect(ax + as / 2, ay, L, edge);
        // bottom
        fxCtx.fillRect(ax + as / 2 - L, ay + as - edge, L, edge);
        fxCtx.fillRect(ax + as / 2, ay + as - edge, L, edge);
        // left
        fxCtx.fillRect(ax, ay + as / 2 - L, edge, L);
        fxCtx.fillRect(ax, ay + as / 2, edge, L);
        // right
        fxCtx.fillRect(ax + as - edge, ay + as / 2 - L, edge, L);
        fxCtx.fillRect(ax + as - edge, ay + as / 2, edge, L);

        // ---- Corner sweeps (partial quarter “donuts” 0..90°) with ALPHA ramp
        const cornerFracDrawA = (cx, cy, aStart, frac, alpha) => {
          if (frac <= 0 || alpha <= 0) return;
          const aEnd = aStart + (Math.PI / 2) * Math.max(0, Math.min(1, frac));

          // outer quarter (with alpha)
          fxCtx.save();
          fxCtx.globalAlpha = alpha * this._fadeAlpha;
          fxCtx.beginPath();
          fxCtx.moveTo(cx, cy);
          fxCtx.arc(cx, cy, r, aStart, aEnd);
          fxCtx.closePath();
          fxCtx.fill();

          // carve inner to keep ring thickness exact (use same alpha so the donut stays uniform)
          if (rIn > 0) {
            fxCtx.save();
            fxCtx.globalCompositeOperation = 'destination-out';
            fxCtx.globalAlpha = alpha;
            fxCtx.beginPath();
            fxCtx.moveTo(cx, cy);
            fxCtx.arc(cx, cy, rIn, aStart, aEnd);
            fxCtx.closePath();
            fxCtx.fill();
            fxCtx.restore();
          }
          fxCtx.restore();
        };

        // TL (π → 1.5π), TR (1.5π → 0), BR (0 → 0.5π), BL (0.5π → π)
        cornerFracDrawA(ax + r, ay + r, Math.PI, cornerFrac, cornerAlpha);
        cornerFracDrawA(ax + as - r, ay + r, 1.5 * Math.PI, cornerFrac, cornerAlpha);
        cornerFracDrawA(ax + as - r, ay + as - r, 0, cornerFrac, cornerAlpha);
        cornerFracDrawA(ax + r, ay + as - r, 0.5 * Math.PI, cornerFrac, cornerAlpha);

        // lock to exact static border on last frame
        if (p >= 0.999) {
          fxCtx.globalAlpha = 1;
          drawFullBorder();
        }
      } else if (v === 'assemble') {
        // Assemble one side at a time; corners *grow in smoothly* near the end of each side.
        const r = Math.max(0, snap((this.cornerRadiusPx || 0) * scaleX));
        const rIn = Math.max(0, snap(r - edge));
        const straight = Math.max(0, as - 2 * r); // usable straight run (no corners)

        const phaseLen = 0.25; // 4 equal phases
        const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);

        // Snap window/tuning for straight segments (unchanged feel)
        const SNAP_FRAC = 0.36; // 36% of each phase reserved for snap
        const EDGE_BUMP = 0.5; // up to +50% thicker during snap
        const LENGTH_BUMP = 0.1; // ±10% length stretch during snap

        // Corners start a bit late within each phase and grow to full sweep
        const CORNER_LAUNCH = 0.7; // start corners at 70% of the side's progress
        const cornerFracFrom = (t) => {
          const u = (t - CORNER_LAUNCH) / Math.max(1e-6, 1 - CORNER_LAUNCH);
          return easeOutCubic(Math.max(0, Math.min(1, u)));
        };

        // Split a local phase r∈[0..1] into travel progress + snap progress
        const splitProgress = (r) => {
          const travelFrac = 1 - SNAP_FRAC;
          const rTravel = Math.max(0, Math.min(1, r / Math.max(1e-6, travelFrac)));
          const rSnap = Math.max(0, Math.min(1, (r - travelFrac) / Math.max(1e-6, SNAP_FRAC)));
          return { rTravel, rSnap };
        };

        // Straight thickness / length during snap
        const thick = (uSnap) => edge * (1 + EDGE_BUMP * Math.sin(Math.PI * uSnap));
        const len = (uSnap, uPos) => {
          const Lbase = straight * Math.max(0, Math.min(1, uPos));
          return Math.min(straight, Lbase * (1 + LENGTH_BUMP * Math.sin(Math.PI * uSnap)));
        };

        // Draw helpers — keep inner edge pinned while thickness changes
        const drawTop = (uPos, uSnap) => {
          const epx = thick(uSnap),
            L = len(uSnap, uPos);
          const x = ax + r + (straight - L) / 2;
          const y = ay + edge - epx;
          fxCtx.fillRect(x, y, L, epx);
        };
        const drawRight = (uPos, uSnap) => {
          const epx = thick(uSnap),
            L = len(uSnap, uPos);
          const x = ax + as - epx;
          const y = ay + r + (straight - L) / 2;
          fxCtx.fillRect(x, y, epx, L);
        };
        const drawBottom = (uPos, uSnap) => {
          const epx = thick(uSnap),
            L = len(uSnap, uPos);
          const x = ax + r + (straight - L) / 2;
          const y = ay + as - edge;
          fxCtx.fillRect(x, y, L, epx);
        };
        const drawLeft = (uPos, uSnap) => {
          const epx = thick(uSnap),
            L = len(uSnap, uPos);
          const x = ax + edge - epx;
          const y = ay + r + (straight - L) / 2;
          fxCtx.fillRect(x, y, epx, L);
        };

        // Corner helper: draw a *partial* quarter donut (0..90° sweep)
        const drawCornerFrac = (cx, cy, aStart, frac) => {
          if (frac <= 0) return;
          const aEnd = aStart + (Math.PI / 2) * Math.max(0, Math.min(1, frac));
          fxCtx.save();
          fxCtx.globalCompositeOperation = 'source-over';
          fxCtx.beginPath();
          fxCtx.moveTo(cx, cy);
          fxCtx.arc(cx, cy, r, aStart, aEnd);
          fxCtx.closePath();
          fxCtx.fill();

          if (rIn > 0) {
            fxCtx.globalCompositeOperation = 'destination-out';
            fxCtx.beginPath();
            fxCtx.moveTo(cx, cy);
            fxCtx.arc(cx, cy, rIn, aStart, aEnd);
            fxCtx.closePath();
            fxCtx.fill();
          }
          fxCtx.restore();
        };

        // Full corners (used when a side is completed)
        const drawCornerFull = (cx, cy, a0, a1) => drawCornerFrac(cx, cy, a0, 1);

        // Map global progress p → local r∈[0..1] for each phase
        const local = (start) => Math.max(0, Math.min(1, (p - start) / phaseLen));

        // ── PHASES (top → right → bottom → left)

        // Top
        const r0 = local(0 * phaseLen);
        if (r0 < 1) {
          const { rTravel, rSnap } = splitProgress(r0);
          drawTop(easeOutCubic(rTravel), rSnap);

          const cf = cornerFracFrom(rTravel);
          drawCornerFrac(ax + r, ay + r, Math.PI, cf); // TL (π → 1.5π)
          drawCornerFrac(ax + as - r, ay + r, 1.5 * Math.PI, cf); // TR (1.5π → 0)
          fxCtx.restore();
          return;
        }
        drawTop(1, 1);
        drawCornerFull(ax + r, ay + r, Math.PI, 1.5 * Math.PI);
        drawCornerFull(ax + as - r, ay + r, 1.5 * Math.PI, 0);

        // Right
        const r1 = local(1 * phaseLen);
        if (r1 < 1) {
          const { rTravel, rSnap } = splitProgress(r1);
          drawRight(easeOutCubic(rTravel), rSnap);

          const cf = cornerFracFrom(rTravel);
          drawCornerFrac(ax + as - r, ay + r, 1.5 * Math.PI, cf); // TR
          drawCornerFrac(ax + as - r, ay + as - r, 0, cf); // BR
          fxCtx.restore();
          return;
        }
        drawRight(1, 1);
        drawCornerFull(ax + as - r, ay + r, 1.5 * Math.PI, 0);
        drawCornerFull(ax + as - r, ay + as - r, 0, 0.5 * Math.PI);

        // Bottom
        const r2 = local(2 * phaseLen);
        if (r2 < 1) {
          const { rTravel, rSnap } = splitProgress(r2);
          drawBottom(easeOutCubic(rTravel), rSnap);

          const cf = cornerFracFrom(rTravel);
          drawCornerFrac(ax + as - r, ay + as - r, 0, cf); // BR
          drawCornerFrac(ax + r, ay + as - r, 0.5 * Math.PI, cf); // BL
          fxCtx.restore();
          return;
        }
        drawBottom(1, 1);
        drawCornerFull(ax + as - r, ay + as - r, 0, 0.5 * Math.PI);
        drawCornerFull(ax + r, ay + as - r, 0.5 * Math.PI, Math.PI);

        // Left
        const r3 = local(3 * phaseLen);
        const { rTravel: rT3, rSnap: rS3 } = splitProgress(r3);
        drawLeft(easeOutCubic(rT3), rS3);
        const cfL = cornerFracFrom(rT3);
        drawCornerFrac(ax + r, ay + as - r, 0.5 * Math.PI, cfL); // BL
        drawCornerFrac(ax + r, ay + r, Math.PI, cfL); // TL
        if (r3 >= 1) {
          drawCornerFull(ax + r, ay + as - r, 0.5 * Math.PI, Math.PI);
          drawCornerFull(ax + r, ay + r, Math.PI, 1.5 * Math.PI);
        }

        // Lock: ensure the final frame equals the static rounded border
        if (p >= 0.999) {
          fxCtx.globalAlpha = 1;
          drawFullBorder();
        }
      }
    } else {
      // phase === 'hold' (currently unused, but kept for completeness)
      drawFullBorder();
    }

    fxCtx.restore();
  }
  // NEW: tell main.js whether the animated intro is still running
  isIntroAnimating() {
    return this._introPhase() === 'anim';
  }

  // Draw a static border onto the full-screen FX layer (rounded, colorized)
  drawStaticFXBorder(fxCtx, { useFade = true, strokeColor } = {}) {
    if (!fxCtx) return;

    // Canvas→CSS mapping (same as intros)
    const rect = this._introRect || this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.canvas.width;
    const d = this.dpr;

    // thickness quantized in device px → back to canvas px → to CSS px (snapped)
    const lwDev = Math.max(1, Math.round(this.borderPx * d));
    const axC = Math.round(this.x * d) / d;
    const ayC = Math.round(this.y * d) / d;
    const asC = Math.round(this.size * d) / d;
    const edgeC = lwDev / d;
    const dpr = window.devicePixelRatio || 1;
    const snap = (v) => Math.round(v * dpr) / dpr;

    const ax = snap(rect.left + axC * scaleX);
    const ay = snap(rect.top + ayC * scaleX);
    const as = snap(asC * scaleX);
    const edge = snap(edgeC * scaleX); // exact CSS width like HUD

    const alpha = useFade ? Math.max(0, Math.min(1, this._fadeAlpha)) : 1;
    if (alpha <= 0.001) return;

    const color = strokeColor || (this._pulseOn ? this._pulseColor : '#FFFFFF');
    const r = snap((this.cornerRadiusPx || 0) * scaleX);
    const rIn = Math.max(0, snap(r - edge)); // inner corner radius

    fxCtx.save();
    fxCtx.imageSmoothingEnabled = false;
    fxCtx.globalCompositeOperation = 'source-over'; // opaque like HUD
    fxCtx.globalAlpha = alpha;
    fxCtx.fillStyle = color;

    // ── Straight edges (skip corners) — pixel-snapped like CSS borders
    fxCtx.fillRect(ax + r, ay, as - 2 * r, edge); // top
    fxCtx.fillRect(ax + r, ay + as - edge, as - 2 * r, edge); // bottom
    fxCtx.fillRect(ax, ay + r, edge, as - 2 * r); // left
    fxCtx.fillRect(ax + as - edge, ay + r, edge, as - 2 * r); // right

    // ── Rounded corners (quarter “donuts”: outer fill then carve inner) — no overlap with straights
    const corner = (cx, cy, a0, a1) => {
      fxCtx.beginPath();
      fxCtx.moveTo(cx, cy);
      fxCtx.arc(cx, cy, r, a0, a1);
      fxCtx.closePath();
      fxCtx.fill();

      if (rIn > 0) {
        fxCtx.save();
        fxCtx.globalCompositeOperation = 'destination-out';
        fxCtx.beginPath();
        fxCtx.moveTo(cx, cy);
        fxCtx.arc(cx, cy, rIn, a0, a1);
        fxCtx.closePath();
        fxCtx.fill();
        fxCtx.restore();
      }
    };

    // TL (π → 1.5π), TR (1.5π → 0), BR (0 → 0.5π), BL (0.5π → π)
    corner(ax + r, ay + r, Math.PI, 1.5 * Math.PI);
    corner(ax + as - r, ay + r, 1.5 * Math.PI, 0);
    corner(ax + as - r, ay + as - r, 0, 0.5 * Math.PI);
    corner(ax + r, ay + as - r, 0.5 * Math.PI, Math.PI);

    fxCtx.restore();
  }

  // 0..1 progress while the “anim” phase is active
  _introProgress(now = performance.now()) {
    if (!this._intro) return 1;
    const t = (now - this._intro.t0) / this._intro.dur;
    return Math.max(0, Math.min(1, t));
  }
  _introPhase(now = performance.now()) {
    if (!this._intro) return 'done';
    const t = now - this._intro.t0;
    if (t < this._intro.dur) return 'anim';
    if (t < this._intro.dur + (this._handoffMs || 0)) return 'hold';
    // finish
    this._introRect = null;
    this._intro = null;
    this._introActive = false; // ← ensure future fades are allowed
    return 'done';
  }
}
