// src/libs/OverlayFX.js
// Erase-play-area-border effects on the universal FX canvas.
// NEW: length-wise fold from both ends → center (and reverse on outro).
// Optional center "gapPx" leaves middle visible (e.g., paddle width) to sell
// the morph illusion; if omitted, it erases the whole edge.
//
// Events:
//   bus.emit('playArea/hideTopEdge',    { wipeMs, outMs, delayMs, pad, gapPx })
//   bus.emit('playArea/hideBottomEdge', { ... })
//   bus.emit('playArea/hideLeftEdge',   { ... })
//   bus.emit('playArea/hideRightEdge',  { ... })
//   bus.emit('playArea/clearEdgeMasks', { animate:true, outMs })
//
// Notes:
// - wipeMs defaults to 2500ms to match Circle paddle intro pacing.
// - outMs defaults to 200ms for a quick reverse.
// - gapPx (optional): leave this many px visible in the middle at the end.
//   If you pass your paddle/platform width, the edge appears to morph into it.

export default class OverlayFX {
  constructor({ fxCtx, playArea, bus }) {
    this.ctx = fxCtx;
    this.playArea = playArea;
    this.bus = bus;
    this.items = []; // { side,pad,wipeMs,outMs,delayMs,gapPx,t0,state,token }
    this._scope = 0; // shape scope
    this._bind();
    this._suppress = false;
  }

  _bind() {
    const spawn = (side, p = {}) => {
      if (this._suppress) return;
  const now     = performance.now();
  const wipeMs  = Number.isFinite(+p.wipeMs) ? +p.wipeMs : (window.EDGE_VEIL_MS || 3000);          // universal intro
  const outMs   = Number.isFinite(+p.outMs)  ? +p.outMs  : (window.EDGE_VEIL_OUTRO_MS || 180);     // universal outro
  const delayMs = Math.max(0, +p.delayMs || 0);
  const pad     = Number.isFinite(p.pad) ? +p.pad : 2;
  const gapPx   = 0;                                       // always shrink to 0 for the pure illusion
  const ease    = (p.ease === 'cubic') ? 'cubic' : (window.EDGE_VEIL_EASE || 'linear');

  // de-dupe same side for current scope
  this.items = this.items.filter(it => !(it.token === this._scope && it.side === side && it.state !== 'out'));
  this.items.push({ side, pad, wipeMs, outMs, delayMs, gapPx, ease, t0: now, state: 'in', token: this._scope });
};
this.bus.on('run:ending', () => { this._suppress = true; });
this.bus.on('run:end',    () => { this._suppress = true; });
this.bus.on('run:start',  () => { this._suppress = false; });
    // scope bump for each new shape/minigame
    this.bus.on('playArea/edgeScope', (p = {}) => {
      this._scope = Number.isFinite(+p.token) ? +p.token : (this._scope + 1);
      this.items = this.items.filter(it => it.token === this._scope);
    });

    this.bus.on('playArea/hideTopEdge',    p => spawn('top',    p));
    this.bus.on('playArea/hideBottomEdge', p => spawn('bottom', p));
    this.bus.on('playArea/hideLeftEdge',   p => spawn('left',   p));
    this.bus.on('playArea/hideRightEdge',  p => spawn('right',  p));

    // Force all current-scope veils to their end-of-intro state immediately
this.bus.on('playArea/finishEdgeMasks', () => {
  const now = performance.now();
  for (const it of this.items) {
    if (it.token !== this._scope) continue;
    it.state = 'steady';
    // make elapsedIn clamp to 1 on next draw
    it.t0 = now - it.wipeMs - (it.delayMs || 0);
  }
});
    // smooth reverse wipe (lets in-progress intros reverse from current progress)
    this.bus.on('playArea/clearEdgeMasks', (p = {}) => {
  const animate = p.animate !== false; // default true

  // During end-fade, ignore unsolicited clears (shapes resetting), but allow forced clear.
  if (this._suppress && !p.__force) return;

  if (!animate) {
    this.items = this.items.filter(it => it.token !== this._scope);
    return;
  }
  const now = performance.now();
  for (const it of this.items) {
    if (it.token !== this._scope) continue;

    // figure out current "in" progress (0..1)
    const easeFn = (it.ease === 'cubic') ? this._easeCubic : this._easeLinear;
    const elapsedIn = Math.max(0, now - it.t0 - (it.delayMs || 0));
    const inP = (it.state === 'in')
      ? easeFn(Math.min(1, elapsedIn / it.wipeMs))
      : 1; // steady means fully hidden

    // start a real reverse from *current* progress
    it.state = 'out';
    it.outStartP = inP;    // <-- remember where to start
    it.t0 = now;           // elapsed for outro starts at 0
  }
});
  }

