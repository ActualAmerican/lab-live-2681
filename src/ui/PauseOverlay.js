// ui/PauseOverlay.js
export function showPauseOverlay({ onResume, onMenu } = {}) {
  if (document.getElementById('pauseOverlay')) return;
  const div = document.createElement('div');
  div.id = 'pauseOverlay';
  div.style.cssText = `
    position:fixed; inset:0; z-index:21; display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,0.45);`;
  div.innerHTML = `
    <div style="background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.2); border-radius:14px; padding:16px 18px; width: 280px; text-align:center; color:#fff; font-family: Orbitron, sans-serif;">
      <div style="font-weight:800; font-size:18px; margin-bottom:12px;">Paused</div>
      <div style="display:flex; gap:10px; justify-content:center;">
        <button id="btnResume" style="padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.06); color:#fff; cursor:pointer;">Resume</button>
        <button id="btnMenu" style="padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.06); color:#fff; cursor:pointer;">Main Menu</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  div.querySelector('#btnResume')?.addEventListener('click', () => onResume?.());
  div.querySelector('#btnMenu')?.addEventListener('click', () => onMenu?.());
}

export function hidePauseOverlay() {
  const el = document.getElementById('pauseOverlay');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

export default { showPauseOverlay, hidePauseOverlay };
