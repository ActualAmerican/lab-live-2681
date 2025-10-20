// src/gl/GLOverlay.js
// Minimal WebGL2 overlay with one pass (Glow). Fallbacks gracefully.

import glState from './glState.js';
import GlowPass from './passes/GlowPass.js';

// Accepts "#RGB", "#RRGGBB", "rgb/rgba(...)", "hsl/hsla(...)" or a named CSS color,
// or [r,g,b] where components are 0..255 or 0..1.
// Returns [r,g,b] in 0..1.
function toRGBf(input) {
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // Array input
  if (Array.isArray(input) && input.length >= 3) {
    const [r,g,b] = input;
    return [r>1?r/255:r, g>1?g/255:g, b>1?b/255:b].map(clamp01);
  }

  if (typeof input === 'string') {
    let s = input.trim();

    // Hex (#RGB or #RRGGBB)
    if (s[0] === '#') {
      if (s.length === 4) { // #RGB
        const r = parseInt(s[1]+s[1], 16);
        const g = parseInt(s[2]+s[2], 16);
        const b = parseInt(s[3]+s[3], 16);
        return [r/255, g/255, b/255];
      }
      if (s.length >= 7) { // #RRGGBB
        const r = parseInt(s.slice(1,3), 16);
        const g = parseInt(s.slice(3,5), 16);
        const b = parseInt(s.slice(5,7), 16);
        return [r/255, g/255, b/255];
      }
    }

    // rgb/rgba(...)
    {
      const m = s.match(/rgba?\s*\(\s*([\d.]+)[^\d]+([\d.]+)[^\d]+([\d.]+)/i);
      if (m) return [Number(m[1])/255, Number(m[2])/255, Number(m[3])/255].map(clamp01);
    }

    // hsl/hsla(...)
    {
      const m = s.match(/hsla?\s*\(\s*([\d.]+)[^\d]+([\d.]+)%[^\d]+([\d.]+)%/i);
      if (m) {
        let h = (Number(m[1]) % 360 + 360) % 360;
        let s_ = Number(m[2]) / 100;
        let l = Number(m[3]) / 100;
        // HSL -> RGB
        const c = (1 - Math.abs(2*l - 1)) * s_;
        const x = c * (1 - Math.abs(((h/60) % 2) - 1));
        const m0 = l - c/2;
        let r=0,g=0,b=0;
        if (0<=h && h<60)   { r=c; g=x; b=0; }
        else if (60<=h && h<120){ r=x; g=c; b=0; }
        else if (120<=h && h<180){ r=0; g=c; b=x; }
        else if (180<=h && h<240){ r=0; g=x; b=c; }
        else if (240<=h && h<300){ r=x; g=0; b=c; }
        else                      { r=c; g=0; b=x; }
        return [r+m0, g+m0, b+m0].map(clamp01);
      }
    }

    // Named CSS color fallback (browser parses it)
    try {
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillStyle = s;                  // if invalid, stays '#000000'
      const normalized = ctx.fillStyle;   // 'rgb(r, g, b)' or '#rrggbb'
      const m = normalized.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
      if (m) return [m[1]/255, m[2]/255, m[3]/255].map(Number).map(clamp01);
      if (normalized[0] === '#') {
        const r = parseInt(normalized.slice(1,3), 16);
        const g = parseInt(normalized.slice(3,5), 16);
        const b = parseInt(normalized.slice(5,7), 16);
        return [r/255, g/255, b/255];
      }
    } catch (_) {}
  }

  return [1,1,1]; // fallback
}

export default class GLOverlay {
  constructor(canvas) {
    this.canvas = canvas || document.getElementById('glOverlay');
    this.canvas.style.background = 'transparent';
    this.canvas.style.pointerEvents = 'none';
    this.active = false;
    this._dprClamp = Math.min(window.devicePixelRatio || 1, 1.75); // cap just for overlay
    this._lastNow = performance.now();
    this._quality = 2; // 0..2

    // Try WebGL2
    /** @type {WebGL2RenderingContext|null} */
    this.gl = this.canvas?.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    }) || null;

    if (!this.gl) {
      console.warn('[GLOverlay] WebGL2 not available — overlay disabled (2D fallback remains).');
      return;
    }

    this.gl.clearColor(0, 0, 0, 0);
this.gl.enable(this.gl.BLEND);
// premultiplied-alpha friendly: keeps the background visible and prevents dark sheets
this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

    // Single pass for now
    this.glow = new GlowPass(this.gl);

    this.active = true;
    this.resize(); // set sizes now
  }

  isActive(){ return !!this.active; }

  setThemeColor(colorLike) {
  const rgb = toRGBf(colorLike);
  glState.themeColor = rgb;        // <- single source of truth as floats
  // (Optional) push immediately to the active pass this frame
  this.glow?.update(glState);
}

  setPlayAreaRectCSS(x, y, w, h) { glState.playAreaRectCSS = [x, y, w, h]; }
  setFades({ ui = 1, border = 1 } = {}) { glState.fadeUI = ui; glState.fadeBorder = border; }
  setVeils({ top=0, right=0, bottom=0, left=0 } = {}) {
    glState.veilTop = top; glState.veilRight = right; glState.veilBottom = bottom; glState.veilLeft = left;
  }

  setGlowActive(active) {
    if (!this.gl) return;
    this.glow.enabled = !!active;
  }

  resize() {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this._dprClamp);

    // Match viewport in CSS pixels
    const cssW = Math.max(1, Math.round(window.innerWidth  || 1));
    const cssH = Math.max(1, Math.round(window.innerHeight || 1));
    glState._w = cssW; glState._h = cssH;

    // Backing store in device pixels (clamped)
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    // Ensure CSS size matches viewport
    this.canvas.style.width  = cssW + 'px';
    this.canvas.style.height = cssH + 'px';

    this.gl.viewport(0, 0, w, h);
    this.glow.resize(cssW, cssH, dpr);
  }

  _qualityGuard(now) {
    const dt = now - this._lastNow; // ms
    this._lastNow = now;

    // Soft/hard budget (ms)
    const SOFT = 14.0, HARD = 16.6;

    // crude: if we exceeded hard budget, drop quality one step (min 0)
    if (dt > HARD && this._quality > 0) this._quality--;
    // if we're well under soft budget for a few frames, bump quality back up
    if (dt < SOFT) this._underSoftCount = (this._underSoftCount || 0) + 1; else this._underSoftCount = 0;
    if (this._underSoftCount > 20 && this._quality < 2) { this._quality++; this._underSoftCount = 0; }

    glState.quality = this._quality;
  }

  render(now = performance.now()) {
    if (!this.active) return;

    this._qualityGuard(now);

    // clock in seconds
    glState.timeSec = now * 0.001;

    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    // One pass for now: Glow matches HUD pulse and respects edge veils
    this.glow.update(glState);
    this.glow.render(gl);
  }

  dispose() {
    if (!this.active) return;
    this.glow?.dispose?.(this.gl);
    this.active = false;
  }

    setCornerRadiusCSS(rCss) {
    // allow numbers or numeric strings; clamp sane
    const r = Math.max(0, Math.min(64, Number(rCss) || 0));
    glState.cornerRadiusCss = r;
  }
    setBorderThicknessCSS(px) {
    const v = Math.max(0, Number(px) || 0);
    glState.borderPxCss = v;
  }

}
