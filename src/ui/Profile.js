// ui/Profile.js
import ProfileStore from '../libs/ProfileStore.js';
import RankSystem from '../libs/RankSystem.js';
import { shapeRegistry, getRandomShapeColor } from '../shapes/shapes.js';
import * as Bank from '../libs/Bank.js';

// Simple string hash for phase offsets
String.prototype.hashCode = function () {
  let h = 0;
  for (let i = 0; i < this.length; i++) {
    h = (h << 5) - h + this.charCodeAt(i);
    h |= 0;
  }
  return h;
};

export default class ProfileScreen {
  constructor({ onBack } = {}) {
    this.onBack = onBack || (() => {});
    this._el = null;
    this._unbind = null;
  }

  mount(root) {
    const el = document.createElement('div');
    el.className = 'screen screen--panel';
    el.innerHTML = `
      <div class="panel profile-panel">
        <div class="panel-header">
          <div class="id-wrap">
            <div class="avatar" id="pfAvatar">P</div>
            <div class="id-lines">
            <h2 id="pfName">Journey</h2>
            <div class="sub muted" id="pfSince"></div>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn" data-action="rename">Rename</button>
            <button class="back-btn" data-action="back">Back</button>
          </div>
        </div>

        <div class="panel-body profile-body">
         <div class="profile__badges">
  <div class="profile__badges-title">
    <button class="btn" id="pfBadgesOpen" type="button">Badges</button>
  </div>
  <div class="pf-badges-row" id="pfBadges"></div>
</div>

          <section class="row currency-strip">
  <div class="pill">
    <img class="currency-img" src="./assets/currencies/copper.PNG" alt="Copper"/>
    <span id="pfCopper">0</span>
  </div>
  <div class="pill">
    <img class="currency-img" src="./assets/currencies/iridium.PNG" alt="Iridium"/>
    <span id="pfIridium">0</span>
  </div>
  <div class="pill">
  <span class="currency-img currency-xp" aria-label="XP"></span>
  <span id="pfXp">0</span>
</div>

  <!-- Shapes unlocked -->
  <div class="pill">
    <img class="currency-img" src="./assets/currencies/shapes.PNG" alt="Shapes"/>
    <span id="pfShapesUnlocked">0/0</span>
  </div>

  <!-- Favorites short list -->
  <div class="pill"><span class="icon star"></span><span id="pfFavShapes">Favorites: —</span></div>
</section>


          <section class="row level-row">
  <div class="rank-row">
    <div class="rank-emblem"><span id="pfRankBadge">S</span></div>
    <div class="rank-meta">
      <div class="level-title" id="pfRankName">Spark I</div>
      <div class="level-sub muted">
        <span id="pfToNext">0</span> XP to next •
        <span id="pfRankIndex">1</span>/<span id="pfRankMax">35</span>
      </div>
    </div>
  </div>
  <div class="level-bar"><div class="bar" id="pfLevelBar" style="width:0%"></div></div>
</section>


          <section class="row chips-row">
  <div class="chip"><div class="k">Runs</div><div class="v" id="pfRunsStarted">0</div></div>
  <div class="chip"><div class="k">Shapes</div><div class="v" id="pfShapesCompleted">0</div></div>
  <div class="chip"><div class="k">Mini-games</div><div class="v" id="pfMiniGames">0</div></div>
  <div class="chip"><div class="k">Play Time</div><div class="v" id="pfPlayTime">0s</div></div>
</section>
          <section class="row">
  <div class="card">
    <div class="card-title">Best Run</div>
    <div id="pfBestRun" class="muted">No runs yet.</div>
  </div>
  <div class="card">
    <div class="card-title">Trends</div>
    <div id="pfTrends" class="muted">Not enough data yet.</div>
  </div>
</section>

          <section class="row">
          <div class="card">
          <div class="card-title">Recent Runs</div>
<div id="pfRunSparkline" style="height:48px;margin:6px 0 8px 0;"></div>
<div id="pfRecent" class="recent-list"></div>
        </div>
      </section>`;
    this.$pfBadges = el.querySelector('#pfBadges');

    const openBtn = el.querySelector('#pfBadgesOpen');
    if (openBtn) openBtn.addEventListener('click', () => this._openBadgesModal());

    // initial render
    this._renderBadgesGrid();

    // keep badges live as profile changes
    this._onProfileUpdate = () => {
      this._renderBadgesGrid();
      this._applyBadgeOffsets();
    };
    window.addEventListener('profile:updated', this._onProfileUpdate);

    root.appendChild(el);
    this._el = el;
    // ensure offsets are correct now that we're in the DOM
    this._applyBadgeOffsets();
    // keep the continuous gradient correct on layout changes
    this._onResize = () => this._applyBadgeOffsets();
    window.addEventListener('resize', this._onResize);

    // wire actions
    el.querySelector('[data-action="back"]').addEventListener('click', () => this.onBack());
    el.querySelector('[data-action="rename"]').addEventListener('click', () => {
      const cur = ProfileStore.get().playerName || 'Player';
      const name = prompt('Enter player name:', cur);
      if (name !== null) ProfileStore.setPlayerName(name.trim());
    });

    const onUpd = () => this._render(ProfileStore.get());
    window.addEventListener('profile:initialized', onUpd);
    window.addEventListener('profile:updated', onUpd);
    window.addEventListener('profile:reset', onUpd);
    this._unbind = () => {
      window.removeEventListener('profile:initialized', onUpd);
      window.removeEventListener('profile:updated', onUpd);
      window.removeEventListener('profile:reset', onUpd);
    };

    this._render(ProfileStore.get());
    // keep currency pills in sync with the bank
    this._onBank = () => {
      const { copper, iridium, xp } = Bank.get();
      const fmt = (n) => (Number(n) || 0).toLocaleString();
      const root = this._el;
      if (!root) return;
      const $ = (sel) => root.querySelector(sel);
      $('#pfCopper').textContent = fmt(copper);
      $('#pfIridium').textContent = fmt(iridium);
      $('#pfXp').textContent = fmt(xp);
    };
    window.addEventListener('bank:changed', this._onBank);
    this._randomizeXpColor();
  }