  // cubic in-out
  _ease(t){ t=Math.max(0,Math.min(1,t)); return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
  _easeCubic(t){ t=Math.max(0,Math.min(1,t)); return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }
  _easeLinear(t){ return Math.max(0, Math.min(1, t)); }

  // map play area to CSS pixels
  _map(){
  const rect   = this.playArea.canvas.getBoundingClientRect();
  const scale  = rect.width / this.playArea.canvas.width;  // square scale
  const x      = rect.left + this.playArea.x * scale;
  const y      = rect.top  + this.playArea.y * scale;
  const s      = this.playArea.size * scale;

  const dpr    = Math.max(1, window.devicePixelRatio || 1);
  const base   = this.playArea.borderPx || 2;
  const lwDev  = Math.max(1, Math.round(base * dpr)); // quantize to device px
  const edgeC  = lwDev / dpr;                         // canvas px
  const edge   = edgeC * scale;                       // CSS px used on FX

  // corner radius in CSS pixels (for better veil coverage near curves)
  const cornerR = Math.max(0, (this.playArea.cornerRadiusPx || 0) * scale);

  return { x, y, s, edge, cornerR };
}


  tick(){
    const now = performance.now();
    this.items = this.items.filter(it => {
      const elapsed = now - it.t0 - (it.delayMs || 0);
      if (it.token !== this._scope) {
        // keep old scopes only to finish their outro
        return it.state === 'out' && elapsed < it.outMs;
      }
      if (it.state === 'in')   { if (elapsed >= it.wipeMs) it.state = 'steady'; return true; }
      if (it.state === 'out')  return elapsed < it.outMs;
      return true;
    });
  }

  _drawItem(it){
    const { x, y, s, edge, cornerR } = this._map();
    const now = performance.now();
    const elapsed = Math.max(0, now - it.t0 - (it.delayMs || 0));
    const overshootIn = Math.max(
  7,                                   // floor: +7 px inward
  Math.ceil(edge * 1.32 + Math.min(cornerR, edge * 2.5) * 0.48)
);
 // slightly taller near curves → no peeking anywhere
    const targetTh    = edge + it.pad * 2 + overshootIn;
    const easeFn = (it.ease === 'cubic') ? this._easeCubic : this._easeLinear;

let p;
if (it.state === 'out') {
  // reverse smoothly from the point we were at when clear was called
  const start = (typeof it.outStartP === 'number') ? it.outStartP : 1;
  p = start * (1 - easeFn(Math.min(1, elapsed / it.outMs)));
} else {
  // 'in' or 'steady' share the same curve; steady clamps to 1 via elapsed clamping
  p = easeFn(Math.min(1, elapsed / it.wipeMs));
}

    // compute how much of the side (on each end) is erased
const visibleGap = Math.min(Math.max(0, it.gapPx || 0), s);
const maxPerEnd  = (s - visibleGap) / 2;      // how far each end travels at p=1

// base travel
let L = maxPerEnd * p;

// ensure both halves overlap at center by ~½ thickness so no 1px survives
const overlap = Math.max(1, Math.ceil(targetTh * 0.5));
const L2 = Math.min(maxPerEnd + overlap, L + overlap);

const ctx = this.ctx;
ctx.save();
ctx.globalCompositeOperation = 'destination-out';
ctx.fillStyle = '#000';

// two rectangles per edge: one from each end towards the center (rounded endcaps)
const ext = 6;
const r   = Math.max(0, Math.min(targetTh / 2, 6)); // gentle round ends

switch (it.side) {
  case 'top': {
    const y0 = y - targetTh / 2;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x - ext,     y0, Math.max(0, L2 + ext), targetTh, r);
      ctx.roundRect(x + s - L2,  y0, Math.max(0, L2 + ext), targetTh, r);
      ctx.fill();
    } else {
      ctx.fillRect(x - ext,     y0, Math.max(0, L2 + ext), targetTh);
      ctx.fillRect(x + s - L2,  y0, Math.max(0, L2 + ext), targetTh);
    }
    break;
  }
  case 'bottom': {
    const y0 = y + s - (targetTh - targetTh / 2);
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x - ext,     y0, Math.max(0, L2 + ext), targetTh, r);
      ctx.roundRect(x + s - L2,  y0, Math.max(0, L2 + ext), targetTh, r);
      ctx.fill();
    } else {
      ctx.fillRect(x - ext,     y0, Math.max(0, L2 + ext), targetTh);
      ctx.fillRect(x + s - L2,  y0, Math.max(0, L2 + ext), targetTh);
    }
    break;
  }
  case 'left': {
    const x0 = x - targetTh / 2;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x0, y - ext,         targetTh, Math.max(0, L2 + ext), r);
      ctx.roundRect(x0, y + s - L2,      targetTh, Math.max(0, L2 + ext), r);
      ctx.fill();
    } else {
      ctx.fillRect(x0, y - ext,          targetTh, Math.max(0, L2 + ext));
      ctx.fillRect(x0, y + s - L2,       targetTh, Math.max(0, L2 + ext));
    }
    break;
  }
  case 'right': {
    const x0 = x + s - (targetTh - targetTh / 2);
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x0, y - ext,         targetTh, Math.max(0, L2 + ext), r);
      ctx.roundRect(x0, y + s - L2,      targetTh, Math.max(0, L2 + ext), r);
      ctx.fill();
    } else {
      ctx.fillRect(x0, y - ext,          targetTh, Math.max(0, L2 + ext));
      ctx.fillRect(x0, y + s - L2,       targetTh, Math.max(0, L2 + ext));
    }
    break;
  }
}

