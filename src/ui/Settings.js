// ui/Settings.js
import ProfileStore from '../libs/ProfileStore.js';

export default class SettingsScreen {
  constructor({ onBack } = {}) {
    this.onBack = onBack || (() => {});
    this._el = null;
    this._unbind = null;
  }

  mount(root) {
    const el = document.createElement('div');
    el.className = 'screen screen--panel';
    el.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2>Settings</h2>
          <button class="back-btn" data-action="back">Back</button>
        </div>
        <div class="panel-body">
          <div class="setting">
            <label>Volume</label>
            <input id="stVolume" type="range" min="0" max="1" step="0.01">
            <span id="stVolumeVal" class="muted"></span>
          </div>
          <div class="setting"><label><input id="stColorblind" type="checkbox"> Colorblind Mode</label></div>
          <div class="setting"><label><input id="stReduced" type="checkbox"> Reduced Motion</label></div>
          <div class="setting"><label><input id="stHaptics" type="checkbox"> Haptics</label></div>
          <div class="setting"><label><input id="stWow" type="checkbox"> Wow Mode</label></div>
          <div class="setting"><label><input id="stBanner" type="checkbox"> Show Install Banner</label></div>
          <div class="setting"><label><input id="stQR" type="checkbox"> Show QR / Deep Link</label></div>
        </div>
      </div>`;
    root.appendChild(el);
    this._el = el;

    el.querySelector('[data-action="back"]').addEventListener('click', () => this.onBack());

    const sync = () => {
      const s = ProfileStore.get().settings || {};
      el.querySelector('#stVolume').value = s.volume ?? 1;
      el.querySelector('#stVolumeVal').textContent = `${Math.round((s.volume ?? 1) * 100)}%`;
      el.querySelector('#stColorblind').checked = !!s.colorblind;
      el.querySelector('#stReduced').checked = !!s.reducedMotion;
      el.querySelector('#stHaptics').checked = !!s.haptics;
      el.querySelector('#stWow').checked = !!s.wowMode;
      el.querySelector('#stBanner').checked = !!s.showInstallBanner;
      el.querySelector('#stQR').checked = !!s.showQR;
    };

    // write-backs
    el.querySelector('#stVolume').addEventListener('input', (e) => {
      ProfileStore.setSetting('volume', Number(e.target.value));
      el.querySelector('#stVolumeVal').textContent = `${Math.round(Number(e.target.value) * 100)}%`;
    });
    el.querySelector('#stColorblind').addEventListener('change', (e) =>
      ProfileStore.setSetting('colorblind', !!e.target.checked)
    );
    el.querySelector('#stReduced').addEventListener('change', (e) =>
      ProfileStore.setSetting('reducedMotion', !!e.target.checked)
    );
    el.querySelector('#stHaptics').addEventListener('change', (e) =>
      ProfileStore.setSetting('haptics', !!e.target.checked)
    );
    el.querySelector('#stWow').addEventListener('change', (e) =>
      ProfileStore.setSetting('wowMode', !!e.target.checked)
    );
    el.querySelector('#stBanner').addEventListener('change', (e) =>
      ProfileStore.setSetting('showInstallBanner', !!e.target.checked)
    );
    el.querySelector('#stQR').addEventListener('change', (e) =>
      ProfileStore.setSetting('showQR', !!e.target.checked)
    );

    sync();
    const onUpd = () => sync();
    window.addEventListener('profile:updated', onUpd);
    this._unbind = () => window.removeEventListener('profile:updated', onUpd);
  }

  unmount() {
    if (this._unbind) this._unbind();
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
  }
}
