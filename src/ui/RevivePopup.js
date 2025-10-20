// src/ui/RevivePopup.js
import * as Bank from '../libs/Bank.js';
import AdService from '../libs/AdService.js';

const SCORE_FMT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function el(tag, css = '') {
  const n = document.createElement(tag);
  if (css) n.style.cssText = css;
  return n;
}

function btnPrimary(label) {
  const b = el(
    'button',
    `
    width:100%; padding:12px 14px; font-size:16px; font-weight:600;
    border-radius:14px; border:1px solid rgba(255,255,255,.18);
    background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.06));
    color:#fff; box-shadow: 0 6px 24px rgba(0,0,0,.45), 0 0 24px rgba(120,160,255,.18);
    backdrop-filter: blur(6px); transition: transform .08s ease, opacity .2s ease;
  `
  );
  b.textContent = label;
  b.onmouseenter = () => (b.style.transform = 'translateY(-1px)');
  b.onmouseleave = () => (b.style.transform = 'translateY(0)');
  return b;
}

function btnSmall(label) {
  const b = el(
    'button',
    `
    padding:8px 10px; font-size:14px; border-radius:12px; color:#fff;
    background: rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18);
  `
  );
  b.textContent = label;
  return b;
}

/**
 * Shows the polished Game Over / Revive popup.
 * Delegates revive completion via `onRevive(method)`, where method ∈ {'ad','copper'}.
 *
 * @param {{
 *   score: number,
 *   runRevives: number,   // 0,1,2
 *   onRevive: (method:'ad'|'copper') => void,
 *   onRestart: () => void
 * }} opts
 */
function show(opts) {
  const { score = 0, runRevives = 0, onRevive, onRestart } = opts || {};

  const wrap = el(
    'div',
    `
    position: absolute; inset: 0; z-index: 12; display:flex; align-items:center; justify-content:center;
    pointer-events:auto;
  `
  );

  const card = el(
    'div',
    `
    width:min(420px, calc(100vw - 24px));
    color:#fff; text-align:center; padding:22px 18px; border-radius:20px;
    border:1px solid rgba(255,255,255,.18);
    background: radial-gradient(120% 120% at 50% -10%, rgba(70,90,140,.25), rgba(20,22,30,.90));
    box-shadow: 0 10px 40px rgba(0,0,0,.55), 0 0 40px rgba(80,120,255,.15);
    backdrop-filter: blur(8px);
    transform: translateY(6px); opacity:.0; transition: transform .18s ease, opacity .18s ease;
  `
  );
  wrap.appendChild(card);
  requestAnimationFrame(() => {
    card.style.transform = 'translateY(0)';
    card.style.opacity = '1';
  });

  const title = el('div', 'font-weight:700; font-size:20px; margin:0 0 6px;');
  title.textContent = 'Game Over';
  card.appendChild(title);

  const scoreP = el('div', 'font-size:20px; margin:0 0 8px;');
  scoreP.textContent = `Score: ${SCORE_FMT.format(score)}`;
  card.appendChild(scoreP);

  if (runRevives < 2) {
    const hint = el('div', 'color:#bfc7ff; opacity:.8; font-size:12px; margin:0 0 12px;');
    hint.textContent = 'Reviving applies a −5% score penalty.';
    card.appendChild(hint);
  }

  const col = el('div', 'display:flex; flex-direction:column; gap:10px;');
  card.appendChild(col);

  // ── Primary CTA (revive path) ──────────────────────────────────────────────
  if (runRevives === 0) {
    const cta = btnPrimary('Watch Ad to Continue (+500 copper)');
    cta.addEventListener('click', async () => {
      cta.disabled = true;
      const res = await AdService.showRewarded();
      if (res?.ok && res?.reward) {
        try {
          window.bus?.emit('ad:rewarded:success');
        } catch {}
        try {
          Bank.deposit({ copper: 500 });
        } catch {}
        cleanup();
        onRevive && onRevive('ad');
      } else {
        cta.disabled = false;
        alert('Ad not available right now.');
      }
    });
    col.appendChild(cta);
  } else if (runRevives === 1) {
    const afford = Bank.canAfford({ copper: 1000 });
    const cta = btnPrimary(
      afford ? 'Continue (1,000 copper)' : 'Continue (1,000 copper) — Not enough'
    );
    cta.disabled = !afford;
    cta.addEventListener('click', () => {
      if (!Bank.spend({ copper: 1000 })) return;
      cleanup();
      onRevive && onRevive('copper');
    });
    col.appendChild(cta);
  }

  // ── Secondary row: Restart / Share / Main Menu ─────────────────────────────
  const row = el(
    'div',
    'display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:2px;'
  );
  const restart = btnSmall('Restart Game');
  const share = btnSmall('Share Score'); // B.7 stub for now
  const menu = btnSmall('Main Menu');

  restart.addEventListener('click', () => {
    cleanup();
    onRestart && onRestart();
  });

  share.addEventListener('click', () => {
    const txt = `My score in ShapeShifters: ${SCORE_FMT.format(score)}`;
    navigator.clipboard.writeText(txt).then(
      () => alert('Score copied to clipboard!'),
      () => alert('Failed to copy score to clipboard')
    );
  });

  menu.addEventListener('click', async () => {
    await AdService.showInterstitial().catch(() => {});
    try {
      window.__router?.navigate('MAIN');
    } catch {
      location.hash = '#/main';
    }
    try {
      window.bus?.emit('game:over');
    } catch {}
    cleanup();
  });

  row.appendChild(restart);
  row.appendChild(share);
  row.appendChild(menu);
  col.appendChild(row);

  document.body.appendChild(wrap);

  function cleanup() {
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
  }

  return { destroy: cleanup };
}

export default { show };
