/* @ts-check */
// Verifier v2.1 — no imports; uses window.shapeRegistry + window.bus
const ALLOWED_VEIL_SHAPES = new Set(['Circle', 'Pentagon', 'Kite']);
const VALID_BEHAVIORS = new Set([
  'trace',
  'tap',
  'hold',
  'sequence',
  'avoid',
  'survival',
  'custom',
]);

function bus() {
  return window.bus || { emit() {}, on() {} };
}
function reg() {
  return Array.isArray(window.shapeRegistry) ? window.shapeRegistry : [];
}

function isFn(f) {
  return typeof f === 'function';
}
function isStr(s) {
  return typeof s === 'string' && s.length > 0;
}
function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function scratch() {
  if (!scratch.ctx) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    scratch.ctx = c.getContext('2d');
  }
  return scratch.ctx;
}

/** minimal ctx for v2 create(ctx) */
function fakeCtx() {
  return {
    timer: {
      pause() {},
      resume() {},
      msLeft() {
        return 0;
      },
      set() {},
    },
    veils: { hideTop() {}, hideBottom() {}, hideLeft() {}, hideRight() {}, finish() {} },
    fx: { glowPulse() {}, confetti() {}, shake() {} },
    audio: { sfx() {}, beat() {} },
    rand: {
      seed: 1,
      next() {
        return 0.5;
      },
      range(a, b) {
        return (a + b) / 2;
      },
    },
    input: {
      pointerDown: false,
      pointerPos: { x: 0, y: 0 },
      justTapped() {
        return false;
      },
    },
    score: {
      add() {},
      streak() {
        return 0;
      },
    },
    defer(ms, fn) {
      setTimeout(fn, 0);
    },
    complete() {},
    fail() {},
    flags: { reducedMotion: false },
    playArea: {
      bounds: { w: 512, h: 512 },
      clamp(x, y) {
        return { x, y };
      },
    },
  };
}

function verifyV1(entry) {
  const errs = [],
    warns = [],
    emits = [];
  const name = entry?.name || '(unnamed)';

  if (!isFn(entry?.classRef)) {
    errs.push('missing classRef (function/class)');
    return { id: name, ok: false, errs, warns, emits, format: 'v1' };
  }

  // Build instance with standard ctor signature (x,y,size,color,name)
  let inst;
  try {
    inst = new entry.classRef(128, 128, 64, entry.color || '#fff', name);
  } catch (e) {
    errs.push('new classRef threw: ' + (e?.message || e));
    return { id: name, ok: false, errs, warns, emits, format: 'v1' };
  }

  // Required surface
  ['update', 'draw', 'isReady'].forEach((m) => {
    if (!isFn(inst[m])) errs.push(`missing ${m}()`);
  });
  // Nice to have
  ['resetSequence', 'forceComplete', 'checkBoundary', 'onStart', 'onComplete'].forEach((m) => {
    if (!isFn(inst[m])) warns.push(`optional ${m}() missing`);
  });

  // Capture emitted events during a tiny sandbox
  const b = bus();
  const origEmit = b.emit?.bind(b);
  if (origEmit)
    b.emit = (evt, p) => {
      emits.push({ evt, p });
      return origEmit(evt, p);
    };

  try {
    if (isFn(inst.onStart)) inst.onStart();
    if (isFn(inst.resetSequence)) inst.resetSequence(1);
    for (let i = 0; i < 30; i++) inst.update?.(16, 1);
    inst.draw?.(scratch());
    if (isFn(inst.onComplete)) inst.onComplete();
  } catch (e) {
    errs.push('sandbox threw: ' + (e?.message || e));
  } finally {
    if (origEmit) b.emit = origEmit;
  }

  // Policy checks
  const veils = emits.filter((e) => String(e.evt).startsWith('playArea/hide'));
  if (veils.length && !ALLOWED_VEIL_SHAPES.has(name)) {
    warns.push(`emits veil events (${veils.map((v) => v.evt).join(', ')}) but not in allowlist`);
  }
  const huds = emits.filter((e) => String(e.evt).startsWith('hud:'));
  if (huds.length) warns.push(`shape emitted HUD events (${huds.map((v) => v.evt).join(', ')})`);

  return { id: name, ok: errs.length === 0, errs, warns, emits, format: 'v1' };
}