  _renderBadgesGrid() {
    const p = ProfileStore.get() || {};
    const earned = Array.isArray(p.mastery?.badges) ? p.mastery.badges : [];
    const host = this.$pfBadges;
    if (!host) return;

    const max = Math.min(12, earned.length) || 0;
    host.innerHTML = max
      ? earned
          .slice(0, max)
          .map((b) => {
            const title = [b.name || 'Badge', b.desc ? `— ${b.desc}` : ''].join(' ');
            return `
    <div class="pf-badge-wrap" title="${title.replace(/"/g, '&quot;')}">
    <span class="pf-mask-white"
          style="-webkit-mask-image:url(${b.icon});mask-image:url(${b.icon});"></span>
    <span class="pf-rgb-mask"
          style="-webkit-mask-image:url(${b.icon});mask-image:url(${b.icon});"></span>
    <span class="pf-foil-mask"
          style="-webkit-mask-image:url(${b.icon});mask-image:url(${b.icon});"></span>
  </div>`;
          })
          .join('')
      : '';
    // defer to next paint so layout is final
    requestAnimationFrame(() => this._applyBadgeOffsets());
  }

  _applyBadgeOffsets() {
    const host = this.$pfBadges;
    if (!host) return;
    const tiles = host.querySelectorAll('.pf-badge-wrap');
    if (!tiles.length) return;

    const baseLeft = tiles[0].getBoundingClientRect().left;
    tiles.forEach((tile) => {
      const left = tile.getBoundingClientRect().left - baseLeft;
      tile.style.setProperty('--rgb-offset', `${left}px`);
    });
  }

  _randomizeXpColor() {
    // Pick a color and set it globally so every screen (including Shop)
    // can use the same --xp-accent.
    const col = getRandomShapeColor();
    document.body.style.setProperty('--xp-accent', col);
  }

