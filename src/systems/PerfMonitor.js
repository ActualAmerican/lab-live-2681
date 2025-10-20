// systems/PerfMonitor.js
// Centralized perf buckets, FPS EMA, Long Task observer, and CSV capture.
// Exposes small helpers so main.js only CONSUMES perf.

const PERF = {
  spikeTimes: [], // timestamps (ms) for frames <45 FPS
  buckets: { update: [], playArea: [], fx: [], hud: [] },
  last: { update: 0, playArea: 0, fx: 0, hud: 0 }, // last-measured
  max: 90,
  longTasks: 0,
};

let fpsEMA = 60;
const FPS_ALPHA = 0.12;

// --- Buckets -----------------------------------------------------------------
function perfPush(bucket, ms) {
  const arr = PERF.buckets[bucket];
  if (!arr) return;
  arr.push(ms);
  if (arr.length > PERF.max) arr.shift();
  PERF.last[bucket] = ms;
}
export function perfMeasure(bucket, fn) {
  const s = performance.now();
  const r = fn();
  const e = performance.now();
  perfPush(bucket, e - s);
  return r;
}

// --- FPS & spikes ------------------------------------------------------------
export function tickFps(rawDtMs) {
  const instFps = rawDtMs > 0 ? 1000 / rawDtMs : 0;
  fpsEMA += (instFps - fpsEMA) * FPS_ALPHA;

  // spike registry (keep only last 3s)
  if (instFps && instFps < 45) PERF.spikeTimes.push(performance.now());
  const now = performance.now();
  while (PERF.spikeTimes.length && now - PERF.spikeTimes[0] > 3000) PERF.spikeTimes.shift();

  return { instFps, fpsE: fpsEMA };
}
export function getFPS() {
  return Math.round(fpsEMA);
}

// --- Memory helper -----------------------------------------------------------
export function getMemoryMB() {
  try {
    const m = performance.memory;
    if (!m) return null;
    return Math.round((m.usedJSHeapSize / 1048576) * 10) / 10;
  } catch {
    return null;
  }
}

// --- Snapshot for Debug panel ------------------------------------------------
function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
export function getPerfSnapshot() {
  const buckets = {};
  for (const k of Object.keys(PERF.buckets)) buckets[k] = avg(PERF.buckets[k]);
  return {
    fps: Math.round(fpsEMA),
    spikes3s: PERF.spikeTimes.length,
    longTasks: PERF.longTasks,
    buckets,
    memoryMB: getMemoryMB(),
  };
}

// --- Long Task observer (main-thread stalls >50ms) ---------------------------
(function hookLongTasks() {
  try {
    if ('PerformanceObserver' in window) {
      const types = PerformanceObserver.supportedEntryTypes || [];
      if (types.includes && types.includes('longtask')) {
        const po = new PerformanceObserver((list) => {
          PERF.longTasks += list.getEntries().length;
        });
        po.observe({ entryTypes: ['longtask'] });
      }
    }
  } catch {}
})();

// --- CSV capture -------------------------------------------------------------
const PERFCSV = {
  enabled: false,
  capturing: false,
  ready: false,
  runId: 0,
  startTs: 0,
  endTs: 0,
  frames: [],
  events: [],
  meta: {},
  generatedUrl: null,
};
let __perfFrameIndex = 0;
let __RUN_IN_PROGRESS = false;