function verifyV2(entry) {
  const errs = [],
    warns = [],
    emits = [];
  const meta = entry?.meta || {};
  const id = meta.id || entry?.name || '(unnamed)';

  if (!meta || !isFn(entry?.factoryRef)) {
    errs.push('missing meta and/or factoryRef');
    return { id, ok: false, errs, warns, emits, format: 'v2' };
  }
  if (!isStr(meta.id)) errs.push('meta.id missing');
  if (!isStr(meta.displayName)) errs.push('meta.displayName missing');
  if (!isStr(meta.color)) warns.push('meta.color missing');
  if (!VALID_BEHAVIORS.has(meta.behaviorType))
    warns.push(`meta.behaviorType unexpected (${meta.behaviorType})`);
  if (!meta.flags || typeof meta.flags.usesEdgeVeils !== 'boolean')
    warns.push('meta.flags.* incomplete');
  if (!meta.timings || !isNum(meta.timings.introMs) || !isNum(meta.timings.glintMs))
    warns.push('meta.timings incomplete');
  if (meta.version !== 2) warns.push('meta.version should be 2');

  let inst;
  try {
    inst = entry.factoryRef(fakeCtx());
  } catch (e) {
    errs.push('create(ctx) threw: ' + (e?.message || e));
    return { id, ok: false, errs, warns, emits, format: 'v2' };
  }

  ['onStart', 'update', 'draw', 'onComplete', 'isReadyToPlay'].forEach((m) => {
    if (!isFn(inst[m])) errs.push(`missing ${m}()`);
  });

  const b = bus();
  const origEmit = b.emit?.bind(b);
  if (origEmit)
    b.emit = (evt, p) => {
      emits.push({ evt, p });
      return origEmit(evt, p);
    };

  try {
    inst.onStart?.();
    for (let i = 0; i < 30; i++) inst.update?.(16);
    inst.draw?.(scratch());
    inst.onComplete?.();
  } catch (e) {
    errs.push('sandbox threw: ' + (e?.message || e));
  } finally {
    if (origEmit) b.emit = origEmit;
  }

  const veils = emits.filter((e) => String(e.evt).startsWith('playArea/hide'));
  if (meta.flags && meta.flags.usesEdgeVeils === false && veils.length) {
    warns.push('meta.flags.usesEdgeVeils=false but emitted veil events');
  }
  const huds = emits.filter((e) => String(e.evt).startsWith('hud:'));
  if (huds.length) warns.push(`shape emitted HUD events (${huds.map((v) => v.evt).join(', ')})`);

  return { id, ok: errs.length === 0, errs, warns, emits, format: 'v2' };
}

export async function runVerifiers() {
  const results = { shapes: [], minigames: [], errors: [], summary: {} };

  // Verify shapes
  const seen = new Set();
  for (const e of reg()) {
    if (!e || e.active === false) continue;
    const key = e?.meta?.id || e?.name;
    if (key && seen.has(key)) results.errors.push('duplicate id/name: ' + key);
    seen.add(key);

    results.shapes.push(e.factoryRef && e.meta ? verifyV2(e) : verifyV1(e));
  }

  // Verify minis (lightweight, legacy-tolerant)
  try {
    const mg = window.miniGameRegistry || [];
    results.minigames = mg.map((m) => {
      const errs = [],
        warns = [];
      const id = m?.name || m?.id || 'unknown';
      const hasStart = isFn(m?.onStart) || isFn(m?.start);
      const hasUpdate = isFn(m?.update);
      const hasComplete = isFn(m?.onComplete) || isFn(m?.complete);
      const hasIsReady = isFn(m?.isReady) || isFn(m?.ready);
      if (!id || id === 'unknown') errs.push('missing name/id');
      if (!hasStart) errs.push('missing onStart(startDuration)');
      if (!hasComplete) errs.push('missing onComplete({win})');
      if (!hasUpdate) warns.push('legacy: missing update(dt)');
      if (!hasIsReady) warns.push('legacy: missing isReady()');
      return { id, ok: errs.length === 0, errs, warns };
    });
  } catch (e) {
    results.errors.push('MiniGames verifier failed: ' + (e?.message || e));
  }

  results.summary = {
    shapesTotal: results.shapes.length,
    shapesOk: results.shapes.filter((s) => s.ok).length,
    minisTotal: results.minigames.length,
    minisOk: results.minigames.filter((m) => m.ok).length,
    errors: results.errors.length,
  };

  try {
    bus().emit('verify:report', results);
  } catch {}
  return results;
}