  _openBadgesModal() {
    if (this._badgesModal) return;

    const catalog = window.__mastery?.getCatalog?.() || [];
    const p = ProfileStore.get() || {};
    const earned = Array.isArray(p.mastery?.badges) ? p.mastery.badges : [];
    const byId = Object.fromEntries(earned.map((b) => [b.id, b]));

    // Order: unlocked (newest date first), then locked (alpha)
    const unlocked = catalog
      .filter((c) => byId[c.id])
      .sort((a, b) => (byId[b.id].unlockedAt | 0) - (byId[a.id].unlockedAt | 0));
    const locked = catalog
      .filter((c) => !byId[c.id])
      .sort((a, b) => (a.title || a.name || a.id).localeCompare(b.title || b.name || b.id));

    const reqText = (u) => {
      if (!u) return '—';
      if (u.type === 'runs') return `${u.count || 1} run${(u.count || 1) > 1 ? 's' : ''}`;
      if (u.type === 'shapes')
        return `${u.count || 1} shape${(u.count || 1) > 1 ? 's' : ''} completed`;
      if (u.type || typeof u === 'object') return 'See description';
      return '—';
    };

    const row = (c, isUnlocked) => {
      const base = c.icon || c.id;
      const file = base.endsWith('.png') ? base : `${base}.png`;
      const icon = `./assets/badges/${file}`;
      const b = byId[c.id];
      const date = isUnlocked && b?.unlockedAt ? new Date(b.unlockedAt).toLocaleDateString() : '';
      const name = c.title || c.name || c.id;
      const req = reqText(c.unlock || c.rule);

      return `
    <div class="badge-row ${isUnlocked ? 'is-earned' : 'is-locked'}">
      ${
        isUnlocked
          ? `<div class="badge-row__icon">
   <span class="pf-mask-white"
         style="-webkit-mask-image:url(${icon});mask-image:url(${icon});"></span>
   <span class="pf-rgb-mask"
         style="-webkit-mask-image:url(${icon});mask-image:url(${icon});"></span>
   <span class="pf-foil-mask"
         style="-webkit-mask-image:url(${icon});mask-image:url(${icon});"></span>
 </div>`
          : `<div class="badge-row__icon locked">?</div>`
      }
      <div class="badge-row__meta">
        <div class="name">${name}</div>
        ${c.desc ? `<div class="desc">${c.desc}</div>` : ''}
        <div class="req">Unlock: ${req}</div>
        ${isUnlocked ? `<div class="date">Unlocked: ${date}</div>` : ''}
      </div>
    </div>`;
    };

    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">Badges — ${unlocked.length}/${catalog.length}</div>
        <button class="btn" id="pfBadgesClose" aria-label="Close">✕</button>
      </div>
      <div class="modal-body badges-modal">
        <div class="badges-modal-list">
          ${unlocked.map((c) => row(c, true)).join('')}
          ${locked.map((c) => row(c, false)).join('')}
        </div>
      </div>
    </div>`;

    document.body.appendChild(overlay);
    const list = overlay.querySelector('.badges-modal-list');
    const icons = overlay.querySelectorAll('.badge-row__icon');
    const baseLeft = icons.length ? icons[0].getBoundingClientRect().left : 0;
    icons.forEach((tile) => {
      const left = tile.getBoundingClientRect().left - baseLeft;
      tile.style.setProperty('--rgb-offset', `${left}px`);
    });
    this._badgesModal = overlay;

    // Close handlers
    const btnClose = overlay.querySelector('#pfBadgesClose');
    if (btnClose) btnClose.addEventListener('click', () => this._closeBadgesModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._closeBadgesModal();
    });
    this._escHandler = (e) => {
      if (e.key === 'Escape') this._closeBadgesModal();
    };
    window.addEventListener('keydown', this._escHandler);
  }

  _closeBadgesModal() {
    if (!this._badgesModal) return;
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    this._badgesModal.remove();
    this._badgesModal = null;
  }

  _levelFromXp(xp) {
    // simple curve: 1000 XP per level; grows later if we want
    const per = 1000;
    const level = Math.max(1, Math.floor(xp / per) + 1);
    const into = xp % per;
    const pct = (into / per) * 100;
    const toNext = per - into;
    return { level, pct, toNext };
  }

  _render(p) {
    if (!this._el) return;
    const $ = (sel) => this._el.querySelector(sel);
    // date-only, e.g., 9/16/2025
    const fmtDate = (ts) =>
      new Date(ts).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
    // ADD ↓↓↓
    const fmt = (n) => (Number(n) || 0).toLocaleString();
    const playFmt = (sec) => {
      const s = Math.max(0, Math.floor(Number(sec) || 0));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m}m ${r}s`;
    };

    const pct = (n) =>
      isFinite(n) ? `${n > 0 ? '▲ ' : n < 0 ? '▼ ' : '± '}${Math.abs(n).toFixed(0)}%` : '± 0%';

