// src/gl/passes/GlowPass.js
// Fullscreen pass: draws PlayArea border glow with layered halos
// - Matches HUD pulse (~2.1s).
// - Respects veils (top/right/bottom/left progress, 0..1 from ends toward center).

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = (a_pos + 1.0) * 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Utility: smooth clamp 0..1 with width
const FS = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 o_col;

uniform vec2  u_viewCss;      // viewport size in CSS px
uniform float u_dpr;          // device pixel ratio used by GL overlay
uniform vec4  u_rectCss;      // PlayArea rect [x,y,w,h] in CSS px
uniform float u_radiusCss;    // corner radius in CSS px
uniform vec3  u_color;        // theme RGB 0..1 (sRGB)
uniform float u_time;         // seconds
uniform float u_fadeBorder;   // 0..1
uniform int   u_quality;      // 0..2
uniform vec4  u_veils;        // [top, right, bottom, left] 0..1 (kept for later; not used here)
uniform float u_borderCss;    // white stroke thickness in CSS px

// Signed distance to a rounded rectangle centered at origin.
// b = half-size (width/2, height/2); r = corner radius.
float sdRoundRect(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - (b - vec2(r));
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// simple gaussian
float g(float d, float s){ float t = d / max(0.0001, s); return exp(-t*t); }

void main(){
  vec2 fragCss = v_uv * u_viewCss;

  // Rect center / half size in CSS px
  vec2 Rmin = u_rectCss.xy;
  vec2 size = u_rectCss.zw;
  vec2 Rmax = Rmin + size;
  vec2 c        = (Rmin + Rmax) * 0.5;
  vec2 halfSize = size * 0.5;

  const float PERIOD = 1.6;                         // faster, smoother beat
float phase = mod(u_time, PERIOD);
float pulse = 0.5 - 0.5 * cos(phase * 6.2831853 / PERIOD);
pulse = smoothstep(0.0, 1.0, pulse);              // soften the turnarounds
  float q = (u_quality == 2 ? 1.0 : (u_quality == 1 ? 0.85 : 0.7));

  // Corner radius (clamp to half the min dimension)
  float r = clamp(u_radiusCss, 0.0, min(halfSize.x, halfSize.y) - 1.0);
  float d = sdRoundRect(fragCss - c, halfSize, r);
/* Hug bias (~0.6 CSS px) pulls the rim slightly onto the stroke so there’s no dark seam
   between the 2D line and the GL glow, even with AA and subpixel placement. */
float hugBias = 0.6;
float dEdge = d - (u_borderCss * 0.5 - hugBias);


 // Wider falloff + a very tight rim for the saber look
float sBig   = 90.0 * q;   // far colored bloom
float sMid   = 38.0 * q;   // mid bloom
float sSm    = 16.0 * q;   // near bloom
float sRim   = 3.0  * q;   // razor rim just outside the line

// push cutoff far enough so the falloff vanishes naturally
float pad = max(160.0, 8.0 * sBig);

if (fragCss.x < Rmin.x - pad || fragCss.x > Rmax.x + pad ||
    fragCss.y < Rmin.y - pad || fragCss.y > Rmax.y + pad) {
  o_col = vec4(0.0); return;
}

// De–intensified amplitudes (animated by pulse)
// Stronger overall; rim is the hot edge, others are colored bloom
float A_big   = (0.10  + 0.04 * pulse) * u_fadeBorder;
float A_mid   = (0.20  + 0.06 * pulse) * u_fadeBorder;
float A_small = (0.40  + 0.08 * pulse) * u_fadeBorder;
float A_rim   = (0.85  + 0.10 * pulse) * u_fadeBorder;  // tight, bright rim
// Subtle global gain that breathes with the pulse (0.9 → 1.3)
float pulseGain = mix(0.90, 1.30, pulse);


// Outside-only glow (keeps the interior perfectly clean)
float outside = step(0.0, dEdge);
float dv      = max(dEdge, 0.0);

// layered bloom + razor rim
float halo =
  pulseGain * (
    (A_big   * g(dv, sBig)) +
    (A_mid   * g(dv, sMid)) +
    (A_small * g(dv, sSm))  +
    (A_rim   * g(dv, sRim))
  );

// gentle shaping to feel “hot” without smashing to 1 instantly
float a = outside * (1.0 - exp(-halo * 1.35));
a = clamp(a, 0.0, 1.0);

  // sRGB-space blend to match 2D canvas/CSS style glows exactly
o_col = vec4(u_color * a, a);

}
`;

function createProg(gl, vs, fs){
  const v = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(v, vs); gl.compileShader(v);
  if (!gl.getShaderParameter(v, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(v)); gl.deleteShader(v); return null;
  }
  const f = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(f, fs); gl.compileShader(f);
  if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(f)); gl.deleteShader(v); gl.deleteShader(f); return null;
  }
  const p = gl.createProgram();
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p)); gl.deleteShader(v); gl.deleteShader(f); gl.deleteProgram(p); return null;
  }
  gl.deleteShader(v); gl.deleteShader(f);
  return p;
}

export default class GlowPass {
  constructor(gl){
    this.enabled = false;
    this.prog = createProg(gl, VS, FS);
    if (!this.prog) {
  console.error('[GlowPass] Shader program failed to compile/link.');
  this.enabled = false;
  // Prevent later calls from touching undefined objects
  this.render = () => {};
  this.resize = () => {};
  return;
}

    // Fullscreen triangle
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    // 3 vertices for a fullscreen tri
    const verts = new Float32Array([
      -1, -1,
       3, -1,
      -1,  3,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);

    // uniforms
    this.u = {};
    const u = (n)=> gl.getUniformLocation(this.prog, n);
    this.u.viewCss   = u('u_viewCss');
    this.u.dpr       = u('u_dpr');
    this.u.rectCss   = u('u_rectCss');
    this.u.color     = u('u_color');
    this.u.time      = u('u_time');
    this.u.fadeBorder= u('u_fadeBorder');
    this.u.quality   = u('u_quality');
    this.u.veils     = u('u_veils');
    this.u.radiusCss = u('u_radiusCss');
    this._cssW = 1; this._cssH = 1; this._dpr = 1;
    this._rect = [0,0,0,0];
    this._color = [1,1,1];
    this._fadeBorder = 1;
    this._veils = [0,0,0,0];
    this._quality = 2;
    this.u.borderCss = u('u_borderCss');
  }

  resize(cssW, cssH, dpr){
    this._cssW = cssW; this._cssH = cssH; this._dpr = dpr;
  }

  update(state){
    this._rect       = state.playAreaRectCSS.slice(0,4);
    this._color = (Array.isArray(state.themeColor) && state.themeColor.length >= 3)
  ? state.themeColor
  : [1,1,1];
    this._fadeBorder = state.fadeBorder;
    this._veils      = [state.veilTop, state.veilRight, state.veilBottom, state.veilLeft];
    this._quality    = state.quality;
    this._time       = state.timeSec;
    this._radius = Number(state.cornerRadiusCss || 0);
    this._borderCss = Number(state.borderPxCss || 0);
  }

  render(gl){
    if (!this.enabled) return;
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);

    gl.uniform2f(this.u.viewCss, this._cssW, this._cssH);
    gl.uniform1f(this.u.dpr, this._dpr);
    gl.uniform4f(this.u.rectCss, this._rect[0], this._rect[1], this._rect[2], this._rect[3]);
    gl.uniform3f(this.u.color, this._color[0], this._color[1], this._color[2]);
    gl.uniform1f(this.u.time, this._time);
    gl.uniform1f(this.u.fadeBorder, this._fadeBorder);
    gl.uniform1i(this.u.quality, this._quality);
    gl.uniform4f(this.u.veils, this._veils[0], this._veils[1], this._veils[2], this._veils[3]);
    gl.uniform1f(this.u.radiusCss, this._radius);
    gl.uniform1f(this.u.borderCss, this._borderCss);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  dispose(gl){
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.prog) gl.deleteProgram(this.prog);
  }
}
