// ui/TitleScreen.js
// Simple "Press Any Button" title with optional logo text.
// inside the "press any" handler

export default class TitleScreen {
  constructor({ onContinue } = {}) {
    this.onContinue = onContinue || (() => {});
    this._el = null;
    this._handlers = [];
  }
  mount(root) {
    const wrap = document.createElement('div');
    wrap.className = 'screen screen--title';
    wrap.innerHTML = `
      <div class="title-wrap">
        <div class="title-logo">
          <span class="title-halo" aria-hidden="true"></span>
          <span class="title-text">SHAPE SHIFTERS</span>
          <span class="title-glint" aria-hidden="true"></span>
        </div>
        <div class="press-any">Press Any Button</div>
      </div>
    `;
    root.appendChild(wrap);
    this._el = wrap;

    const go = (e) => {
      e && e.preventDefault && e.preventDefault();
      this.onContinue();
    };
    const add = (t, fn, opts) => {
      window.addEventListener(t, fn, opts);
      this._handlers.push([t, fn, opts]);
    };
    add('keydown', go, { once: true });
    add('mousedown', go, { once: true });
    add('touchstart', go, { once: true, passive: true });
  }
  unmount() {
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
    // remove any leftover handlers (in case we navigated without input)
    for (const [t, fn, opts] of this._handlers) {
      try {
        window.removeEventListener(t, fn, opts);
      } catch {}
    }
    this._handlers = [];
  }
}