export function setPerfCsvEnabled(on) {
  PERFCSV.enabled = !!on;
  PERFCSV.capturing = !!on && __RUN_IN_PROGRESS;
}
export function getPerfCsvStatus() {
  return {
    enabled: PERFCSV.enabled,
    capturing: PERFCSV.capturing,
    ready: PERFCSV.ready,
    frames: PERFCSV.frames.length,
    events: PERFCSV.events.length,
    runId: PERFCSV.runId,
  };
}
export function perfLogEvent(evt, extra = {}) {
  if (!PERFCSV.capturing) return;
  PERFCSV.events.push({ ts: Date.now(), evt, ...extra });
}
export function onRunStart({ canvasW = 0, canvasH = 0, dpr = 1, speed = 1 } = {}) {
  __RUN_IN_PROGRESS = true;
  PERFCSV.capturing = PERFCSV.enabled;
  PERFCSV.ready = false;
  PERFCSV.runId = Date.now();
  PERFCSV.startTs = PERFCSV.runId;
  PERFCSV.endTs = 0;
  PERFCSV.frames.length = 0;
  PERFCSV.events.length = 0;
  __perfFrameIndex = 0;
  PERFCSV.meta = { canvasW, canvasH, dpr, speed };
}
export function onRunEnd() {
  __RUN_IN_PROGRESS = false;
  PERFCSV.endTs = Date.now();
  PERFCSV.ready = true;
  PERFCSV.capturing = false;
}

export function recordPerfFrame({ rawDt, dt, instFps, level, cycle, score }) {
  if (!PERFCSV.capturing) return;
  PERFCSV.frames.push({
    t: performance.now(),
    i: (__perfFrameIndex = (__perfFrameIndex || 0) + 1) - 1,
    rawDt,
    dt,
    fps: instFps,
    fpsE: fpsEMA,
    upd: PERF.last.update || 0,
    play: PERF.last.playArea || 0,
    fx: PERF.last.fx || 0,
    hud: PERF.last.hud || 0,
    spikes3s: PERF.spikeTimes.length,
    longTasks: PERF.longTasks,
    memMB: getMemoryMB(),
    level,
    cycle,
    score,
  });
}