ctx.restore();

// last-frame safety: if we’ve essentially finished and there's no intentional gap,
// stamp a tiny center plug so nothing survives numerically
if (p >= 0.995 && (!it.gapPx || it.gapPx <= 0)) {
  const m  = Math.max(2, Math.ceil(targetTh));
  const cx = x + s / 2, cy = y + s / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  if (it.side === 'top' || it.side === 'bottom') {
    ctx.fillRect(cx - m / 2, (it.side === 'top' ? y - targetTh / 2 : y + s - targetTh / 2), m, targetTh);
  } else {
    ctx.fillRect((it.side === 'left' ? x - targetTh / 2 : x + s - targetTh / 2), cy - m / 2, targetTh, m);
  }
  ctx.restore();
}
  }

  // RETURN current veil progress per side (0..1), max across active items
getVeilProgress() {
  const now = performance.now();
  const sides = { top: 0, right: 0, bottom: 0, left: 0 };

  const ease = this._easeCubic.bind(this);
  for (const it of this.items) {
    const elapsed = Math.max(0, now - it.t0 - (it.delayMs || 0));
    let p = 0;
    if (it.state === 'out') {
      const start = (typeof it.outStartP === 'number') ? it.outStartP : 1;
      p = start * (1 - ease(Math.min(1, elapsed / it.outMs)));
    } else {
      p = ease(Math.min(1, elapsed / it.wipeMs));
    }
    if (it.side === 'top')    sides.top    = Math.max(sides.top, p);
    if (it.side === 'right')  sides.right  = Math.max(sides.right, p);
    if (it.side === 'bottom') sides.bottom = Math.max(sides.bottom, p);
    if (it.side === 'left')   sides.left   = Math.max(sides.left, p);
  }
  return sides;
}

  render(){
    if (!this.items.length) return;
    const now = performance.now();
    for (const it of this.items) {
      const elapsed = now - it.t0 - (it.delayMs || 0);
      const canDrawOld = it.state === 'out' && elapsed < it.outMs;
      if (it.token === this._scope || canDrawOld) this._drawItem(it);
    }
  }
}