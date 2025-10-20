// src/core/GameLoop.js
// Minimal RAF scheduler. Owns time delta & paused state, delegates work to a tick(dt, now) callback.

const GameLoop = (() => {
  let _tick = null; // function(dt, now)
  let _onFrameEnd = null; // optional function({ dt, now, fps })
  let _raf = 0;
  let _running = false;
  let _lastNow = 0;
  let _fpsNow = 0;
  let _fpsFrames = 0;
  let _fps = 0;

  function init({ tick, onFrameEnd } = {}) {
    _tick = typeof tick === 'function' ? tick : null;
    _onFrameEnd = typeof onFrameEnd === 'function' ? onFrameEnd : null;
  }

  function _step(now) {
    if (!_running) return;
    // dt in seconds
    const dt = _lastNow ? Math.max(0, (now - _lastNow) / 1000) : 0;
    _lastNow = now;

    // basic fps (1s window)
    _fpsFrames++;
    if (!_fpsNow) _fpsNow = now;
    if (now - _fpsNow >= 1000) {
      _fps = _fpsFrames;
      _fpsFrames = 0;
      _fpsNow = now;
    }

    try {
      if (_tick) _tick(dt, now);
    } finally {
      _onFrameEnd && _onFrameEnd({ dt, now, fps: _fps });
      _raf = requestAnimationFrame(_step);
    }
  }

  function start() {
    if (_running) return;
    _running = true;
    _lastNow = 0;
    _fpsNow = 0;
    _fpsFrames = 0;
    _raf = requestAnimationFrame(_step);
  }

  function stop() {
    _running = false;
    if (_raf) cancelAnimationFrame(_raf);
    _raf = 0;
  }

  function isRunning() {
    return _running;
  }

  function getFPS() {
    return _fps | 0;
  }

  return { init, start, stop, isRunning, getFPS };
})();

export default GameLoop;