// --- CSV build + summary (ported) -------------------------------------------
function percentile(arr, p) {
  if (!arr || !arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const idx = Math.max(0, Math.min(a.length - 1, Math.floor((p / 100) * (a.length - 1))));
  return a[idx];
}
function mean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function round(n, d = 2) {
  const k = Math.pow(10, d);
  return Math.round(n * k) / k;
}

export function buildPerfSummary() {
  if (!PERFCSV || !PERFCSV.ready) return null;
  const frames = PERFCSV.frames || [];
  const events = PERFCSV.events || [];
  const m = PERFCSV.meta || {};
  const durMs = Math.max(0, (PERFCSV.endTs || 0) - (PERFCSV.startTs || 0));

  const rawDt = frames.map((f) => +f.rawDt || 0);
  const fps = frames.map((f) => +f.fps || 0);
  const upd = frames.map((f) => +f.upd || 0);
  const play = frames.map((f) => +f.play || 0);
  const fx = frames.map((f) => +f.fx || 0);
  const hud = frames.map((f) => +f.hud || 0);
  const mem = frames
    .map((f) => (typeof f.memMB === 'number' ? f.memMB : NaN))
    .filter(Number.isFinite);

  const worst = frames
    .slice()
    .sort((a, b) => (b.rawDt || 0) - (a.rawDt || 0))
    .slice(0, 10)
    .map((f) => ({
      frame: f.i,
      dt_ms: round(f.rawDt, 3),
      fps: round(f.fps, 2),
      upd: round(f.upd, 3),
      play: round(f.play, 3),
      fx: round(f.fx, 3),
      hud: round(f.hud, 3),
      ts_iso: new Date(f.t).toISOString(),
    }));

  const evtCounts = {};
  for (const e of events) evtCounts[e.evt] = (evtCounts[e.evt] || 0) + 1;

  return {
    run: {
      runId: PERFCSV.runId,
      duration_s: round(durMs / 1000, 2),
      frames: frames.length,
      events: events.length,
      canvas: { w: m.canvasW || 0, h: m.canvasH || 0, dpr: m.dpr || 1 },
      speed: m.speed || 1,
    },
    frame_time_ms: {
      avg: round(mean(rawDt)),
      p50: round(percentile(rawDt, 50)),
      p95: round(percentile(rawDt, 95)),
      p99: round(percentile(rawDt, 99)),
    },
    fps: {
      avg: round(mean(fps), 2),
      p50: round(percentile(fps, 50), 2),
      p05: round(percentile(fps, 5), 2),
    },
    buckets_ms_avg: {
      update: round(mean(upd), 2),
      playArea: round(mean(play), 2),
      fx: round(mean(fx), 2),
      hud: round(mean(hud), 2),
    },
    buckets_ms_p95: {
      update: round(percentile(upd, 95), 2),
      playArea: round(percentile(play, 95), 2),
      fx: round(percentile(fx, 95), 2),
      hud: round(percentile(hud, 95), 2),
    },
    memory_mb: mem.length
      ? { min: round(Math.min(...mem), 1), max: round(Math.max(...mem), 1) }
      : null,
    spikes_last3s_at_end: PERF.spikeTimes ? PERF.spikeTimes.length : 0,
    longTasks_total: PERF.longTasks || 0,
    events_by_type: evtCounts,
    worst_frames: worst,
  };
}

export function buildPerfCSV() {
  if (!PERFCSV.ready) return null;
  try {
    if (PERFCSV.generatedUrl) URL.revokeObjectURL(PERFCSV.generatedUrl);
  } catch {}

  const rid = PERFCSV.runId;
  const rows = [];
  const iso = (ts) => new Date(ts).toISOString();
  const m = PERFCSV.meta || {};
  rows.push(
    [
      'type',
      'ts_iso',
      'run_id',
      'level',
      'cycle',
      'shape',
      'behavior',
      'event',
      'frame',
      'dt_raw_ms',
      'dt_scaled_ms',
      'fps',
      'fps_ema',
      'upd_ms',
      'play_ms',
      'fx_ms',
      'hud_ms',
      'spikes3s',
      'longTasks',
      'mem_mb',
      'canvas_w',
      'canvas_h',
      'dpr',
      'speed',
      'score',
    ].join(',')
  );

  rows.push(
    [
      'meta',
      iso(PERFCSV.startTs),
      rid,
      '',
      '',
      '',
      '',
      'run_start',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      m.canvasW || '',
      m.canvasH || '',
      m.dpr || '',
      m.speed || '',
      '',
    ].join(',')
  );

  for (const f of PERFCSV.frames) {
    rows.push(
      [
        'frame',
        iso(f.t),
        rid,
        f.level ?? '',
        f.cycle ?? '',
        '',
        '',
        '',
        f.i,
        (f.rawDt ?? 0).toFixed(3),
        (f.dt ?? 0).toFixed(3),
        (f.fps ?? 0).toFixed(2),
        (f.fpsE ?? 0).toFixed(2),
        (f.upd ?? 0).toFixed(3),
        (f.play ?? 0).toFixed(3),
        (f.fx ?? 0).toFixed(3),
        (f.hud ?? 0).toFixed(3),
        f.spikes3s ?? '',
        f.longTasks ?? '',
        f.memMB ?? '',
        m.canvasW || '',
        m.canvasH || '',
        m.dpr || '',
        m.speed || '',
        f.score ?? '',
      ].join(',')
    );
  }

  for (const e of PERFCSV.events) {
    rows.push(
      [
        'event',
        iso(e.ts),
        rid,
        e.level ?? '',
        e.cycle ?? '',
        e.shape ?? '',
        e.behavior ?? '',
        e.evt,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        m.canvasW || '',
        m.canvasH || '',
        m.dpr || '',
        m.speed || '',
        '',
      ].join(',')
    );
  }

  rows.push(
    [
      'meta',
      iso(PERFCSV.endTs),
      rid,
      '',
      '',
      '',
      '',
      'run_end',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      m.canvasW || '',
      m.canvasH || '',
      m.dpr || '',
      m.speed || '',
      '',
    ].join(',')
  );

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  PERFCSV.generatedUrl = url;
  return { url, bytes: blob.size, rows: rows.length, fileName: `perf_run_${rid}.csv` };
}
