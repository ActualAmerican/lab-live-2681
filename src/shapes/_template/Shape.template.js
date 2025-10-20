/* @ts-check */
// Canonical template for Shape Contract v2: export { meta, create(ctx) } only.

export const meta = Object.freeze({
  id: 'TEMPLATE_ID',
  displayName: 'TEMPLATE_NAME',
  color: '#FFFFFF',
  behaviorType: 'trace', // 'trace'|'tap'|'hold'|'sequence'|'avoid'|'custom'
  flags: {
    usesEdgeVeils: false,
    needsTimer: true,
    usesOverlay: false,
    reducedMotionOk: true
  },
  timings: {
    introMs: 600,
    glintMs: 300,
    expectedMs: 20000
  },
  assets: [],
  version: 2
});

/**
 * @param {import('../../types/shapes').ShapeCtx} ctx
 * @returns {import('../../types/shapes').ShapeInstance}
 */
export function create(ctx) {
  let ready = false, done = false;

  return {
    onStart() {
      if (meta.flags.needsTimer) ctx.timer.pause();
      if (meta.flags.usesEdgeVeils) ctx.veils.hideBottom({ fadeMs: 220 });
      ctx.fx.glowPulse(meta.color, { ms: 220 });

      ctx.defer(meta.timings.introMs, () => {
        ready = true;
        if (meta.flags.needsTimer) ctx.timer.resume();
      });
    },

    update(dt) {
      if (!ready || done) return;
      // ... gameplay logic ...
      // when win:  done = true; ctx.complete();
      // when fail: done = true; ctx.fail();
    },

    isReadyToPlay() { return ready; },

    onComplete() {
      ctx.veils.finish();
      ctx.fx.confetti(meta.color, { ms: 220 });
    },

    draw(g) {
      // Pure render
    },

    onReducedMotionEnabled() {}
  };
}
