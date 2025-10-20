// ui/Jukebox.js
export default class Jukebox {
  constructor({ onBack } = {}) {
    this._root = null;
    this.onBack = onBack || (() => {});
    this._tab = 'tracks'; // 'tracks' | 'studio'
  }

  mount(root) {
    const el = document.createElement('div');
    el.className = 'screen screen--jukebox';
    el.innerHTML = `
      <div class="section-shell">
        <div class="section-panel">
          <div class="section-panel__header">
            <div class="section-title">Jukebox</div>
            <div class="jukebox-tabs" role="tablist">
              <button class="tab ${
                this._tab === 'tracks' ? 'is-active' : ''
              }" data-tab="tracks">Tracks</button>
              <button class="tab ${
                this._tab === 'studio' ? 'is-active' : ''
              }" data-tab="studio">Studio</button>
            </div>
          </div>
          <div class="section-panel__body jukebox-body">
            ${this._tab === 'tracks' ? this._tracksHTML() : this._studioHTML()}
          </div>
        </div>
      </div>
    `;
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      this._tab = btn.getAttribute('data-tab');
      this.unmount();
      this.mount(root);
    });
    this._root = el;
    root.appendChild(el);
  }

  _tracksHTML() {
    return `
      <div class="jukebox-placeholder">
        <p>Tracks library will appear here (sort, filter, preview, purchase/unlock hooks).</p>
      </div>
    `;
  }

  _studioHTML() {
    return `
      <div class="jukebox-placeholder">
        <p>Studio (Mario Paint–style composer) placeholder.</p>
      </div>
    `;
  }

  unmount() {
    if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
    this._root = null;
  }
}
