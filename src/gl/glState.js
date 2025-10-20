// src/gl/glState.js
// Shared state the overlay reads each frame.
// Use CSS pixels (not device pixels) for all rects.

const glState = {
  // clock
  timeSec: 0,

  // fades (0..1)
  fadeUI: 1,          // HUD fade (currently unused by Glow)
  fadeBorder: 1,      // PlayArea border fade

  // theme color (RGB 0..1)
  themeColor: [1, 1, 1],

  // PlayArea rectangle in CSS px [x, y, w, h]
  playAreaRectCSS: [0, 0, 0, 0],

    // Corner radius of the play area (CSS px)
  cornerRadiusCss: 12,
    borderPxCss: 2,

  // Veil progress from both ends toward the center (0..1)
  veilTop: 0, veilRight: 0, veilBottom: 0, veilLeft: 0,

  // Quality scaler (0 low, 1 med, 2 high)
  quality: 2,

  // internal
  _w: 0, _h: 0,       // viewport CSS size
};

export default glState;
