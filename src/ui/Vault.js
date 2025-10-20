// src/ui/Vault.js
import ProfileStore from '../libs/ProfileStore.js';
import { renderIconsBulk, renderShapeIcon } from '../shapes/ShapeIcon.js';
import { shapeRegistry } from '../shapes/shapes.js';

export default class Vault {
  constructor({ onBack } = {}) {
    this.onBack = onBack || (() => {});
    this._el = null;
  }

  mount(root) {
    this._el = document.createElement('div');
    this._el.className = 'screen screen--panel';
    this._el.dataset.screen = 'main'; // keep menu background
    this._el.innerHTML = `
  <div class="panel vault-panel">
    <div class="panel-header">
      <button class="back-btn" data-action="back">← Back</button>
      <h2>Vault</h2>
      <div class="small">Favorites: <span id="favCount">0</span>/5</div>
    </div>
    <div class="panel-body">
      <section class="grid vault-grid" id="vaultGrid"></section>
    </div>
  </div>
`;
    root.appendChild(this._el);

    // events
    this._el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      if (a.dataset.action === 'back') this.onBack();
    });

    this.renderGrid();
    this._onResize = () => this.renderGrid();
    window.addEventListener('resize', this._onResize);
    return this;
  }

  destroy() {
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }

  _getShapes() {
    const profile = ProfileStore.get() || {};
    const owned = new Set((profile.unlocks && profile.unlocks.shapes) || []);
    const favs = new Set(profile.favoriteShapes || []);

    // Auto-populate from registry; Shapeless is secret until owned
    const secretOwned = owned.has('Shapeless');
    return (shapeRegistry || [])
      .filter((s) => s && s.name && (s.name !== 'Shapeless' || secretOwned))
      .map((s) => ({
        id: s.name,
        name: s.name,
        color: s.color || '#888',
        unlocked: owned.has(s.name),
        favorite: favs.has(s.name),
      }));
  }

  renderGrid() {
    const grid = this._el.querySelector('#vaultGrid');
    let list = this._getShapes();

    // Group unlocked first, then locked; each group A–Z
    list.sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    grid.innerHTML = list
      .map(
        (s) => `
      <button class="vault-tile ${s.unlocked ? '' : 'is-locked'} ${
          s.favorite ? 'is-fav' : ''
        }" data-id="${s.id}">
        <canvas class="tile-icon shape-canvas" data-shape="${s.name}"></canvas>
        <div class="tile-name">${s.unlocked ? s.name : '???'}</div>
      </button>`
      )
      .join('');

    // draw all icons in one go
    const icons = grid.querySelectorAll('.tile-icon.shape-canvas[data-shape]');
    renderIconsBulk(icons);

    // header counter
    const favs = ProfileStore.get()?.favoriteShapes || [];
    this._el.querySelector('#favCount').textContent = String(favs.length);

    // open detail (simple modal for now)
    grid.onclick = (e) => {
      const btn = e.target.closest('.vault-tile');
      if (!btn) return;
      this.openDetail(btn.dataset.id);
    };
  }

  openDetail(id) {
    const s = this._getShapes().find((x) => x.id === id);
    if (!s) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title">${s.unlocked ? s.name : 'Locked'}</div>
          <button class="btn icon" data-action="close">✕</button>
        </div>
        <div class="modal-body">
          <div class="shape-preview" style="--tile-color:${s.color}"></div>
          <div class="kv">
            <div><span class="k">Status</span><span class="v">${
              s.unlocked ? 'Unlocked' : 'Locked'
            }</span></div>
            <div><span class="k">Favorite</span><span class="v">${
              s.favorite ? 'Yes' : 'No'
            }</span></div>
          </div>
        </div>
        <div class="modal-actions">
          ${
            s.unlocked
              ? `<button class="btn" data-action="favorite">${
                  s.favorite ? 'Unfavorite' : 'Set Favorite'
                }</button>`
              : ''
          }
          <button class="btn" data-action="close">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    // Large preview icon (exact)
    const holder = modal.querySelector('.shape-preview');
    const big = document.createElement('canvas');
    big.className = 'shape-icon shape-canvas';
    // let CSS control size (holder is 96×96); renderer will use CSS×DPR
    big.style.width = '96px';
    big.style.height = '96px';
    // keep the shape name for debugging / consistency
    big.setAttribute('data-shape', s.name);
    holder.appendChild(big);

    // render using the new API (uses registry + neutral state)
    renderShapeIcon(big, s.name);

    const close = () => modal.remove();
    modal.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      if (a.dataset.action === 'close') close();
      if (a.dataset.action === 'favorite') {
        ProfileStore.toggleFavoriteShape(id);
        close();
        this.renderGrid();
      }
    });
  }
}
