// src/core/config.js
// Central timing/easing constants for gameplay & UI.
// Keep this lean; anything “feel” related should live here.

export const EDGE_VEIL_MS = 3000; // intro wipe duration (ms)
export const EDGE_VEIL_OUTRO_MS = 180; // veil reverse/outro (ms)
export const EDGE_VEIL_EASE = 'linear'; // veil easing keyword
export const EDGE_VEIL_OUTRO_PADDLE_MS = 200; // platform/paddle return (ms)

export const TRANSITION_DELAY = 0; // ms between shape complete → next step

export const INTRO_PLAY_MS = 2000; // PlayArea intro animation (ms)
export const INTRO_STEP_MS = 600; // 3•2•1•Start! step time (ms)
export const HUD_INTRO_MS = 850; // HUD pop-in during intro (ms)
export const SB_INTRO_MS = 850; // Scoreboard fade/typewriter start (ms)

export const TIMEBAR_FADE_MS = 600; // TimeBar opacity transition (ms)
export const TIMEBAR_HEIGHT = 10; // TimeBar canvas height (px)

// Optional helper to keep legacy window.* reads working (PlayArea/GL passes).
export function applyGlobalTimings() {
  window.EDGE_VEIL_MS = EDGE_VEIL_MS;
  window.EDGE_VEIL_OUTRO_MS = EDGE_VEIL_OUTRO_MS;
  window.EDGE_VEIL_EASE = EDGE_VEIL_EASE;
  window.EDGE_VEIL_OUTRO_PADDLE_MS = EDGE_VEIL_OUTRO_PADDLE_MS;
}

export default {
  EDGE_VEIL_MS,
  EDGE_VEIL_OUTRO_MS,
  EDGE_VEIL_EASE,
  EDGE_VEIL_OUTRO_PADDLE_MS,
  TRANSITION_DELAY,
  INTRO_PLAY_MS,
  INTRO_STEP_MS,
  HUD_INTRO_MS,
  SB_INTRO_MS,
  TIMEBAR_FADE_MS,
  TIMEBAR_HEIGHT,
  applyGlobalTimings,
};
