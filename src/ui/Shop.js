// src/ui/Shop.js
import ProfileStore from '../libs/ProfileStore.js';
import SkinManager from '../libs/SkinManager.js';
import Analytics from '../libs/Analytics.js';
import * as Bank from '../libs/Bank.js';

// --- Standard shop panel factory (always produces a panel) ---
function makePanelSlide({ id, title, bodyHTML = '' }) {
  const el = document.createElement('div');
  el.className = 'orbit-panel';
  el.dataset.section = id;

  // Default “empty” body if nothing is supplied
  el.innerHTML = `
    <div class="shop-section-head"><h3>${title}</h3></div>
    ${
      bodyHTML?.trim() ||
      `
      <div class="shop-empty-note">Nothing to show here yet. Check back soon.</div>
      <div class="shop-grid"></div>
    `
    }
  `;
  return el;
}

// currency icons (PNG assets already exist)
const IMG = {
  copper: './assets/currencies/copper.PNG',
  iridium: './assets/currencies/iridium.PNG',
  xp: './assets/currencies/xp.PNG',
};

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

/** ──────────────────────────────────────────────────────────────────────────
 * Profile helpers (support both flat and nested layouts defensively)
 * ───────────────────────────────────────────────────────────────────────── */
function getProfile() {
  const ps = ProfileStore;
  const p =
    (ps.get && ps.get()) ||
    (ps.getProfile && ps.getProfile()) ||
    (ps.state && ps.state.profile) ||
    ps.profile ||
    {};

  if (!p.currencies) {
    p.currencies = {
      copper: Number(p.copper ?? 0),
      iridium: Number(p.iridium ?? 0),
    };
  }
  p.xp = Number(p.xp ?? 0);
  p.unlocks ||= { shapes: [], skins: [], trails: [], boosters: [] };
  return p;
}
const readBalances = () => {
  const p = getProfile();
  return {
    copper: p.currencies?.copper ?? p.copper ?? 0,
    iridium: p.currencies?.iridium ?? p.iridium ?? 0,
    xp: p.xp ?? 0,
  };
};
const canAfford = (p, price) => {
  if (!price || !price.type) return true;
  const c = p.currencies || p;
  if (price.type === 'copper') return (c.copper || 0) >= (price.amount || 0);
  if (price.type === 'iridium') return (c.iridium || 0) >= (price.amount || 0);
  if (price.type === 'xp') return (p.xp || 0) >= (price.amount || 0);
  return true;
};
const spend = (p, price) => {
  if (!price || !price.type) return;
  const amt = Number(price.amount || 0);
  p.currencies ||= { copper: Number(p.copper || 0), iridium: Number(p.iridium || 0) };
  if (price.type === 'copper') p.currencies.copper = Math.max(0, (p.currencies.copper || 0) - amt);
  if (price.type === 'iridium')
    p.currencies.iridium = Math.max(0, (p.currencies.iridium || 0) - amt);
  if (price.type === 'xp') p.xp = Math.max(0, (p.xp || 0) - amt);
};

/** ──────────────────────────────────────────────────────────────────────────
 * Data loader (reads your existing assets/shop.json)
 * ───────────────────────────────────────────────────────────────────────── */
async function loadShopJSON() {
  try {
    const res = await fetch('./assets/shop.json', { cache: 'no-store' });
    return await res.json();
  } catch {
    return null;
  }
}
const toPrices = (obj = {}) =>
  Object.entries(obj).map(([type, amount]) => ({ type, amount: Number(amount || 0) }));

const pluralToSingular = (k) =>
  ({ skins: 'skin', trails: 'trail', boosters: 'booster', shapes: 'shape' }[k] || k);
