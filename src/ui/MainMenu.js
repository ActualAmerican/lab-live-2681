// ui/MainMenu.js
export default class MainMenu {
  constructor({ onPlay, onShop, onProfile, onSettings, onVault, onJukebox } = {}) {
    this.onPlay = onPlay || (() => {});
    this.onShop = onShop || (() => {});
    this.onProfile = onProfile || (() => {});
    this.onSettings = onSettings || (() => {});
    this.onVault = onVault || (() => {});
    this.onJukebox = onJukebox || (() => {});
    this._root = null;
  }
  mount(root) {
    const el = document.createElement('div');
    el.className = 'screen screen--main';
    el.innerHTML = `
      <div class="menu-grid">
        <button class="menu-card menu-card--primary" data-action="play">Play</button>
        <button class="menu-card" data-action="shop">Shop</button>
        <button class="menu-card" data-action="vault">Vault</button>
        <button class="menu-card" data-action="profile">Profile</button>
        <button class="menu-card" data-action="settings">Settings</button>
        <button class="menu-card menu-card--primary menu-card--wide" data-action="jukebox">Jukebox</button>
      </div>
      <div class="menu-footer">
        <span>Play on the go — iOS & Android</span>
        <span class="qr-stub">[QR Coming Soon]</span>
      </div>
    `;
    this._root = el;
    root.appendChild(el);
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const a = btn.getAttribute('data-action');
      switch (a) {
        case 'play':
          this.onPlay();
          break;
        case 'shop':
          this.onShop();
          break;
        case 'vault':
          this.onVault();
          break;
        case 'profile':
          this.onProfile();
          break;
        case 'settings':
          this.onSettings();
          break;
        case 'jukebox':
          this.onJukebox();
          break;
      }
    });
  }
  unmount() {
    if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root);
    this._root = null;
  }
}
