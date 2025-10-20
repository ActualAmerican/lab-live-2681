// HUD.js
const HUD_FONT_PRESETS = {
  // current ones / aliases
  default: 'Orbitron, system-ui, sans-serif',
  orbitron: 'Orbitron, system-ui, sans-serif',
  retro: "'Press Start 2P', system-ui, monospace",
  clean: "'Roboto Condensed', system-ui, sans-serif",
  mono: "'Share Tech Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  audiowide: "'Audiowide', system-ui, sans-serif",
  oxanium: "'Oxanium', system-ui, sans-serif",
  rajdhani: "'Rajdhani', system-ui, sans-serif",
  exo2: "'Exo 2', system-ui, sans-serif",
  barlow: "'Barlow Condensed', system-ui, sans-serif",
  teko: "'Teko', system-ui, sans-serif",
  quantico: "'Quantico', system-ui, sans-serif",
  aldrich: "'Aldrich', system-ui, sans-serif",
  vt323: "'VT323', system-ui, monospace",
  chakra: "'Chakra Petch', system-ui, sans-serif",
};

export default class HUD {
  constructor() {
    // Create style tag for animations if not present
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
@keyframes hudPopIn {
  0%   { opacity: 0; transform: scale(0.6); }
  50%  { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }  /* <- keep opacity at 1 */
}

/* Upgrade tiles hover-grow — only when can buy */
.upgradeSlot{
  transition: transform 150ms cubic-bezier(.22,.61,.36,1);
  will-change: transform;
}
.upgradeSlot.upgrade-canBuy:hover{ transform: scale(1.06); }

/* Price label fades (border stays full-strength) */
.hudPriceLabel{
  display:inline-block;
  opacity: 1;
  transition: opacity 320ms cubic-bezier(.22,.61,.36,1); /* a hair smoother/slower */
}
.hudPriceLabel.dim   { opacity: .20; } /* darker than before */
.hudPriceLabel.mid   { opacity: .60; } /* queued: affordable but locked by L→R rule */

/* Upgrade reveal animation */
@keyframes upgradeReveal {
  0%   { transform: scale(0.9) rotate(0deg);   opacity: .6; }
  50%  { transform: scale(1.08) rotate(8deg);  opacity: 1; }
  100% { transform: scale(1) rotate(0deg);     opacity: 1; }
}
.hudUpgradeReveal { animation: upgradeReveal 0.8s cubic-bezier(.22,.61,.36,1) both; }

/* dim when unaffordable */
.hudSlotDisabled { opacity: .35; pointer-events: none; }

/* prevent text selection for entire HUD (and Hotbar mounted inside) */
#hudContainer, #hudContainer *{
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
  
.hudHotbarDock{
  display:flex;
  justify-content:center;
  align-items:center;
  gap:12px;
}

/* ===== Whole-text rollers (level + count) ===== */
.hudRoll{
  --step: 1em;                   /* will be set from JS to exact px */
  display:inline-block;
  vertical-align: baseline;      /* lines up with dash/∞ */
  height:var(--step);
  overflow:hidden;
}
.hudRoll .stack{
  display:block;
  transform: translateY(0);
}
.hudRoll.anim .stack{
  transition: transform 420ms cubic-bezier(.22,.61,.36,1); /* slower + smoother */
}
.hudRoll .row{
  height:var(--step);
  line-height:var(--step);
}

/* keep both rollers visually parallel */
.levelRoll, .countRoll { transform: translateY(1px); }
.levelRoll .row { text-align: right; }

/* NEW: every HUD block is hidden by default */
.hudItem { 
  opacity: 0; 
  transform: scale(0.6);
  will-change: transform, opacity;
}

/* When we add this class in show(), the item animates in and stays visible */
.hudFadeIn { animation: hudPopIn 0.85s ease-out forwards; }

/* keep the last frame so there’s no reset “snap” */
@keyframes spin360 {
  0%   { transform: rotate(0turn); }
  100% { transform: rotate(1turn); }   /* same look as 0, but we hold it */
}
  /* ====== ∞-mode glow for HUD/Hotbar ====== */
:root { --hud-glow: #ffffff; }

/* gentler base, peaks aligned with PlayArea glow (~2.1s cycle) */
@keyframes hudPulse {
  0%   { box-shadow: 0 0 6px var(--hud-glow), 0 0 16px var(--hud-glow), 0 0 32px rgba(255,255,255,0.08); }
  50%  { box-shadow: 0 0 10px var(--hud-glow), 0 0 24px var(--hud-glow), 0 0 48px rgba(255,255,255,0.14); }
  100% { box-shadow: 0 0 6px var(--hud-glow), 0 0 16px var(--hud-glow), 0 0 32px rgba(255,255,255,0.08); }
}

/* apply to the bordered HUD tiles (status block, hotbar slots, upgrade slots) */
.hudGlow {
  animation: hudPulse 2.1s cubic-bezier(.22,.61,.36,1) infinite; /* smoother + synced */
  border-color: var(--hud-glow) !important;
}

.hudInfinity {
  display:inline-block;
  /* use the same font stack as before (inherit from container: Audiowide) */
  font-size: 1.25em;
  line-height: 1;
  transform-origin: 50% 55%;
  position: relative;
  top: -2px;                 /* matches old baseline nudge */
  transform: rotate(0turn) translateZ(0);
  backface-visibility: hidden;
  will-change: transform;

  /* tiny horizontal cushion so spin never clips inside the roller */
  padding: 0 1px;
}
.hudInfinity.spin {
  animation: spin360 1.05s cubic-bezier(.22,.61,.36,1) both;
}
.hudInfinity.spin {
  animation: spin360 1.05s cubic-bezier(.22,.61,.36,1) both;
}
/* Infinity mode tiny vertical alignment nudges */
`;

    document.head.appendChild(styleTag);
    this.container = document.createElement('div');
    this._infinityEl = null; // <span class="hudInfinity">∞</span>
    this._countSpan = null; // <span>cycle number</span>
    // Rollers (level + count)
    this._isInfinity = false;

    this._levelWrap = null;
    this._levelStack = null;
    this._levelPrev = null;
    this._levelNext = null;
    this._lastLevelText = null;

    this._countWrap = null;
    this._countStack = null;
    this._countPrev = null;
    this._countNext = null;
    this._lastCountText = null;
    this.container.style.display = 'none';
    this.container.id = 'hudContainer';
    this.container.style.cssText = `
 position: fixed;
 left: 50%;
 bottom: 20px;
 transform: translateX(-50%);
 z-index: 11;
 display: flex;
 flex-direction: column;
 align-items: center;
 gap: 4px;
 font-family: Audiowide, system-ui, sans-serif;
 color: white;
 opacity: 0;
 pointer-events: none;
 transition: opacity 0.5s ease-in-out;
 width: 600px; /* Changed from 624px */
`;

    // Main top row (level info + power-up bar)
    const topRow = document.createElement('div');
    topRow.style.cssText = `
 display: flex;
 justify-content: center; /* Changed from flex-start */
 align-items: flex-start;
 width: 100%;
 gap: 12px;
`;

    // 📦 Level & Shape Counter Block
    this.statusBlock = document.createElement('div');
    this.statusBlock.style.cssText = `
  width: 192px;
  height: 90px; /* Match power slot height */
  background-color: transparent;
  border: 2px solid white;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 30px;
`;
    this.statusBlock.classList.add('hudItem');

    this.levelLabel = document.createElement('div');
    this.levelLabel.style.transition = 'transform 600ms cubic-bezier(.22,.61,.36,1)';
    this.levelLabel.style.willChange = 'transform';
    this.shapeCountLabel = document.createElement('div');
    this.statusBlock.appendChild(this.levelLabel);
    this.statusBlock.appendChild(this.shapeCountLabel);

    // 🔋 Power-up DOCK (Hotbar will mount here)
    this.powerupDock = document.createElement('div');
    this.powerupDock.className = 'hudHotbarDock';

    topRow.appendChild(this.statusBlock);
    topRow.appendChild(this.powerupDock);

    // 💠 Upgrades Row (3 perks for now)
    this.upgradeRow = document.createElement('div');
    this.upgradeRow.style.cssText = `
 display: flex;
 justify-content: center; /* Changed from flex-start */
 gap: 12px;
 width: 100%;
 margin-top: 8px;
`;

    this.upgradeSlots = [];
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.style.cssText = `
    width: 90px;
    height: 34px;
    background-color: transparent;
    border: 2px solid white;
    border-radius: 4px;
    font-size: 13px;
    text-align: center;
    line-height: 34px;
    user-select: none;
  `;
      // keep the pop-in animation behavior
      slot.classList.add('hudItem', 'upgradeSlot');
      slot.style.cursor = 'pointer';

      // label child = only this fades
      const label = document.createElement('span');
      label.className = 'hudPriceLabel dim'; // start dim
      label.textContent = 'Upgrade';
      slot.appendChild(label);

      // stash a reference for updates
      slot._priceLabel = label;

      // pointer-events off until enabled
      slot.style.pointerEvents = 'none';

      this.upgradeSlots.push(slot);
      this.upgradeRow.appendChild(slot);
    }

    // Add to container
    this.container.appendChild(topRow);
    this.container.appendChild(this.upgradeRow);
    document.body.appendChild(this.container);
  }

  _buildLabelMarkup() {
    this.levelLabel.textContent = '';

    // Left roller (level / ∞)
    this._levelWrap = document.createElement('span');
    this._levelWrap.className = 'hudRoll levelRoll';
    this._levelStack = document.createElement('div');
    this._levelStack.className = 'stack';
    this._levelPrev = document.createElement('div');
    this._levelPrev.className = 'row';
    this._levelNext = document.createElement('div');
    this._levelNext.className = 'row';
    this._levelStack.append(this._levelPrev, this._levelNext);
    this._levelWrap.appendChild(this._levelStack);
    this.levelLabel.appendChild(this._levelWrap);

    // Dash
    const dash = document.createElement('span');
    dash.className = 'hudDash';
    dash.textContent = ' - ';
    this.levelLabel.appendChild(dash);

    // Right roller (shape count)
    this._countWrap = document.createElement('span');
    this._countWrap.className = 'hudRoll countRoll';
    this._countStack = document.createElement('div');
    this._countStack.className = 'stack';
    this._countPrev = document.createElement('div');
    this._countPrev.className = 'row';
    this._countNext = document.createElement('div');
    this._countNext.className = 'row';
    this._countStack.append(this._countPrev, this._countNext);
    this._countWrap.appendChild(this._countStack);
    this.levelLabel.appendChild(this._countWrap);

    // ---- measurers (same font/context as the HUD) ----
    const probe = (html) => {
      const el = document.createElement('span');
      el.style.cssText =
        'position:absolute;visibility:hidden;left:-9999px;top:-9999px;font:inherit;';
      el.innerHTML = html;
      this.levelLabel.appendChild(el);
      const r = el.getBoundingClientRect();
      el.remove();
      return { w: Math.ceil(r.width || 0), h: Math.ceil(r.height || 0) };
    };

    // set a single row height with small headroom (old behavior)
    const lh = Math.max(
      probe('I').h,
      probe('II').h,
      probe('III').h,
      probe('<span class="hudInfinity">∞</span>').h
    );
    const rh = Math.max(probe('0').h, probe('8').h, probe('88').h, probe('888').h);
    const common = Math.max(rh, lh + 8); // +8px like before
    this._levelWrap.style.setProperty('--step', common + 'px');
    this._countWrap.style.setProperty('--step', common + 'px');

    // width: keep left roller wide enough for spinning ∞ (old look)
    const lw = Math.max(
      probe('I').w,
      probe('II').w,
      probe('III').w,
      probe('<span class="hudInfinity">∞</span>').w
    );
    this._levelWrap.style.minWidth = lw + 6 + 'px'; // +6px wiggle room for rotation
    this._levelMinWidthPx = lw + 6;

    // Re-measure once fonts finish loading (first load only)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        const lh2 = Math.max(
          probe('I').h,
          probe('II').h,
          probe('III').h,
          probe('<span class="hudInfinity">∞</span>').h
        );
        const rh2 = Math.max(probe('0').h, probe('8').h, probe('88').h, probe('888').h);
        const common2 = Math.max(rh2, lh2 + 8);
        this._levelWrap.style.setProperty('--step', common2 + 'px');
        this._countWrap.style.setProperty('--step', common2 + 'px');

        const lw2 = Math.max(
          probe('I').w,
          probe('II').w,
          probe('III').w,
          probe('<span class="hudInfinity">∞</span>').w
        );
        this._levelWrap.style.minWidth = lw2 + 6 + 'px';
        this._levelMinWidthPx = lw2 + 6;
        // recenter with the current (or default) text
        this._recenterStatus(this._lastLevelText || 'I');
      });
    }
  }

  _syncStepFromRow(wrap, rowEl) {
    if (!wrap || !rowEl) return;

    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;left:-9999px;top:-9999px;font:inherit;';

    // If the row contains the styled ∞ span, measure its HTML (not plain text)
    const hasInfinity = rowEl.querySelector && rowEl.querySelector('.hudInfinity');
    probe.innerHTML = hasInfinity ? rowEl.innerHTML : rowEl.textContent || '0';

    // Attach to the same DOM context so fonts/styles apply
    this.levelLabel.appendChild(probe);
    const measured = Math.ceil(probe.getBoundingClientRect().height || 0);
    probe.remove();

    // Never shrink the step; only increase if needed
    const current = parseFloat(getComputedStyle(wrap).getPropertyValue('--step')) || 0;
    const target = Math.max(current, measured);
    if (target > current) {
      wrap.style.setProperty('--step', target + 'px');
    }
  }

  _measureHeight(htmlOrText) {
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;left:-9999px;top:-9999px;font:inherit;';
    probe.innerHTML = htmlOrText || '0'; // allow HTML (for ∞ span)
    this.levelLabel.appendChild(probe);
    const h = Math.ceil(probe.getBoundingClientRect().height || 0);
    probe.remove();
    return h || 16;
  }

  // Set a single, stable --step from the tallest of the provided samples.
  // We will NEVER decrease it later (prevents up/down jumping).
  _setStableStep(wrap, samples) {
    if (!wrap) return;
    let max = 0;
    for (const s of samples) max = Math.max(max, this._measureHeight(s));
    const current = parseFloat(getComputedStyle(wrap).getPropertyValue('--step')) || 0;

    // base height
    let px = Math.max(current, Math.ceil(max));

    // 👇 give the LEFT roller a tiny extra headroom so ∞ never clips while spinning
    if (wrap.classList.contains('levelRoll')) px += 8;

    if (px > 0) wrap.style.setProperty('--step', px + 'px');
  }

  _measureRowHeightFromContent(htmlOrText) {
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;left:-9999px;top:-9999px;font:inherit;';
    // allow HTML (we use it for the ∞ span)
    probe.innerHTML = htmlOrText || '0';
    this.levelLabel.appendChild(probe);
    const h = Math.ceil(probe.getBoundingClientRect().height || 0);
    probe.remove();
    return h || 16;
  }
  _measureWidth(htmlOrText) {
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;left:-9999px;top:-9999px;font:inherit;';
    probe.innerHTML = htmlOrText || 'I';
    this.levelLabel.appendChild(probe);
    const w = Math.ceil(probe.getBoundingClientRect().width || 0);
    probe.remove();
    return w || 0;
  }

  /** Center the visible text by shifting the whole label by half the left slack. */
  _recenterStatus(leftHtml) {
    if (!this._levelWrap || !this.levelLabel) return;
    const minW = this._levelMinWidthPx || parseFloat(this._levelWrap.style.minWidth) || 0;

    // If the string contains the ∞ with an ID, remove the id for measuring
    const safeHtml = String(leftHtml || '').replace(/id="hudInfinity"/g, '');

    const contentW = this._measureWidth(safeHtml || 'I');
    const slack = Math.max(0, minW - contentW);

    // shift the whole cluster left by half the slack so the *visible* text is centered
    this.levelLabel.style.transform = `translateX(${-slack / 2}px)`;
    this.levelLabel.style.willChange = 'transform';
  }

  // Generic roller update (no per-digit; slides whole text)
  _updateRoll(wrap, stack, prev, next, nextText, lastKey, useHTML = false, isLeft = false) {
    if (!wrap || !stack || !prev || !next) return;
    const set = (el, s) => {
      useHTML ? (el.innerHTML = s) : (el.textContent = s);
    };

    const text = String(nextText ?? '');
    // First render: set and measure, no animation
    if (this[lastKey] == null) {
      set(prev, text);
      next.textContent = '';
      this[lastKey] = text;
      this._syncStepFromRow(wrap, prev);

      // Compute using the LEFT text (if this is the right roller, use last left or 'I')
      const leftHtml = isLeft ? text : this._lastLevelText ?? 'I';
      this._recenterStatus(leftHtml); // first call snaps; later calls will animate
      return;
    }
    if (text === this[lastKey]) return; // no change
    if (wrap.classList.contains('anim')) return; // ignore while animating

    set(next, text);
    {
      const leftHtmlNow = isLeft ? text : this._lastLevelText ?? 'I';
      this._recenterStatus(leftHtmlNow);
    }
    wrap.classList.add('anim');
    stack.style.transform = 'translateY(0)';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stack.style.transform = 'translateY(calc(-1 * var(--step)))';
      });
    });

    const end = () => {
      wrap.classList.remove('anim');
      stack.style.transition = 'none';
      set(prev, text);
      next.textContent = '';
      stack.style.transform = 'translateY(0)';
      void stack.offsetWidth;
      stack.style.transition = '';
      this[lastKey] = text;

      // Land on the final center using the current LEFT value
      const leftHtmlFinal = this._lastLevelText ?? 'I';
      this._recenterStatus(leftHtmlFinal);

      stack.removeEventListener('transitionend', end);
    };
    stack.addEventListener('transitionend', end, { once: true });
  }

  update(levelLabel, shapeCount) {
    const romanMap = {
      1: 'I',
      2: 'II',
      3: 'III',
      4: 'IV',
      5: 'V',
      6: 'VI',
      7: 'VII',
      8: 'VIII',
      9: 'IX',
      10: 'X',
    };
    const isInfinity = levelLabel === '∞';
    const leftText =
      typeof levelLabel === 'number' ? romanMap[levelLabel] || levelLabel : levelLabel;

    // Build once
    if (!this._levelWrap || !this._countWrap) {
      this._buildLabelMarkup();
      this._lastLevelText = null;
      this._lastCountText = null;
    }

    // Toggle mode class for tiny alignment nudges
    this.levelLabel.classList.toggle('isInfinity', isInfinity);

    // Render function for the left side: wrap ∞ so spin works
    const renderLeft = (val) => {
      if (val === '∞') return '<span id="hudInfinity" class="hudInfinity">∞</span>';
      return String(val);
    };

    // Left roller: always roll (I/II/III ↔ ∞)
    this._updateRoll(
      this._levelWrap,
      this._levelStack,
      this._levelPrev,
      this._levelNext,
      isInfinity ? renderLeft('∞') : renderLeft(leftText),
      '_lastLevelText',
      true, // use HTML so ∞ is a span
      true // ← this is the LEFT roller
    );

    // Right roller: shape counter (whole number)
    const countVal = Math.max(0, Math.floor(Number.isFinite(shapeCount) ? shapeCount : 0));
    this._updateRoll(
      this._countWrap,
      this._countStack,
      this._countPrev,
      this._countNext,
      String(countVal),
      '_lastCountText'
    );

    // Re-apply any pending spin (after we’ve ensured #hudInfinity exists)
    if (isInfinity && this._pendingInfinitySpin) {
      const el = this.levelLabel.querySelector('#hudInfinity');
      if (el) {
        el.classList.remove('spin');
        void el.offsetWidth;
        el.classList.add('spin');
      }
      this._pendingInfinitySpin = false;
    }

    // Unused second line
    this.shapeCountLabel.innerText = '';
  }

  clear() {
    this.levelLabel.innerText = '';
    this.shapeCountLabel.innerText = '';
  }

  resetAnimations() {
    const hotbarSlots = Array.from(this.powerupDock.querySelectorAll('.hbSlot'));
    const blocks = [this.statusBlock, ...hotbarSlots, ...this.upgradeSlots];

    // keep existing pop-in behavior
    blocks.forEach((el) => {
      el.classList.remove('hudFadeIn');
      el.style.animationDelay = '0s';
      el.classList.add('hudItem'); // hidden until show()
      el.style.opacity = '0';
      el.style.transform = 'scale(0.6)';
    });

    // 🔧 HARD-RESET the two text rollers so they never get stuck after a restart
    const clearRoll = (wrap, stack, prev, next) => {
      if (!wrap || !stack) return;
      wrap.classList.remove('anim'); // allow future updates
      stack.style.transition = 'none';
      stack.style.transform = 'translateY(0)';

      // clear stale row content; first update() will re-seed cleanly
      if (prev) prev.textContent = '';
      if (next) next.textContent = '';

      // re-enable transitions after a reflow
      void stack.offsetWidth;
      stack.style.transition = '';
    };

    clearRoll(this._levelWrap, this._levelStack, this._levelPrev, this._levelNext);
    clearRoll(this._countWrap, this._countStack, this._countPrev, this._countNext);

    // forget last values so update() treats next render as first paint
    this._lastLevelText = null;
    this._lastCountText = null;

    // ensure the ∞ spin class isn’t lingering between runs
    const inf = this.container.querySelector('#hudInfinity');
    if (inf) inf.classList.remove('spin');
  }

  updatePosition() {
    this.container.style.left = '50%';
    this.container.style.bottom = '20px'; // Fixed from bottom
    this.container.style.top = 'unset'; // Clear top position
    this.container.style.transform = 'translateX(-50%)';
  }

  show() {
    this.container.style.display = 'flex';
    this.container.style.opacity = '1';
    this.container.style.pointerEvents = 'auto';

    this.resetAnimations();
    const hotbarSlots = Array.from(this.powerupDock.querySelectorAll('.hbSlot'));
    const blocks = [this.statusBlock, ...hotbarSlots, ...this.upgradeSlots];

    requestAnimationFrame(() => {
      blocks.forEach((el, index) => {
        el.classList.add('hudFadeIn');
        el.style.animationDelay = `${index * 0.1}s`;

        // After the pop-in finishes, clear animation so .hudSlotDisabled can set opacity
        el.addEventListener(
          'animationend',
          () => {
            el.classList.remove('hudFadeIn');
            el.classList.remove('hudItem'); // not "hidden" anymore
            el.style.opacity = '';
            el.style.transform = '';
            el.style.animationDelay = '';
          },
          { once: true }
        );
      });
    });
  }

  mountHotbar(el) {
    if (!el) return;
    this.powerupDock.replaceChildren();
    this.powerupDock.appendChild(el);

    // Mark each hotbar slot as a HUD item (so they pop in individually)
    const slots = el.querySelectorAll('.hbSlot');
    slots.forEach((s) => {
      s.classList.add('hudItem'); // base hidden state
      s.style.opacity = '0';
      s.style.transform = 'scale(0.6)';
    });
  }

  unmountHotbar() {
    this.powerupDock?.replaceChildren();
  }
  setHotbarVisible(vis) {
    if (this.powerupDock) this.powerupDock.style.display = vis ? '' : 'none';
  }

  hide() {
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';

    setTimeout(() => {
      this.container.style.display = 'none';
    }, 500); // Match fade-in duration
  }

  spinInfinity() {
    // spin now (if the element exists) AND mark for re-spin after next update()
    this._pendingInfinitySpin = true;
    const el = this.container.querySelector('#hudInfinity');
    if (el) {
      el.classList.remove('spin');
      void el.offsetWidth;
      el.classList.add('spin');
    }
  }

  // formats 1_000 -> "1k", 1_000_000 -> "1m"
  _fmtShort(n) {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(0) + 'b';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'm';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(n);
  }

  // Show prices on the six upgrade tiles
  setUpgradePrices(prices = []) {
    this._upgradePrices = prices.slice(0, this.upgradeSlots.length);
    this.upgradeSlots.forEach((slot, i) => {
      const p = this._upgradePrices[i] ?? 0;
      const label = slot._priceLabel || slot; // fallback if needed
      label.textContent = this._fmtShort(p);
    });
  }

  resetUpgradeTiles() {
    this.upgradeSlots.forEach((slot, i) => {
      const label = slot._priceLabel || slot;
      const p = this._upgradePrices?.[i] ?? 0;
      label.textContent = this._fmtShort(p);
      label.classList.add('dim'); // text dim
      slot.style.pointerEvents = 'none'; // locked until enabled
    });
  }

  setUpgradeState(i, state) {
    // 'enabled' | 'queued' | 'locked' | 'purchased'
    const slot = this.upgradeSlots[i];
    if (!slot) return;
    const label = slot._priceLabel || slot;

    // clear previous label states
    label.classList.remove('dim', 'mid');
    slot.classList.remove('upgrade-canBuy');

    if (state === 'enabled') {
      // can buy now
      slot.style.pointerEvents = '';
      slot.classList.add('upgrade-canBuy'); // allow hover-grow
      // label stays full opacity
    } else if (state === 'queued') {
      // affordable but blocked by left->right rule
      slot.style.pointerEvents = 'none';
      label.classList.add('mid');
    } else {
      // 'locked' or anything else
      slot.style.pointerEvents = 'none';
      label.classList.add('dim');
    }
  }

  // Enable/disable a tile based on affordability
  setUpgradeAffordable(i, canBuy) {
    const slot = this.upgradeSlots[i];
    if (!slot) return;
    const label = slot._priceLabel || slot;
    label.classList.toggle('dim', !canBuy); // smooth fade on the label
    slot.style.pointerEvents = canBuy ? '' : 'none';
  }

  // Wire clicks on the six tiles back to main.js
  setUpgradeHandler(fn) {
    this._onUpgradeClick = fn;
    this.upgradeSlots.forEach((slot, i) => {
      slot.onclick = () => this._onUpgradeClick?.(i);
    });
  }

  // Run the reveal animation and switch tile content to the new icon/level
  revealUpgrade(i, { icon }) {
    const slot = this.upgradeSlots[i];
    if (!slot) return;
    const label = slot._priceLabel || slot;

    label.classList.remove('dim', 'mid');
    slot.classList.remove('upgrade-canBuy'); // purchased → no hover-grow
    slot.classList.add('hudUpgradeReveal');
    label.textContent = icon || '⬆️';
    slot.style.pointerEvents = 'none';

    setTimeout(() => slot.classList.remove('hudUpgradeReveal'), 850);
  }

  setFontStyle(name = 'default') {
    const family = HUD_FONT_PRESETS[name] || HUD_FONT_PRESETS.default;
    this.container.style.fontFamily = family;
  }

  // Choose every bordered tile we want to glow
  _getGlowTargets() {
    const hotbarSlots = Array.from(this.powerupDock?.querySelectorAll('.hbSlot') || []);
    return [this.statusBlock, ...hotbarSlots, ...this.upgradeSlots].filter(Boolean);
  }

  /** Turn the ∞-mode glow on/off and set its color */
  setPulse(active, color = '#FFFFFF') {
    // color into a CSS var on the container (cascades to children)
    this.container.style.setProperty('--hud-glow', color);
    const targets = this._getGlowTargets();
    targets.forEach((el) => el.classList.toggle('hudGlow', !!active));
  }
}