// ---------- deterministic selection helpers (no ids in code) ----------
const DAY_MS = 86400000;
const WEEK_MS = DAY_MS * 7;
const seeded = (seed) => {
  // mulberry32
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};
const seededShuffle = (arr, seed) => {
  const rnd = seeded(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const tokenToKindId = (t) => {
  const [plural, id] = String(t).split(':');
  return { kind: pluralToSingular(plural), id: id || t };
};

function collectFromCatalog(idx, cat, from = ['skins', 'trails', 'boosters', 'shapes', 'jukebox']) {
  const out = [];
  const list = Array.isArray(from) ? from : [from];
  for (const plural of list) {
    const kind = pluralToSingular(plural);
    const arr = Array.isArray(cat[plural]) ? cat[plural] : [];
    for (const raw of arr) {
      const it = idx[kind]?.get(raw.id);
      if (it) out.push(it);
    }
  }
  return out;
}

function resolvePickSpec({ json, idx, spec, seed = 0, fallbackFrom = ['skins'] }) {
  // spec can be: Array<token>, "AUTO", or { pick, exclude, from }
  if (Array.isArray(spec)) {
    return spec.map((t) => resolveToken(idx, t)).filter(Boolean);
  }
  if (spec === 'AUTO' || spec === true) {
    const pool = collectFromCatalog(idx, json.catalog || {}, fallbackFrom);
    return seededShuffle(pool, seed);
  }
  if (spec && typeof spec === 'object') {
    const from = spec.from || fallbackFrom;
    const pool = collectFromCatalog(idx, json.catalog || {}, from);
    let excludeIds = new Set((spec.exclude || []).map((e) => tokenToKindId(e).id));
    const picked = seededShuffle(
      pool.filter((i) => !excludeIds.has(i.id)),
      seed
    );
    return picked.slice(0, Math.max(0, spec.pick | 0));
  }
  // legacy empty → nothing
  return [];
}

/** Build an index { kind: Map<id, item> } for quick lookups */
function buildIndex(json) {
  const out = {};
  const cat = json?.catalog || {};
  for (const plural of Object.keys(cat)) {
    const kind = pluralToSingular(plural);
    out[kind] ||= new Map();
    for (const raw of cat[plural]) {
      out[kind].set(raw.id, {
        id: raw.id,
        name: raw.name || raw.id,
        kind,
        prices: toPrices(raw.price || {}),
        unlock: raw.unlock || 'always',
        consumable: !!raw.consumable,
        meta: raw,
      });
    }
  }
  return out;
}
/** Resolve a token like "skins:Neon" → item record (if present) */
function resolveToken(index, token = '') {
  const [plural, id] = String(token).split(':');
  const kind = pluralToSingular(plural);
  return index[kind]?.get(id) || null;
}

/** ──────────────────────────────────────────────────────────────────────────
 * Type adapter registry (so Shop never hardcodes item behavior)
 * Each adapter may define:
 *  - isOwned(profile, item)     → boolean
 *  - markOwned(profile, item)   → void (mutates)
 *  - preview(item)              → optional hook
 *  - equippable                 → boolean (for future “Equip”)
 * ───────────────────────────────────────────────────────────────────────── */
const ADAPTERS = {};
function registerType(kind, adapter) {
  ADAPTERS[kind] = {
    isOwned: () => false,
    markOwned: () => {},
    equippable: false,
    preview: null,
    ...adapter,
  };
}
// defaults for common types you already use
registerType('skin', {
  isOwned: (p, item) => (p.unlocks?.skins || []).includes(item.id) || item.id === 'Default',
  markOwned: (p, item) => {
    p.unlocks ||= { skins: [], shapes: [], trails: [], boosters: [] };
    p.unlocks.skins ||= [];
    if (!p.unlocks.skins.includes(item.id)) p.unlocks.skins.push(item.id);
  },
  equippable: true,
  preview: (item) => {
    try {
      if (SkinManager?.preview) SkinManager.preview(item.id);
    } catch {}
  },
});
registerType('shape', {
  isOwned: (p, item) => (p.unlocks?.shapes || []).includes(item.id),
  markOwned: (p, item) => {
    p.unlocks ||= { skins: [], shapes: [], trails: [], boosters: [] };
    p.unlocks.shapes ||= [];
    if (!p.unlocks.shapes.includes(item.id)) p.unlocks.shapes.push(item.id);
  },
});
registerType('trail', {
  isOwned: (p, item) => (p.unlocks?.trails || []).includes(item.id),
  markOwned: (p, item) => {
    p.unlocks ||= { skins: [], shapes: [], trails: [], boosters: [] };
    p.unlocks.trails ||= [];
    if (!p.unlocks.trails.includes(item.id)) p.unlocks.trails.push(item.id);
  },
});
registerType('booster', {
  // consumables are not treated as “owned”; they will remain purchasable
  isOwned: () => false,
  markOwned: () => {},
});

/** ──────────────────────────────────────────────────────────────────────────
 * Section builders: Featured / Rotations / Full Catalog
 * ───────────────────────────────────────────────────────────────────────── */
function materializeSections(json) {
  if (!json) json = {};
  const idx = buildIndex(json);
  const cat = json.catalog || {};

  const DAY_MS = 86400000;
  const todaySeed = Math.floor(Date.now() / DAY_MS);

  // Featured: accepts arrays / "AUTO" / or {from,pick,exclude}
  const featuredItems = resolvePickSpec({
    json,
    idx,
    spec: json.featured || {
      from: ['skins', 'trails', 'boosters'],
      pick: 6,
      exclude: ['skins:Default'],
    },
    seed: todaySeed,
    fallbackFrom: ['skins', 'trails', 'boosters'],
  });

  const getItems = (plural) => {
    const kind = pluralToSingular(plural);
    const arr = Array.isArray(cat[plural]) ? cat[plural] : [];
    return arr.map((raw) => idx[kind]?.get(raw.id)).filter(Boolean);
  };

  return [
    { key: 'challenges', title: 'Challenges' },
    { key: 'featured', title: 'Featured', items: featuredItems },
    { key: 'shapes', title: 'Shapes', items: getItems('shapes') },
    { key: 'skins', title: 'Skins', items: getItems('skins') },
    { key: 'boosts', title: 'Boosts', items: getItems('boosters') },
    { key: 'jukebox', title: 'Jukebox', items: getItems('jukebox') },
  ];
}

/** ──────────────────────────────────────────────────────────────────────────
 * Render helpers
 * ───────────────────────────────────────────────────────────────────────── */
const pillHTML = (type, value) => `
  <div class="curr-badge" data-type="${type}">
    ${
      type === 'xp'
        ? '<span class="xp-mask" aria-hidden="true"></span>'
        : `<img src="${IMG[type]}" alt="${type}">`
    }
    <span class="val">${fmt(value)}</span>
  </div>`;

const pricePillsHTML = (prices = []) =>
  prices
    .map(
      (pr) => `
      <span class="price-pill" data-ptype="${pr.type}">
        <img class="price-icon" src="${IMG[pr.type]}" alt="${pr.type}">
        ${fmt(pr.amount)}
      </span>`
    )
    .join('');

// Tag chips (badges) ---------------------------------------------------------
const tagChip = (t = '') => {
  const key = String(t).trim().toLowerCase();
  return `<span class="tag tag--${key}">${t.toUpperCase()}</span>`;
};
const normalizeTags = (item) => {
  const tags = [];
  // carry-through from JSON: e.g., { "tags": ["new","sale"] }
  if (Array.isArray(item?.meta?.tags)) {
    for (const t of item.meta.tags) if (t) tags.push(String(t));
  }
  if (item.consumable) tags.push('consumable');
  // Example derived tags you can toggle later:
  // if (window.__weeklySkins?.includes(item.id)) tags.push('weekly');
  return tags;
};

// Universal card renderer (works for skins, trails, boosters, shapes, jukebox)
function cardHTML(item) {
  const tags = normalizeTags(item);
  const owned = !!item.owned;
  const locked = !!item.locked;

  const ownedClass = owned && !item.consumable ? ' owned' : '';
  const lockedClass = locked ? ' locked' : '';
  const buyDisabled = owned && !item.consumable ? 'disabled' : '';
  const buyLabel = owned && !item.consumable ? 'Owned' : 'Buy';

  return `
    <article class="shop-card${ownedClass}${lockedClass}" data-id="${item.id}" data-kind="${
    item.kind
  }">
      <div class="shop-card-title">${item.name}</div>
      ${tags.length ? `<div class="tag-row">${tags.map(tagChip).join('')}</div>` : ''}

      ${item.prices?.length ? `<div class="price-pills">${pricePillsHTML(item.prices)}</div>` : ''}

      <div class="shop-card-actions">
        <button class="btn small prev" aria-label="Preview ${item.name}">Preview</button>
        <button class="btn small buy" ${buyDisabled} aria-label="${buyLabel} ${
    item.name
  }">${buyLabel}</button>
      </div>

      ${locked ? `<div class="lock-note">${item.lockedReason || 'Locked'}</div>` : ''}
    </article>
  `;
}

function decorateForUI(item, profile) {
  const a = ADAPTERS[item.kind] || {};
  const owned = a.isOwned?.(profile, item) || false;
  const locked = item.unlock && item.unlock !== 'always' ? false : false; // future: wire rules/text
  const lockedReason = locked ? 'Locked' : '';
  return { ...item, owned, locked, lockedReason };
}

// -------- panel renderer: ALWAYS returns a panel ----------
const challengesPanelHTML = () => `
  <section class="orbit-panel" data-section="challenges">
    <header class="shop-section-head"><h3>Challenges</h3></header>
    <div class="shop-grid">
      <div class="shop-card shop-card--challenges">
        <div class="shop-card-title">Daily • Weekly • Lifetime</div>
        <p class="shop-empty-note">Complete tasks to earn Copper, Iridium, Skins & more.</p>
        <div class="shop-card-actions">
          <button class="btn small" data-action="open-challenges">View Challenges</button>
        </div>
      </div>
    </div>
  </section>`;

const emptyPanelHTML = (section) => `
  <section class="orbit-panel" data-section="${section.key}">
    <header class="shop-section-head"><h3>${section.title}</h3></header>
    <div class="shop-grid">
      <div class="shop-card shop-card--empty">
        <div class="shop-card-title">Coming soon</div>
        <p class="shop-empty-note">${section.title} will appear here.</p>
      </div>
    </div>
  </section>`;

const featuredEmptyHTML = (section) => `
  <section class="orbit-panel" data-section="${section.key}">
    <header class="shop-section-head"><h3>${section.title}</h3></header>
    <div class="shop-grid">
      <div class="shop-card shop-card--empty">
        <div class="shop-card-title">No featured items yet</div>
        <p class="shop-empty-note">Check back soon.</p>
      </div>
    </div>
  </section>`;

// The dispatcher the orbit uses to build each slide
const panelHTML = (section) => {
  if (section.key === 'challenges') return challengesPanelHTML();
  if (!section.items || !section.items.length) {
    return section.key === 'featured' ? featuredEmptyHTML(section) : emptyPanelHTML(section);
  }
  return `
    <section class="orbit-panel" data-section="${section.key}">
      <header class="shop-section-head"><h3>${section.title}</h3></header>
      <div class="shop-grid">
        ${section.items.map(cardHTML).join('')}
      </div>
    </section>`;
};

/** ──────────────────────────────────────────────────────────────────────────
 * Screen factory
 * ───────────────────────────────────────────────────────────────────────── */
export default async function Shop(opts = {}) {
  const root = document.createElement('div');
  root.className = 'screen screen--panel shop-root shop-screen';

  // load + build
  const raw = await loadShopJSON();

  // publish catalog globals for other tools + feed SkinManager
  try {
    window.__shopCatalog = raw?.catalog || null;
    window.__shopSkins = Array.isArray(raw?.catalog?.skins)
      ? raw.catalog.skins.map((s) => s.id)
      : null;
    if (SkinManager?.setCatalog) SkinManager.setCatalog(raw?.catalog?.skins || []);
    if (SkinManager?.preloadFromCatalog) await SkinManager.preloadFromCatalog();
  } catch (_) {}

  const sectionsRaw = materializeSections(raw);
  const profile = getProfile();
  const sections = sectionsRaw.map((s) => ({
    ...s,
    items: Array.isArray(s.items) ? s.items.map((it) => decorateForUI(it, profile)) : [],
  }));

  // expose catalog ids for other tools (read-only)
  try {
    window.__shopCatalog = raw?.catalog || null;
    window.__shopSkins = Array.isArray(raw?.catalog?.skins)
      ? raw.catalog.skins.map((s) => s.id)
      : null;
  } catch (_) {}

  const balances = Bank.get();

  root.innerHTML = `
    <div class="panel">
      <div class="panel-header shop-head">
  <div class="shop-titlewrap">
    <h2>Shop</h2>
    <span class="shop-sub">— <span class="shop-sub-text"></span></span>
  </div>
  <div class="shop-currencies">
          ${pillHTML('copper', balances.copper)}
          ${pillHTML('iridium', balances.iridium)}
          ${pillHTML('xp', balances.xp)}
        </div>
        <button class="btn back">Back</button>
      </div>
      <div class="panel-body">
        <div class="shop-orbit">
  <button class="orbit-nav left" aria-label="Prev">‹</button>
  <div class="orbit-track">
    ${sections.map(panelHTML).join('')}
  </div>
  <button class="orbit-nav right" aria-label="Next">›</button>
  <div class="orbit-dots" role="tablist" aria-label="Shop sections">
    ${sections
      .map(
        (s, i) =>
          `<button class="dot" role="tab" data-index="${i}" title="${s.title}" aria-selected="${
            i === 0 ? 'true' : 'false'
          }"></button>`
      )
      .join('')}
  </div>
  <div class="orbit-shadow"></div>