    // 5-run moving average and simple slope %
    function movingAvg(arr, n = 5) {
      if (!arr.length) return [];
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const s = Math.max(0, i - n + 1);
        const slice = arr.slice(s, i + 1);
        out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
      }
      return out;
    }
    function slopePercent(arr) {
      if (arr.length < 2) return 0;
      const y1 = arr[0],
        y2 = arr[arr.length - 1];
      if (y1 === 0) return y2 === 0 ? 0 : 100;
      return ((y2 - y1) / Math.abs(y1)) * 100;
    }

    function trendVsPrevAvg(arr, window = 6) {
      if (!arr || arr.length < 3) return 0;
      const tail = arr.slice(-window);
      const latest = tail[tail.length - 1];
      const prev = tail.slice(0, -1).filter((v) => v > 0);
      if (!prev.length) return 0;
      const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
      if (avg <= 0) return 0;
      return ((latest - avg) / avg) * 100;
    }
    // identity
    $('#pfName').textContent = p.playerName || 'Player';
    const created = p._meta?.createdAt ? new Date(p._meta.createdAt) : new Date();
    $('#pfSince').textContent = `Since ${created.toLocaleDateString()}`;

    // avatar (monogram)
    const mono = (p.playerName || 'P').trim()[0]?.toUpperCase() || 'P';
    $('#pfAvatar').textContent = mono;

    // currencies + progression
    const { copper, iridium, xp } = Bank.get();

    $('#pfCopper').textContent = fmt(copper);
    $('#pfIridium').textContent = fmt(iridium);
    $('#pfXp').textContent = fmt(xp);

    // rank card
    const R = RankSystem.fromXp(p.xp || 0);
    // emblem badge (no art yet): use tier initial
    const badge = this._el.querySelector('#pfRankBadge');
    if (badge) badge.textContent = (R.tier?.[0] || '•').toUpperCase();
    $('#pfRankName').textContent = R.displayName;
    $('#pfToNext').textContent = fmt(R.xpForLevel - R.xpInto);
    $('#pfRankIndex').textContent = R.index;
    $('#pfRankMax').textContent = 35; // 7 tiers * 5 grades (tune with RankSystem.TIERS.length*5)
    $('#pfLevelBar').style.width = `${Math.max(2, Math.min(100, R.percent))}%`;

    // lifetime chips
    const lt = p.stats?.lifetime || {};
    const runsEl = this._el.querySelector('#pfRunsStarted');
    if (runsEl) runsEl.textContent = (lt.runsStarted || 0).toLocaleString();

    const shapesEl = this._el.querySelector('#pfShapesCompleted');
    if (shapesEl) shapesEl.textContent = (lt.shapesCompleted || 0).toLocaleString();

    const ptEl = this._el.querySelector('#pfPlayTime');
    if (ptEl) ptEl.textContent = playFmt(lt.playTimeSec || 0);

    // Shapes unlocked / Favorites pills (Shapeless is secret unless owned)
    const ownedSet = new Set((p.unlocks && p.unlocks.shapes) || []);
    const allActive = (shapeRegistry || []).filter((s) => s && s.active);

    // total = all active minus Shapeless when it's not owned
    const hasSecret = allActive.some((s) => s.name === 'Shapeless');
    const secretOwned = ownedSet.has('Shapeless');
    const totalShapes = hasSecret && !secretOwned ? allActive.length - 1 : allActive.length;

    // unlocked = count of owned active shapes, excluding Shapeless if it isn't owned
    const unlocked = allActive
      .filter((s) => (secretOwned ? true : s.name !== 'Shapeless'))
      .filter((s) => ownedSet.has(s.name)).length;

    const favs = Array.isArray(p.favoriteShapes) ? p.favoriteShapes : [];
    const favText = favs.length ? `Favorites: ${favs.slice(0, 5).join(', ')}` : 'Favorites: —';

    const su = this._el.querySelector('#pfShapesUnlocked');
    if (su) su.textContent = `${unlocked}/${totalShapes}`;
    const fs = this._el.querySelector('#pfFavShapes');
    if (fs) fs.textContent = favText;

    // Mini-games chip (completed only)
    const mg = this._el.querySelector('#pfMiniGames');
    if (mg) mg.textContent = (lt.miniGamesCompleted || 0).toLocaleString();

    // ----- Best Run card + Best pill text -----
    const bests = p.bests || {};
    const best =
      bests.bestRun ||
      (p.recentRuns && p.recentRuns.length
        ? p.recentRuns.reduce((a, r) => (r.score > (a?.score || 0) ? r : a), p.recentRuns[0])
        : null);

    const bestDiv = $('#pfBestRun');
    if (!best) {
      bestDiv.textContent = 'No runs yet.';
    } else {
      const level = best.level || best.levelReached || 1;
      const cycles = best.cycles || best.infiniteCycles || 0;
      const levelText =
        level === 4 ? (cycles > 0 ? `Level ∞ C${cycles}` : 'Level ∞') : `Level ${level}`;
      const xpGained = best.xpGained || 0;

      // Highest level label with ∞ cycles support
      const highVal = (bests.highestLevel || level) | 0;

      // try a stored highestCycles first; otherwise derive from history
      let highCycles = (bests.highestCycles || 0) | 0;
      if (!highCycles && highVal >= 4) {
        const allRuns = p.recentRuns || [];
        for (const r of allRuns) {
          const lv = r.level || r.levelReached || 0;
          if (lv === 4) {
            const c = (r.cycles || r.infiniteCycles || 0) | 0;
            if (c > highCycles) highCycles = c;
          }
        }
      }

      // Build the final “Highest …” label
      const highestLabel =
        highVal >= 4
          ? `Highest ∞${highCycles > 0 ? ' C' + highCycles : ''}`
          : `Highest L${highVal}`;

      const notes = [];

      if (bests.fastestRunSec && best.durationSec === bests.fastestRunSec) notes.push('Fastest');
      if (bests.longestRunSec && best.durationSec === bests.longestRunSec) notes.push('Longest');
      if (
        bests.mostShapesInRun &&
        (best.shapesCleared ?? best.shapesCompleted ?? 0) === bests.mostShapesInRun
      ) {
        notes.push('Most Shapes');
      }
      notes.push(highestLabel);

      bestDiv.innerHTML = `
    <div>${fmtDate(best.ts || Date.now())}</div>
    <div>Score <b>${fmt(best.score)}</b> • ${playFmt(best.durationSec || 0)} • ${
        best.shapesCleared ?? best.shapesCompleted ?? 0
      } shapes</div>
    <div>${levelText} • XP +${fmt(xpGained)}</div>
    <div class="muted">${notes.join(' • ')}</div>
  `;
    }

    // ----- Trends (moving average slope over last 20) -----
    const runs = (p.recentRuns || []).slice(0, 20);
    const scores = runs.map((r) => r.score | 0).reverse(); // chronological
    const durations = runs.map((r) => r.durationSec | 0).reverse();
    const shapesPer = runs.map((r) => r.shapesCleared ?? r.shapesCompleted ?? 0).reverse();
    const xpList = runs
      .map((r) => r.xpGained || 0)
      .reverse()
      .filter((v) => v > 0);

    const sMA = movingAvg(scores);
    const dMA = movingAvg(durations);
    const shMA = movingAvg(shapesPer);
    const xpMA = movingAvg(xpList);

    const scoreSlope = slopePercent(sMA);
    const durSlope = slopePercent(dMA);
    const shapesSlope = slopePercent(shMA);
    const xpSlope = trendVsPrevAvg(xpList);
    const trendSpan = (v) =>
      `<span class="trend ${v > 0 ? 'up' : v < 0 ? 'down' : 'flat'}">${
        v > 0 ? '▲' : v < 0 ? '▼' : '±'
      } ${Math.abs(v).toFixed(0)}%</span>`;

    $('#pfTrends').innerHTML = `
  <div>Score: ${trendSpan(scoreSlope)}</div>
  <div>Duration: ${trendSpan(durSlope)}</div>
  <div>Shapes/Run: ${trendSpan(shapesSlope)}</div>
  <div>XP/Run: ${trendSpan(xpSlope)}</div>
`;

    // recent runs (last 6)
    const recent = $('#pfRecent');
    recent.innerHTML = '';

    // --- sparkline over last 15 scores (with moving avg + PB marker + hover tip) ---
    const sparkHost = $('#pfRunSparkline');
    sparkHost.innerHTML = '';
    const runsAll = p.recentRuns || [];
    const lastN = runsAll.slice(0, 15).slice().reverse();
    const last = lastN.map((r) => Math.max(0, r.score || 0));
    if (last.length >= 2) {
      const w = sparkHost.clientWidth || 300;
      const h = 48;

      // padding so dots (esp. big ones) don’t clip
      const padX = 6;
      const padY = 6;

      const max = Math.max(...last);
      const min = Math.min(...last);
      const rng = Math.max(1, max - min);

      const xy = (v, i) => {
        const x = padX + (i / (last.length - 1)) * (w - padX * 2);
        const y = padY + (1 - (v - min) / rng) * (h - padY * 2);
        return [Math.round(x), Math.round(y)];
      };
      const pts = last
        .map((v, i) => xy(v, i))
        .map(([x, y]) => `${x},${y}`)
        .join(' ');

      // simple moving average (window 5)
      const ma = last.map((_, i) => {
        const a = Math.max(0, i - 2),
          b = Math.min(last.length - 1, i + 2);
        const slice = last.slice(a, b + 1);
        return slice.reduce((s, v) => s + v, 0) / slice.length;
      });
      const ptsMA = ma
        .map((v, i) => xy(v, i))
        .map(([x, y]) => `${x},${y}`)
        .join(' ');

      // PB index (in this window)
      const pbIdx = last.indexOf(Math.max(...last));
      const [pbx, pby] = xy(last[pbIdx], pbIdx);

      // index for PB (already computed as pbIdx)
      // index for fastest duration and most shapes in this window
      const shapesInWin = lastN.map((r) => r.shapesCleared ?? r.shapesCompleted ?? 0);
      const mostShapesIdx = shapesInWin.length ? shapesInWin.indexOf(Math.max(...shapesInWin)) : -1;

      const dursInWin = lastN.map((r) => r.durationSec || 0).filter((v) => v > 0);
      const fastestVal = dursInWin.length ? Math.min(...dursInWin) : 0;
      const fastestIdx = fastestVal
        ? lastN.findIndex((r) => (r.durationSec || 0) === fastestVal)
        : -1;

      // build dots markup
      const dotsAll = last
        .map((v, i) => {
          const [x, y] = xy(v, i);
          return `<circle class="pt" data-idx="${i}" cx="${x}" cy="${y}" r="2" fill="currentColor" opacity="0.9" style="cursor:pointer"/>`;
        })
        .join('');

      const bigIdxs = [pbIdx, mostShapesIdx, fastestIdx].filter((i) => i >= 0);
      const dotsBig = bigIdxs
        .map((i) => {
          const [x, y] = xy(last[i], i);
          return `<circle class="pt big" data-idx="${i}" cx="${x}" cy="${y}" r="5" fill="currentColor" opacity="0.95" style="cursor:pointer"/>`;
        })
        .join('');
      const svg = `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline points="${pts}"   fill="none" stroke="currentColor"
  stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
<polyline points="${ptsMA}" fill="none" stroke="currentColor"
  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
  opacity="0.25" stroke-dasharray="4 3"/>
${dotsAll}
${dotsBig}
    </svg>`;
      sparkHost.innerHTML = svg;

      // click-to-show tooltip; hover = small grow
      const tip = document.createElement('div');
      tip.style.cssText =
        'position:absolute;transform:translate(-50%,-120%);font-size:12px;padding:4px 6px;border-radius:6px;background:rgba(0,0,0,0.7);color:#fff;pointer-events:none;display:none;';
      sparkHost.style.position = 'relative';
      sparkHost.appendChild(tip);

      const showTipFor = (idx) => {
        const run = lastN[idx];
        if (!run) return;
        const tags = [];
        if (idx === pbIdx) tags.push('PB');
        if (idx === fastestIdx) tags.push('Fastest');
        if (idx === mostShapesIdx) tags.push('Most Shapes');

        tip.innerHTML =
          `${fmtDate(run.ts)}<br/>` +
          `Score ${fmt(run.score)} · ${playFmt(run.durationSec)} · ` +
          `${run.shapesCleared ?? run.shapesCompleted ?? 0} shapes` +
          (tags.length ? `<br/><span class="muted">${tags.join(' • ')}</span>` : '');

        const c = sparkHost.querySelector(`circle.pt[data-idx="${idx}"]`);
        if (!c) return;
        tip.style.left = `${c.getAttribute('cx')}px`;
        tip.style.top = `${c.getAttribute('cy')}px`;
        tip.style.display = 'block';
      };

      // bind hover + click on every dot
      sparkHost.querySelectorAll('circle.pt').forEach((c) => {
        const baseR = +c.getAttribute('r');
        c.addEventListener('mouseenter', () => c.setAttribute('r', String(baseR + 2))); // ← was +1
        c.addEventListener('mouseleave', () => c.setAttribute('r', String(baseR)));
        c.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = +c.dataset.idx || 0;
          showTipFor(idx);
        });
      });

      // click anywhere else in the spark area to hide
      sparkHost.addEventListener('click', (e) => {
        const onDot = e.target?.closest && e.target.closest('circle.pt');
        if (!onDot) tip.style.display = 'none';
      });
      // click anywhere outside the sparkline to hide the tooltip
      // (avoid duplicate listeners on re-render)
      if (this._el._hideSparkTip) {
        this._el.removeEventListener('click', this._el._hideSparkTip);
      }
      const hideOnOutsideClick = (e) => {
        const insideSpark = e.target?.closest && e.target.closest('#pfRunSparkline');
        if (!insideSpark) tip.style.display = 'none';
      };
      this._el._hideSparkTip = hideOnOutsideClick;
      this._el.addEventListener('click', hideOnOutsideClick);
    }
    const list = (p.recentRuns || []).slice(0, 6);
    if (!list.length) {
      recent.innerHTML = `<div class="muted">No runs yet.</div>`;
    } else {
      for (const r of list) {
        const row = document.createElement('div');
        row.className = 'recent-row';
        const when = r.ts ? new Date(r.ts).toLocaleString() : '';
        // compute rolling avg of the previous 5 scores for trend
        const all = p.recentRuns || [];
        const idx = all.indexOf(r);
        const prev = all.slice(idx + 1, idx + 6).map((x) => x.score || 0);
        const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : r.score || 0;
        const delta = avg ? (r.score - avg) / avg : 0;
        const trend = delta > 0.05 ? '▲' : delta < -0.05 ? '▼' : '•';
        const trendClass = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat';

        const bestScore = Math.max(...all.map((x) => x.score || 0), 0);
        const fastest = Math.min(...all.map((x) => x.durationSec || 1e9), 1e9);
        const longest = Math.max(...all.map((x) => x.durationSec || 0), 0);
        const tags = [];
        if ((r.score || 0) === bestScore && bestScore > 0) tags.push('PB');
        if ((r.durationSec || 0) === fastest && fastest < 1e9) tags.push('Fastest');
        if ((r.durationSec || 0) === longest && longest > 0) tags.push('Longest');

        const level = r.level || r.levelReached || 1;
        const cycles = r.cycles || r.infiniteCycles || 0;
        const levelText = level === 4 ? (cycles > 0 ? `Lv ∞ C${cycles}` : 'Lv ∞') : `Lv ${level}`;

        row.innerHTML = `
  <span class="date">${fmtDate(r.ts || Date.now())}</span>
  <span class="sp">•</span>
  <b>Score ${fmt(r.score)}</b>
  <span class="sp">•</span>
  <span>${playFmt(r.durationSec || 0)}</span>
  <span class="sp">•</span>
  <span>${levelText}</span>
  <span class="sp">•</span>
  <span>${r.shapesCleared ?? r.shapesCompleted ?? 0} shapes</span>
  <span class="sp">•</span>
  <span>XP +${fmt(r.xpGained || 0)}</span>
  <span class="sp">•</span>
  <span class="trend ${trendClass}" title="vs rolling avg of previous 5">${trend} ${Math.round(
          delta * 100
        )}%</span>
  ${tags.length ? `<span class="sp">•</span><span class="tags">${tags.join(' · ')}</span>` : ''}
`;
        recent.appendChild(row);
      }
    }
    this._randomizeXpColor();
  }

  unmount() {
    if (this._unbind) this._unbind();
    if (this._onProfileUpdate) {
      window.removeEventListener('profile:updated', this._onProfileUpdate);
      this._onProfileUpdate = null;
    }
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this._badgesModal) {
      this._badgesModal.remove();
      this._badgesModal = null;
    }
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
    this._el = null;
  }
}