</div>
      </div>
    </div>`;

  // orbit carousel
  const $track = root.querySelector('.orbit-track');
  const $panels = [...root.querySelectorAll('.orbit-panel')];
  const $navL = root.querySelector('.orbit-nav.left');
  const $navR = root.querySelector('.orbit-nav.right');
  const $dots = [...root.querySelectorAll('.orbit-dots .dot')];
  const $subtitle = root.querySelector('.shop-sub-text');
  const $dotsHost = root.querySelector('.orbit-dots');

  function updateHeader() {
    if ($subtitle) $subtitle.textContent = sections[index]?.title || '';
  }

  function positionControls() {
    if (!$dotsHost) return;

    requestAnimationFrame(() => {
      // Measure the actual dot cluster: from first dot's left to last dot's right
      const firstDot = $dots[0];
      const lastDot = $dots[$dots.length - 1];

      let dotsW = 0;
      if (firstDot && lastDot) {
        const r1 = firstDot.getBoundingClientRect();
        const r2 = lastDot.getBoundingClientRect();
        dotsW = Math.max(0, r2.right - r1.left);
      } else {
        // fallback if dots not rendered yet
        const dotSize = 8; // CSS: .dot width/height
        const gap = 8; // CSS: .orbit-dots gap
        dotsW = $dots.length > 0 ? $dots.length * dotSize + ($dots.length - 1) * gap : 80;
      }

      const gap = 12; // spacing between arrows and dot row
      const aw = ($navL && $navL.offsetWidth) || 36;

      if ($navL) {
        $navL.style.right = 'auto';
        $navL.style.left = `calc(50% - ${dotsW / 2 + gap + aw}px)`;
        $navL.style.bottom = '6px';
      }
      if ($navR) {
        $navR.style.right = 'auto';
        $navR.style.left = `calc(50% + ${dotsW / 2 + gap}px)`;
        $navR.style.bottom = '6px';
      }
    });
  }

  // declare index BEFORE we first read it
  let index = 0;

  // set initial "Shop — <panel>" and place arrows once DOM is ready
  updateHeader();
  positionControls();

  const syncDots = () => {
    $dots.forEach((d, i) => {
      const on = i === index;
      d.classList.toggle('is-active', on);
      d.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  };

  const syncNav = () => {
    $navL.disabled = index <= 0;
    $navR.disabled = index >= $panels.length - 1;
    syncDots();
  };

  const setPosTags = () =>
    $panels.forEach((p, i) =>
      p.setAttribute('data-pos', i === index ? 'mid' : i < index ? 'left' : 'right')
    );

  // Width of each slide = inner width of the orbit host, minus inline padding
  const panelW = () => {
    const host = root.querySelector('.shop-orbit');
    if (!host) return 0;
    const style = getComputedStyle(host);
    const padL = parseFloat(style.paddingLeft) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    return Math.max(0, host.clientWidth - padL - padR);
  };

  const layout = () => {
    const w = panelW();
    $panels.forEach((p) => (p.style.width = `${Math.max(0, w)}px`));
    $track.style.transform = `translateX(${-index * w}px)`;
    setPosTags();
    syncNav();
    updateHeader();
    positionControls();
  };

  const jump = (to) => {
    const w = panelW();
    index = Math.max(0, Math.min($panels.length - 1, to | 0));
    $track.style.transition = 'transform .55s cubic-bezier(0.2,0.8,0.2,1)';
    $track.style.transform = `translateX(${-index * w}px)`;
    setPosTags();
    syncNav();
    updateHeader();
    positionControls();
    setTimeout(() => ($track.style.transition = 'none'), 560);
  };

  const go = (dir) => jump(index + dir);

  // pager dots (click to jump)
  $dots.forEach((d) => d.addEventListener('click', () => jump(Number(d.dataset.index || 0))));

  // Arrow keys to navigate
  root.tabIndex = 0;
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  });

  // Hide nav + dots if only one section
  if ($panels.length <= 1) {
    $navL.style.display = 'none';
    $navR.style.display = 'none';
    const dotsHost = root.querySelector('.orbit-dots');
    if (dotsHost) dotsHost.style.display = 'none';
  }

  $navL.addEventListener('click', () => go(-1));
  $navR.addEventListener('click', () => go(1));
  window.addEventListener('resize', layout, { passive: true });

  // buy / preview
  root.addEventListener('click', (ev) => {
    // Challenges CTA → route to Vault (we’ll deep-link later)
    const openCh = ev.target.closest('[data-action="open-challenges"]');
    if (openCh) {
      try {
        location.hash = '#/vault';
      } catch {}
      return;
    }
    const buy = ev.target.closest('.buy');
    const prev = ev.target.closest('.prev');
    if (!buy && !prev) return;

    const card = ev.target.closest('.shop-card');
    const sectionEl = ev.target.closest('.orbit-panel');
    if (!card || !sectionEl) return;

    const secKey = sectionEl.getAttribute('data-section');
    const itId = card.getAttribute('data-id');
    const kind = card.getAttribute('data-kind');
    const section = sections.find((s) => s.key === secKey);
    const item = section?.items.find((x) => x.id === itId);
    if (!item) return;

    // preview
    if (prev) {
      const ad = ADAPTERS[kind];
      if (ad?.preview) ad.preview(item);
      Analytics.event('shop_preview', { id: item.id, kind: item.kind, section: secKey });
      return;
    }

    // buy
    const p = getProfile();
    const prices = item.prices || [];
    const preferred = prices.find((pr) => pr.type === 'copper') || prices[0];
    if (!preferred) return;

    if (!Bank.canAfford({ [preferred.type]: preferred.amount })) {
      buy.classList.add('denied');
      setTimeout(() => buy.classList.remove('denied'), 380);
      return;
    }

    const ok = Bank.spend({ [preferred.type]: preferred.amount });
    if (!ok) return; // safety net if another screen just spent
    const adapter = ADAPTERS[kind];
    if (!item.consumable && adapter?.markOwned) adapter.markOwned(p, item);

    // persist ownership without stomping balances that Bank just saved
    ProfileStore.update((p2) => {
      if (!item.consumable && adapter?.markOwned) adapter.markOwned(p2, item);
    });
    Analytics.event('shop_purchase', { id: item.id, kind, price: preferred, section: secKey });

    // UI refresh from the single source of truth
    const bal = Bank.get();
    root.querySelector('.curr-badge[data-type="copper"] .val').textContent = fmt(bal.copper);
    root.querySelector('.curr-badge[data-type="iridium"] .val').textContent = fmt(bal.iridium);
    root.querySelector('.curr-badge[data-type="xp"] .val').textContent = fmt(bal.xp);

    if (!item.consumable) {
      card.classList.add('owned');
      const btn = card.querySelector('.buy');
      btn.textContent = 'Owned';
      btn.disabled = true;
    }
  });

  // live balance updates (e.g., other screens grant currency)
  const onBankChanged = () => {
    const bal = Bank.get();
    const $c = root.querySelector('.curr-badge[data-type="copper"] .val');
    const $i = root.querySelector('.curr-badge[data-type="iridium"] .val');
    const $x = root.querySelector('.curr-badge[data-type="xp"] .val');
    if ($c) $c.textContent = fmt(bal.copper);
    if ($i) $i.textContent = fmt(bal.iridium);
    if ($x) $x.textContent = fmt(bal.xp);
  };
  window.addEventListener('bank:changed', onBankChanged);

  // Back button
  root.querySelector('.btn.back')?.addEventListener('click', () => {
    if (opts && typeof opts.onBack === 'function') opts.onBack();
    else history.back();
  });

  // public mount API
  const api = {
    mount(container) {
      container.innerHTML = '';
      container.appendChild(root);
      layout();
      // Ensure widths are measured AFTER first paint (fixes panels beyond the first)
      requestAnimationFrame(layout);
      Analytics.event('view_shop');
    },
    unmount() {
      window.removeEventListener('resize', layout);
      window.removeEventListener('bank:changed', onBankChanged);
    },
  };
  return api;
}

// allow external modules to add new types without editing Shop.js
export { registerType as registerShopType };
