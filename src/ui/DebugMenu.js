// src/ui/DebugMenu.js
// Dev-only panel. No game logic; emits callbacks supplied by main.js.
import ProfileStore from '../libs/ProfileStore.js';
import * as Bank from '../libs/Bank.js';
import SkinManager from '../libs/SkinManager.js';
export default class DebugMenu {
  constructor(opts = {}) {
    this.getFPS = opts.getFPS || (() => 0);
    this.getShowFPSOverlay = opts.getShowFPSOverlay || (() => false);
    this.setShowFPSOverlay = opts.setShowFPSOverlay || ((b) => {});
    // references (read-only)
    this.bus = opts.bus;
    this.shapeManager = opts.shapeManager;
    this.miniGameManager = opts.miniGameManager;
    this.hud = opts.hud;

    // profile economy hooks
    this.getProfile = opts.getProfile || (() => ({}));
    this.addCoins = opts.addCoins || ((_) => {});
    this.addGems = opts.addGems || ((_) => {});
    this.addXp = opts.addXp || ((_) => {});
    this.setCoins = opts.setCoins || ((_) => {});
    this.setGems = opts.setGems || ((_) => {});
    this.setXp = opts.setXp || ((_) => {});
    this.resetProfile = opts.resetProfile || ((_) => {});

    // callbacks supplied by main.js (safe bridges)
    this.getMode = opts.getMode || (() => 'rotation');
    this.setMode = opts.setMode || (() => {});
    this.getLevel = opts.getLevel || (() => 1);
    this.setLevel = opts.setLevel || (() => {});
    this.getShape = opts.getShape || (() => 'Square');
    this.setIsolationShape = opts.setIsolationShape || (() => {});
    this.setRotationCurrentShape = opts.setRotationCurrentShape || (() => {});
    this.forceComplete = opts.forceComplete || (() => {});
    this.resetPB = opts.resetPB || (() => {});
    this.getSpeed = opts.getSpeed || (() => 1);
    this.setSpeed = opts.setSpeed || ((v) => {});
    this.getRunSeconds = opts.getRunSeconds || (() => 0);
    this.addScore = opts.addScore || ((amt) => {});
    this.getAvailableUpgrades = opts.getAvailableUpgrades || (() => []);
    this.grantUpgradeById = opts.grantUpgradeById || ((id) => ({ ok: false }));
    this.grantPowerUpById = opts.grantPowerUpById || ((id) => ({ ok: false }));
    this.getPowerUpIds = opts.getPowerUpIds || (() => []);

    // DOM refs
    this.root = null;
    this.toggleBtn = null;

    // small UI refs for fast updates
    this.$shapeName = null;
    this.$levelNum = null;
    this.$timeLeft = null;
    this.$next = null;
    this.$pickSet = null;
    this.$modeSel = null;
    this.$shapeSel = null;
    this.$levelSel = null;

    this.getRunCompleted = opts.getRunCompleted || (() => 0);

    this.getPerf =
      opts.getPerf || (() => ({ fps: 0, spikes3s: 0, longTasks: 0, buckets: {}, memoryMB: null }));
    this.getEventTail = opts.getEventTail || (() => []);
    this.clearEventTail = opts.clearEventTail || (() => {});
    this.runVerifiers = opts.runVerifiers || (async () => ({}));

    this.getPerfCsvStatus =
      opts.getPerfCsvStatus ||
      (() => ({ enabled: false, capturing: false, ready: false, frames: 0, events: 0, runId: 0 }));
    this.setPerfCsvEnabled = opts.setPerfCsvEnabled || ((_) => {});
    this.buildPerfCSV = opts.buildPerfCSV || (() => null);
    this.buildPerfSummary = opts.buildPerfSummary || (() => null);
    this.forceRotationGo = opts.forceRotationGo || ((_) => {});
    this.forceMiniGameGo = opts.forceMiniGameGo || ((_) => {});
    this.getMiniGameIds = opts.getMiniGameIds || (() => []);
    this.exportAnalytics = opts.exportAnalytics || (() => {});
    this._keyHandler = null;
    this._screenObs = null;
    this.isOpen = false;

    // aliases so old main.js hooks still work if not yet renamed
    this.addCopper = opts.addCopper || this.addCoins;
    this.setCopper = opts.setCopper || this.setCoins;
    this.addIridium = opts.addIridium || this.addGems;
    this.setIridium = opts.setIridium || this.setGems;
  }

  mount() {
    this.unmount();

    // ---------- container ----------
    const div = document.createElement('div');
    div.id = 'debugMenu';
    div.style.cssText = `
      position: fixed; right: 20px; top: 68px;
      background: rgba(18,18,18,0.85); color:#fff;
      border:1.5px solid #444; border-radius:9px;
      padding:14px; width:420px; max-height:70vh;
      overflow:auto; font: 13px/1.4 'Segoe UI', Arial, sans-serif;
      z-index:1000; display:none; box-shadow:0 2px 8px #000a;
      pointer-events:auto;
    `;
    // tiny 'i' with hotkey summary (hover)
    const hk = document.createElement('div');
    hk.textContent = 'i';
    hk.title = [
      'Hotkeys:',
      'W – Toggle Debug Menu',
      'Space – Force Complete',
      'S – +150,000,000 score',
      'A – Give random power-up',
      'D – Give random upgrade',
    ].join('\n');
    hk.style.cssText = `
      position:absolute; top:8px; right:70px;
      width:18px; height:18px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      background:#222; color:#fff; font-weight:700; font-size:12px;
      border:1px solid #444; cursor:default; opacity:.85;
    `;
    div.appendChild(hk);
    // hide / show
    const hideBtn = document.createElement('button');
    hideBtn.textContent = 'Hide';
    hideBtn.style.cssText =
      'position:absolute; top:6px; right:6px; font-size:12px; padding:2px 8px;';
    hideBtn.addEventListener('click', () => this.toggle());
    div.appendChild(hideBtn);

    // Full-screen toggle
    const fullBtn = document.createElement('button');
    fullBtn.textContent = 'Full';
    fullBtn.title = 'Toggle full-screen width';
    fullBtn.style.cssText =
      'position:absolute; top:6px; right:62px; font-size:12px; padding:2px 8px;';
    fullBtn.addEventListener('click', () => {
      div.classList.toggle('dm-full');
      fullBtn.textContent = div.classList.contains('dm-full') ? 'Compact' : 'Full';
    });
    div.appendChild(fullBtn);

    // reset PB
    const pb = document.createElement('button');
    pb.textContent = 'Reset Personal Best';
    pb.style.cssText = 'font-size:12px; padding:4px 8px; margin-top:6px; margin-bottom:10px;';
    pb.addEventListener('click', () => this.resetPB());
    div.appendChild(pb);
    // Global FPS toggle (always visible)
    const fpsBar = document.createElement('div');
    fpsBar.dataset.global = '1';
    fpsBar.style.cssText = 'margin:6px 0 10px 0;';
    fpsBar.innerHTML = `
  <label style="display:inline-flex; align-items:center; gap:6px;">
    <input type="checkbox" id="dbgFpsTog2"> Show FPS overlay
  </label>
`;
    div.appendChild(fpsBar);
    this.$fpsTog2 = fpsBar.querySelector('#dbgFpsTog2');
    this.$fpsTog2.checked = !!this.getShowFPSOverlay();
    this.$fpsTog2.addEventListener('change', () => {
      this.setShowFPSOverlay(!!this.$fpsTog2.checked);
    });

    // ===== INFO SECTION =====================================================
    const infoCard = document.createElement('div');
    infoCard.dataset.runtime = '1';
    infoCard.style.cssText =
      'margin:0 0 10px 0; border-bottom:1px solid #333; padding-bottom:10px;';
    infoCard.innerHTML = `
      <div style="font-weight:600; opacity:.9; margin-bottom:6px;">Info</div>
      <div><b>Current Shape:</b> <span id="dbgShapeName">None</span></div>
      <div><b>Behavior:</b> <span id="dbgBehavior">—</span></div>
      <div><b>Current Level:</b> <span id="dbgLevelNum">1</span></div>
      <div><b>Time Left:</b> <span id="dbgTimeLeft">0.00</span>s</div>
      <div><b>Completed (run):</b> <span id="dbgCompleted">0</span></div>
      <div><b>Current Mini-game:</b> <span id="dbgMini">None</span></div>
      <div><b>Run Time:</b> <span id="dbgRunTime">0:00</span></div>
      <div><b>FPS:</b> <span id="dbgFPS">0</span></div>
      <div style="margin-top:4px;">
        <span><b>Spikes/3s:</b> <span id="dbgSpikes">0</span></span>
        &nbsp;•&nbsp; <span><b>LongTasks:</b> <span id="dbgLT">0</span></span>
        &nbsp;•&nbsp; <span><b>Memory:</b> <span id="dbgMem">–</span></span>
      </div>
      <div style="margin-top:4px;">
        <b>Buckets (ms avg):</b>
        <span id="dbgBktUpdate">upd 0.0</span>,
        <span id="dbgBktPA">play 0.0</span>,
        <span id="dbgBktFX">fx 0.0</span>,
        <span id="dbgBktHUD">hud 0.0</span>
      </div>
      <label style="display:inline-flex; align-items:center; gap:6px; margin-top:6px;">
        <input type="checkbox" id="dbgFpsTog"> Show FPS overlay
      </label>
      <div><b>Next:</b> <span id="dbgNext">?</span></div>
    `;
    div.appendChild(infoCard);
    this.$shapeName = infoCard.querySelector('#dbgShapeName');
    this.$levelNum = infoCard.querySelector('#dbgLevelNum');
    this.$timeLeft = infoCard.querySelector('#dbgTimeLeft');
    this.$next = infoCard.querySelector('#dbgNext');
    this.$completed = infoCard.querySelector('#dbgCompleted');
    this.$behavior = infoCard.querySelector('#dbgBehavior');
    this.$mini = infoCard.querySelector('#dbgMini');
    this.$runTime = infoCard.querySelector('#dbgRunTime');
    this.$fps = infoCard.querySelector('#dbgFPS');
    this.$spk = infoCard.querySelector('#dbgSpikes');
    this.$lt = infoCard.querySelector('#dbgLT');
    this.$mem = infoCard.querySelector('#dbgMem');
    this.$bUpd = infoCard.querySelector('#dbgBktUpdate');
    this.$bPA = infoCard.querySelector('#dbgBktPA');
    this.$bFX = infoCard.querySelector('#dbgBktFX');
    this.$bHUD = infoCard.querySelector('#dbgBktHUD');
    this.$fpsTog2 = null;
    this.$fpsTog = infoCard.querySelector('#dbgFpsTog');
    this.$fpsTog.checked = !!this.getShowFPSOverlay();
    this.$fpsTog.addEventListener('change', () => {
      this.setShowFPSOverlay(!!this.$fpsTog.checked);
    });

    // ===== CONTROLS SECTION ================================================
    const ctlCard = document.createElement('div');
    ctlCard.dataset.runtime = '1';
    ctlCard.style.cssText = 'margin:10px 0; border-bottom:1px solid #333; padding-bottom:10px;';
    ctlCard.innerHTML = `<div style="font-weight:600; opacity:.9; margin-bottom:6px;">Controls</div>`;
    div.appendChild(ctlCard);

    // -- Mode row
    const modeRow = document.createElement('div');
    modeRow.style.margin = '6px 0';
    const modeLabel = document.createElement('label');
    modeLabel.textContent = 'Mode: ';
    modeLabel.style.marginRight = '6px';
    this.$modeSel = document.createElement('select');
    this.$modeSel.innerHTML = `
      <option value="rotation">Rotation</option>
      <option value="isolation">Isolation</option>
    `;
    this.$modeSel.value = this.getMode();
    this.$modeSel.addEventListener('change', (e) => {
      this.setMode(e.target.value);
      this.update(); // reflect immediately
    });
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(this.$modeSel);
    ctlCard.appendChild(modeRow);

    // -- Force shape + level row
    const selects = document.createElement('div');
    selects.style.cssText = 'display:flex; gap:6px; align-items:center;';
    const slabel = document.createElement('label');
    slabel.textContent = 'Force Shape: ';
    slabel.style.marginRight = '6px';
    selects.appendChild(slabel);

    this.$shapeSel = document.createElement('select');
    (this.shapeManager?.getShapeNames?.() || []).forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      this.$shapeSel.appendChild(opt);
    });
    this.$shapeSel.value = this.shapeManager?.getCurrentShapeName?.() || this.getShape();
    this.$shapeSel.addEventListener('change', (e) => {
      const name = e.target.value;
      // Isolation can update instantly; Rotation is gated by GO
      if (this.getMode() === 'isolation') {
        this.setIsolationShape(name);
        this.update();
      }
    });
    selects.appendChild(this.$shapeSel);

    // Force GO button (uses both selectors)
    const goBtn = document.createElement('button');
    goBtn.textContent = 'GO';
    goBtn.title = 'Force jump to selected Shape at selected Level';
    goBtn.style.cssText = 'font-size:12px; padding:4px 8px;';
    goBtn.addEventListener('click', () => {
      if (this.getMode() !== 'isolation') return; // isolation-only
      const lvl = parseInt(this.$levelSel.value, 10) || 1;
      const shapeName = this.$shapeSel.value;
      this.setLevel(lvl);
      this.setIsolationShape(shapeName);
      this.update();
    });
    selects.appendChild(goBtn);
    this.$goBtn = goBtn;
    this.$levelSel = document.createElement('select');
    this.$levelSel.innerHTML = `
      <option value="1">Level 1</option>
      <option value="2">Level 2</option>
      <option value="3">Level 3</option>
      <option value="4">Level ∞</option>
    `;
    this.$levelSel.value = String(this.getLevel());
    this.$levelSel.addEventListener('change', (e) => {
      // Isolation: instant is fine
      if (this.getMode() === 'isolation') {
        this.setLevel(parseInt(e.target.value, 10));
      }
      // Rotation: wait for GO so we can pair level + shape
      this.update();
    });
    selects.appendChild(this.$levelSel);
    ctlCard.appendChild(selects);

    // -- Speed row
    const speedRow = document.createElement('div');
    speedRow.style.cssText = 'margin:6px 0; display:flex; align-items:center; gap:6px;';
    const speedLabel = document.createElement('label');
    speedLabel.textContent = 'Speed:';
    const speedSel = document.createElement('select');
    [
      ['0.50x', '0.5'],
      ['0.75x', '0.75'],
      ['1.00x', '1'],
      ['1.25x', '1.25'],
      ['1.50x', '1.5'],
      ['2.00x', '2'],
    ].forEach(([t, v]) => {
      const o = document.createElement('option');
      o.textContent = t;
      o.value = v;
      speedSel.appendChild(o);
    });
    speedSel.value = String(this.getSpeed());
    speedSel.addEventListener('change', (e) => this.setSpeed(parseFloat(e.target.value) || 1));
    speedRow.appendChild(speedLabel);
    speedRow.appendChild(speedSel);
    ctlCard.appendChild(speedRow);
    this.$speedSel = speedSel;

    // -- Force Mini-game row
    const miniRow = document.createElement('div');
    miniRow.style.cssText = 'display:flex; gap:6px; align-items:center; margin-top:8px;';
    const mlabel = document.createElement('label');
    mlabel.textContent = 'Force Mini-game:';
    mlabel.style.marginRight = '6px';
    miniRow.appendChild(mlabel);

    // mini-game select
    const miniSel = document.createElement('select');
    (this.getMiniGameIds() || []).forEach((id) => {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = id;
      miniSel.appendChild(o);
    });
    miniRow.appendChild(miniSel);

    // level select for target level (what you want to land on after the mini)
    const miniLvl = document.createElement('select');
    miniLvl.innerHTML = `
  <option value="1">Level 1</option>
  <option value="2">Level 2</option>
  <option value="3">Level 3</option>
  <option value="4">Level ∞</option>
`;
    miniLvl.value = String(this.getLevel());
    miniRow.appendChild(miniLvl);

    // go button
    const miniGo = document.createElement('button');
    miniGo.textContent = 'GO';
    miniGo.style.cssText = 'font-size:12px; padding:4px 8px;';
    miniGo.addEventListener('click', () => {
      if (this.getMode() !== 'isolation') return; // isolation-only
      const lvl = parseInt(miniLvl.value, 10) || 1;
      const miniName = miniSel.value;
      this.forceMiniGameGo({ miniName, level: lvl });
      this.update();
    });
    miniRow.appendChild(miniGo);
    this.$miniGo = miniGo;
    ctlCard.appendChild(miniRow);
    this.$miniSel = miniSel;
    this.$miniLvlSel = miniLvl;

    // -- Force Complete button
    const fc = document.createElement('button');
    fc.textContent = 'Force Complete';
    fc.style.cssText = 'font-size:12px; padding:4px 8px; margin-top:6px;';
    fc.addEventListener('click', () => this.forceComplete());
    ctlCard.appendChild(fc);
    // ===== ECONOMY =========================================================
    const eco = document.createElement('div');
    eco.dataset.global = '1';
    eco.style.cssText = 'margin:10px 0; border-top:1px solid #333; padding-top:10px;';
    eco.innerHTML = `<div style="font-weight:600; opacity:.9; margin-bottom:6px;">Economy</div>`;
    div.appendChild(eco);

    // ===== PROFILE ECONOMY (coins/gems/xp) =================================
    const profWrap = document.createElement('div');
    profWrap.dataset.global = '1';
    profWrap.style.cssText = 'margin:10px 0; border-top:1px solid #333; padding-top:10px;';
    profWrap.innerHTML = `<div style="font-weight:600; opacity:.9; margin-bottom:6px;">Profile</div>`;
    eco.appendChild(profWrap);

    const profRow = (label, getVal, addFn, setFn, presets = []) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:6px; align-items:center; margin:6px 0;';
      const span = document.createElement('span');
      span.style.minWidth = '64px';
      span.textContent = label + ':';
      const val = document.createElement('span');
      val.style.cssText = 'opacity:.9;';
      const refresh = () => {
        try {
          const p = this.getProfile() || {};
          const current =
            {
              Copper: p.copper ?? p.coins ?? 0,
              Iridium: p.iridium ?? p.gems ?? 0,
              XP: p.xp ?? 0,
            }[label] ?? 0;
          val.textContent = current;
        } catch {
          val.textContent = '?';
        }
      };
      refresh();

      const addBtns = presets.map(([t, n]) => {
        const b = document.createElement('button');
        b.textContent = t;
        b.style.cssText = 'font-size:12px; padding:3px 8px;';
        b.addEventListener('click', () => {
          addFn(n);
          refresh();
        });
        return b;
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'set value';
      input.style.cssText =
        'width:110px; padding:3px 6px; background:#111; color:#fff; border:1px solid #333; border-radius:4px;';
      const setBtn = document.createElement('button');
      setBtn.textContent = 'Set';
      setBtn.style.cssText = 'font-size:12px; padding:3px 8px;';
      setBtn.addEventListener('click', () => {
        const raw = (input.value || '').replace(/[,_\s]/g, '').replace(/[^\d.-]/g, '');
        const v = Number(raw || '0');
        if (Number.isFinite(v)) {
          setFn(v);
          refresh();
        }
      });

      row.appendChild(span);
      row.appendChild(val);
      addBtns.forEach((b) => row.appendChild(b));
      row.appendChild(input);
      row.appendChild(setBtn);
      return { row, refresh };
    };

    const copper = profRow(
      'Copper',
      () => this.getProfile().copper ?? this.getProfile().coins,
      (n) => (this.addCopper ? this.addCopper(n) : this.addCoins?.(n)),
      (n) => (this.setCopper ? this.setCopper(n) : this.setCoins?.(n)),
      [
        ['+1k', 1000],
        ['+10k', 10000],
        ['+100k', 100000],
      ]
    );

    const iridium = profRow(
      'Iridium',
      () => this.getProfile().iridium ?? this.getProfile().gems,
      (n) => (this.addIridium ? this.addIridium(n) : this.addGems?.(n)),
      (n) => (this.setIridium ? this.setIridium(n) : this.setGems?.(n)),
      [
        ['+10', 10],
        ['+50', 50],
        ['+250', 250],
      ]
    );

    const xp = profRow(
      'XP',
      () => this.getProfile().xp,
      (n) => this.addXp(n),
      (n) => this.setXp(n),
      [
        ['+100', 100],
        ['+1k', 1000],
        ['+10k', 10000],
      ]
    );

    profWrap.appendChild(copper.row);
    profWrap.appendChild(iridium.row);
    profWrap.appendChild(xp.row);

    // keep numbers live whenever the profile changes
    window.addEventListener('profile:updated', () => {
      try {
        copper.refresh();
        iridium.refresh();
        xp.refresh();
      } catch {}
    });
    window.addEventListener('profile:reset', () => {
      try {
        copper.refresh();
        iridium.refresh();
        xp.refresh();
      } catch {}
    });

    const resetAll = document.createElement('button');
    resetAll.textContent = 'Reset Profile (wipe saves)';
    resetAll.style.cssText =
      'font-size:12px; padding:6px 10px; margin-top:8px; background:#4c0000; border:1px solid #700; color:#fff; border-radius:6px;';
    resetAll.addEventListener('click', () => {
      if (confirm('Reset profile? This wipes copper, iridium, XP, stats, and settings.')) {
        this.resetProfile(true);
        copper.refresh();
        iridium.refresh();
        xp.refresh();
      }
    });
    profWrap.appendChild(resetAll);

    // ===== UNLOCKS (dev) ================================================
    const unlWrap = document.createElement('details');
    unlWrap.dataset.global = '1';
    unlWrap.style.cssText = 'margin:10px 0;';
    unlWrap.open = false;
    unlWrap.innerHTML = `<summary style="cursor:pointer">Unlocks (dev)</summary>`;

    const unl = document.createElement('div');
    unl.style.cssText = 'margin-top:10px; display:grid; gap:10px;';

    /* helper: section title */
    const title = (t) => {
      const h = document.createElement('div');
      h.textContent = t;
      h.style.cssText = 'font-weight:700; opacity:.92; margin:2px 0 4px;';
      return h;
    };
    /* helper: make a row */
    const row = () => {
      const d = document.createElement('div');
      d.style.cssText = 'display:flex; gap:6px; align-items:center;';
      return d;
    };

    /* ── Shapes ─────────────────────────────────────────────────────── */
    unl.appendChild(title('Shapes'));

    // individual
    const rShape = row();
    const selShape = document.createElement('select');
    (this.shapeManager?.getShapeNames?.() || []).forEach((nm) => {
      const o = document.createElement('option');
      o.value = nm;
      o.textContent = nm;
      selShape.appendChild(o);
    });
    const btnGrantShape = document.createElement('button');
    btnGrantShape.textContent = 'Grant Shape';
    btnGrantShape.style.cssText = 'font-size:12px; padding:4px 8px;';
    btnGrantShape.addEventListener('click', () => {
      const id = selShape.value;
      if (id) ProfileStore.unlockShape(id);
    });
    rShape.appendChild(document.createTextNode('Shape:'));
    rShape.appendChild(selShape);
    rShape.appendChild(btnGrantShape);
    unl.appendChild(rShape);

    // all
    const btnAllShapes = document.createElement('button');
    btnAllShapes.textContent = 'Grant ALL Shapes';
    btnAllShapes.style.cssText = 'font-size:12px; padding:4px 8px;';
    btnAllShapes.addEventListener('click', () => ProfileStore.unlockAll('shapes'));
    unl.appendChild(btnAllShapes);

    /* ── Badges ─────────────────────────────────────────────────────── */
    unl.appendChild(title('Badges'));

    const badgeCat =
      (window.__mastery && window.__mastery.getCatalog && window.__mastery.getCatalog()) || [];

    const rBadge = row();
    const selBadge = document.createElement('select');
    if (badgeCat.length) {
      badgeCat.forEach((b) => {
        const o = document.createElement('option');
        o.value = b.id;
        o.textContent = b.title || b.name || b.id;
        selBadge.appendChild(o);
      });
    } else {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = '(no catalog loaded)';
      selBadge.appendChild(o);
      selBadge.disabled = true;
    }
    const btnGrantBadge = document.createElement('button');
    btnGrantBadge.textContent = 'Grant Badge';
    btnGrantBadge.style.cssText = 'font-size:12px; padding:4px 8px;';
    btnGrantBadge.addEventListener('click', () => {
      const id = selBadge.value;
      if (!id) return;
      if (window.__mastery?.grantBadgeById) window.__mastery.grantBadgeById(id);
      else if (this.bus?.emit) this.bus.emit('mastery:grant', { id });
    });
    rBadge.appendChild(document.createTextNode('Badge:'));
    rBadge.appendChild(selBadge);
    rBadge.appendChild(btnGrantBadge);
    unl.appendChild(rBadge);

    // all
    const btnAllBadges = document.createElement('button');
    btnAllBadges.textContent = 'Grant ALL Badges';
    btnAllBadges.style.cssText = 'font-size:12px; padding:4px 8px;';
    btnAllBadges.addEventListener('click', () => {
      if (window.__mastery?.grantAllBadges) window.__mastery.grantAllBadges();
      else badgeCat.forEach((b) => this.bus?.emit?.('mastery:grant', { id: b.id }));
    });
    unl.appendChild(btnAllBadges);

    /* ── Skins ──────────────────────────────────────────────────────── */
    unl.appendChild(title('Skins'));

    // individual (freeform key for now; catalog will hook in later)
    const rSkin = row();
    const inputSkin = document.createElement('input');
    inputSkin.placeholder = 'Skin key (e.g., Neon)';
    inputSkin.style.cssText = 'flex:1; min-width:160px;';
    const btnGrantSkin = document.createElement('button');
    btnGrantSkin.textContent = 'Grant Skin';
    btnGrantSkin.style.cssText = 'font-size:12px; padding:4px 8px;';
    btnGrantSkin.addEventListener('click', () => {
      const id = (inputSkin.value || '').trim();
      if (id) ProfileStore.unlockSkin(id);
    });
    rSkin.appendChild(document.createTextNode('Skin:'));
    rSkin.appendChild(inputSkin);
    rSkin.appendChild(btnGrantSkin);
    unl.appendChild(rSkin);

    // all (no-op until we have a catalog; harmless)
    const btnAllSkins = document.createElement('button');
    btnAllSkins.textContent = 'Grant ALL Skins';
    btnAllSkins.style.cssText = 'font-size:12px; padding:4px 8px;';
    btnAllSkins.addEventListener('click', () => ProfileStore.unlockAll('skins'));
    unl.appendChild(btnAllSkins);

    /* ── Global ─────────────────────────────────────────────────────── */
    unl.appendChild(title('Global'));

    const btnGrantEverything = document.createElement('button');
    btnGrantEverything.textContent = 'Grant ALL (everything)';
    btnGrantEverything.style.cssText = 'font-size:12px; padding:6px 10px; background:#044;';
    btnGrantEverything.addEventListener('click', () => {
      ProfileStore.unlockAll('shapes');
      ProfileStore.unlockAll('skins');
      if (window.__mastery?.grantAllBadges) window.__mastery.grantAllBadges();
    });
    unl.appendChild(btnGrantEverything);

    const btnResetUnlocks = document.createElement('button');
    btnResetUnlocks.textContent = 'Reset Unlocks + Badges';
    btnResetUnlocks.style.cssText = 'font-size:12px; padding:6px 10px; background:#402;';
    btnResetUnlocks.addEventListener('click', () => {
      if (confirm('Reset all unlocks and badges?')) ProfileStore.resetUnlocks();
    });
    unl.appendChild(btnResetUnlocks);

    unlWrap.appendChild(unl);
    profWrap.appendChild(unlWrap);

    // -- Score (formatted with commas)
    const scoreRow = document.createElement('div');
    scoreRow.style.cssText = 'display:flex; gap:8px; align-items:center; margin:6px 0;';

    const add150 = document.createElement('button');
    add150.textContent = '+150M';
    add150.style.cssText = 'font-size:12px; padding:4px 8px;';
    add150.addEventListener('click', () => this.addScore(150_000_000));

    const addCustom = document.createElement('button');
    addCustom.textContent = '+ Custom';
    addCustom.style.cssText = 'font-size:12px; padding:4px 8px;';

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = 'amount (e.g., 150,000)';
    customInput.style.cssText =
      'width:140px; padding:3px 6px; background:#111; color:#fff; border:1px solid #333; border-radius:4px;';

    const fmt = new Intl.NumberFormat('en-US');
    const sanitize = (s) => (s || '').replace(/[,_\s]/g, '').replace(/[^\d.-]/g, '');

    // live-format with commas
    customInput.addEventListener('input', (e) => {
      const raw = sanitize(e.target.value);
      e.target.value = raw ? fmt.format(Number(raw)) : '';
    });
    customInput.addEventListener('blur', (e) => {
      const raw = sanitize(e.target.value);
      e.target.value = raw ? fmt.format(Number(raw)) : '';
    });

    addCustom.addEventListener('click', () => {
      const raw = sanitize(customInput.value);
      const v = Number(raw || '0');
      if (Number.isFinite(v) && v !== 0) this.addScore(v);
    });

    scoreRow.appendChild(document.createTextNode('Score:'));
    scoreRow.appendChild(add150);
    scoreRow.appendChild(customInput);
    scoreRow.appendChild(addCustom);
    eco.appendChild(scoreRow);

    // -- Upgrades (auto-grant on select; no dupes; respects free slots)
    const upgRow = document.createElement('div');
    upgRow.style.cssText = 'display:flex; gap:6px; align-items:center; margin:6px 0;';

    const upgSel = document.createElement('select');
    upgSel.style.cssText = 'min-width:220px;';

    const refreshUpgrades = () => {
      const list = this.getAvailableUpgrades();
      upgSel.innerHTML = '';
      if (!list || !list.length) {
        const o = document.createElement('option');
        o.textContent = 'No available upgrades';
        o.value = '';
        upgSel.appendChild(o);
        upgSel.disabled = true;
      } else {
        upgSel.disabled = false;
        const hint = document.createElement('option');
        hint.textContent = 'Choose upgrade…';
        hint.value = '';
        upgSel.appendChild(hint);
        list.forEach((u) => {
          const o = document.createElement('option');
          o.value = u.id;
          o.textContent = u.name || u.id;
          upgSel.appendChild(o);
        });
      }
    };

    // auto-grant when a choice is made
    upgSel.addEventListener('change', () => {
      const id = upgSel.value;
      if (!id) return;
      const r = this.grantUpgradeById(id);
      // after grant, rebuild list so the just-owned one disappears
      refreshUpgrades();
      // reset to the hint row
      upgSel.value = '';
    });

    upgRow.appendChild(document.createTextNode('Upgrade:'));
    upgRow.appendChild(upgSel);
    eco.appendChild(upgRow);

    // keep the dropdown in sync if you buy via HUD or earn in game
    this.bus?.on?.('upgrade:purchased', () => refreshUpgrades());

    // initial fill
    refreshUpgrades();

    // -- Power-ups (auto-grant on select; needs an empty slot)
    // Note: duplicates are allowed; manager only requires a free slot
    const puRow = document.createElement('div');
    puRow.style.cssText = 'display:flex; gap:6px; align-items:center; margin:6px 0;';

    const puSel = document.createElement('select');
    puSel.style.cssText = 'min-width:220px;';

    const refreshPUs = () => {
      const ids = this.getPowerUpIds() || [];
      puSel.innerHTML = '';
      if (!ids.length) {
        const o = document.createElement('option');
        o.value = '';
        o.textContent = 'No power-ups available';
        puSel.appendChild(o);
        puSel.disabled = true;
      } else {
        puSel.disabled = false;
        const hint = document.createElement('option');
        hint.textContent = 'Choose power-up…';
        hint.value = '';
        puSel.appendChild(hint);
        ids.forEach((id) => {
          const o = document.createElement('option');
          o.value = id;
          o.textContent = id;
          puSel.appendChild(o);
        });
      }
    };

    puSel.addEventListener('change', () => {
      const id = puSel.value;
      if (!id) return;
      const r = this.grantPowerUpById(id);
      // no need to remove from list (duplicates are blocked by manager),
      // but refresh in case your catalog changes.
      refreshPUs();
      puSel.value = '';
    });

    puRow.appendChild(document.createTextNode('Power-up:'));
    puRow.appendChild(puSel);
    eco.appendChild(puRow);

    // keep in sync with in-game grants/uses if desired
    this.bus?.on?.('powerup:granted', refreshPUs);
    this.bus?.on?.('powerup:used', refreshPUs);

    // ===== PERF CSV ===========================================================
    const csvWrap = document.createElement('details');
    csvWrap.dataset.global = '1';
    csvWrap.style.cssText = 'margin-top:8px;';
    csvWrap.open = false;

    const csvSum = document.createElement('summary');
    csvSum.textContent = 'Perf CSV (dev)';
    csvSum.style.cssText = 'cursor:pointer; color:#fff;';
    csvWrap.appendChild(csvSum);

    const csvCtl = document.createElement('div');
    csvCtl.style.cssText = 'display:flex; gap:8px; align-items:center; margin:8px 0;';

    const csvChk = document.createElement('input');
    csvChk.type = 'checkbox';

    const csvLbl = document.createElement('label');
    csvLbl.textContent = 'Capture frames this run';
    csvLbl.style.marginRight = '8px';

    const csvStatus = document.createElement('span');
    csvStatus.style.cssText = 'opacity:.85;';

    const csvBtn = document.createElement('button');
    csvBtn.textContent = 'Build & Download CSV';
    csvBtn.style.cssText = 'font-size:12px; padding:4px 10px;';
    csvBtn.disabled = true;

    csvCtl.appendChild(csvChk);
    csvCtl.appendChild(csvLbl);
    csvCtl.appendChild(csvStatus);
    csvCtl.appendChild(csvBtn);
    div.appendChild(csvWrap);
    csvWrap.appendChild(csvCtl);

    const refreshCsvUi = () => {
      const st = this.getPerfCsvStatus();
      csvChk.checked = !!st.enabled;
      const parts = [];
      parts.push(st.enabled ? (st.capturing ? 'Capturing…' : st.ready ? 'Ready' : 'Armed') : 'Off');
      parts.push(`frames: ${st.frames}`);
      parts.push(`events: ${st.events}`);
      csvStatus.textContent = parts.join(' • ');
      csvBtn.disabled = !st.ready;
    };

    csvChk.addEventListener('change', () => {
      this.setPerfCsvEnabled(!!csvChk.checked);
      refreshCsvUi();
    });
    csvBtn.addEventListener('click', () => {
      const out = this.buildPerfCSV();
      if (!out) return;
      const a = document.createElement('a');
      a.href = out.url;
      a.download = out.fileName || 'perf.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    // keep status fresh on key transitions
    this.bus?.on?.('run:start', refreshCsvUi);
    this.bus?.on?.('run:end', refreshCsvUi);

    // initial paint
    refreshCsvUi();

    // initial fill
    refreshPUs();

    // ===== CSV QUICK SUMMARY ================================================
    const sumWrap = document.createElement('details');
    sumWrap.dataset.global = '1';
    sumWrap.style.cssText = 'margin-top:8px;';
    sumWrap.open = false;

    const sumHead = document.createElement('summary');
    sumHead.textContent = 'CSV Quick Summary';
    sumHead.style.cssText = 'cursor:pointer; color:#fff;';
    sumWrap.appendChild(sumHead);

    const sumCtl = document.createElement('div');
    sumCtl.style.cssText = 'display:flex; gap:8px; align-items:center; margin:8px 0;';

    const sumBtn = document.createElement('button');
    sumBtn.textContent = 'Compute';
    sumBtn.style.cssText = 'font-size:12px; padding:4px 10px;';

    const sumCopy = document.createElement('button');
    sumCopy.textContent = 'Copy';
    sumCopy.style.cssText = 'font-size:12px; padding:4px 10px;';
    sumCopy.disabled = true;

    const sumDl = document.createElement('button');
    sumDl.textContent = 'Download JSON';
    sumDl.style.cssText = 'font-size:12px; padding:4px 10px;';
    sumDl.disabled = true;

    sumCtl.appendChild(sumBtn);
    sumCtl.appendChild(sumCopy);
    sumCtl.appendChild(sumDl);
    sumWrap.appendChild(sumCtl);

    const sumOut = document.createElement('pre');
    sumOut.style.cssText =
      'font-family:monospace; font-size:12px; white-space:pre-wrap; max-height:240px; overflow:auto; background:#0a0a0a; border:1px solid #222; padding:6px; border-radius:6px;';
    sumOut.textContent = '(no summary yet)';
    sumWrap.appendChild(sumOut);

    div.appendChild(sumWrap);

    function renderSummary(obj) {
      if (!obj) {
        sumOut.textContent = 'No data. End a run first, or enable capture and play a run.';
        sumCopy.disabled = true;
        sumDl.disabled = true;
        return;
      }
      const nice = JSON.stringify(obj, null, 2);
      sumOut.textContent = nice;
      sumCopy.disabled = false;
      sumDl.disabled = false;

      // prepare a blob URL for download
      try {
        const blob = new Blob([nice], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        sumDl.onclick = () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = `perf_summary_${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        };
      } catch (_) {}
    }

    sumBtn.addEventListener('click', () => {
      const s = this.buildPerfSummary();
      renderSummary(s);
    });
    sumCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(sumOut.textContent || '');
        sumCopy.textContent = 'Copied!';
        setTimeout(() => (sumCopy.textContent = 'Copy'), 900);
      } catch {
        sumCopy.textContent = 'Failed';
        setTimeout(() => (sumCopy.textContent = 'Copy'), 1200);
      }
    });

    // Auto-enable when a run ends so it’s one-click away
    this.bus?.on?.('run:end', () => {
      const s = this.buildPerfSummary();
      if (s) renderSummary(s);
    });

    // ===== UNLOCKABLES CSV ==================================================
    const uCsvWrap = document.createElement('details');
    uCsvWrap.dataset.global = '1';
    uCsvWrap.style.cssText = 'margin-top:8px;';
    uCsvWrap.open = false;

    const uCsvSum = document.createElement('summary');
    uCsvSum.textContent = 'Unlockables CSV';
    uCsvSum.style.cssText = 'cursor:pointer; color:#fff;';
    uCsvWrap.appendChild(uCsvSum);

    const uCtl = document.createElement('div');
    uCtl.style.cssText = 'display:flex; gap:8px; align-items:center; margin:8px 0;';

    const uBtn = document.createElement('button');
    uBtn.textContent = 'Compute';
    uBtn.style.cssText = 'font-size:12px; padding:4px 10px;';

    const fmtSel = document.createElement('select');
    fmtSel.title = 'Format';
    fmtSel.style.cssText = 'font-size:12px; padding:2px 6px;';
    fmtSel.innerHTML = `
  <option value="csv">CSV</option>
  <option value="table">Pretty table</option>
`;

    const uCopy = document.createElement('button');
    uCopy.textContent = 'Copy';
    uCopy.style.cssText = 'font-size:12px; padding:4px 10px;';
    uCopy.disabled = true;

    const uDl = document.createElement('button');
    uDl.textContent = 'Download';
    uDl.style.cssText = 'font-size:12px; padding:4px 10px;';
    uDl.disabled = true;

    uCtl.appendChild(uBtn);
    uCtl.appendChild(fmtSel);
    uCtl.appendChild(uCopy);
    uCtl.appendChild(uDl);
    uCsvWrap.appendChild(uCtl);

    const uOut = document.createElement('textarea');
    uOut.readOnly = true;
    uOut.spellcheck = false;
    uOut.style.cssText =
      'font-family:monospace; font-size:12px; color:#ddd; white-space:pre; max-height:240px; min-height:160px; width:100%; overflow:auto; background:#0a0a0a; border:1px solid #222; padding:6px; border-radius:6px;';
    uOut.placeholder = '(no CSV yet)';
    uCsvWrap.appendChild(uOut);

    div.appendChild(uCsvWrap);

    // simple pretty-table generator from rows
    function makePrettyTable(rows) {
      const cols = ['type', 'id', 'name', 'owned', 'condition', 'condition_source', 'notes'];
      const data = rows.map((r) => cols.map((c) => String(r[c] ?? '')));
      const widths = cols.map((c, i) => Math.max(c.length, ...data.map((row) => row[i].length)));
      const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
      const line = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';

      // rows are already sorted by type then name; we’ll emit a header per type
      let out = '';
      let lastType = null;

      const header = '|' + cols.map((c, i) => ' ' + pad(c, widths[i]) + ' ').join('|') + '|';

      for (const r of rows) {
        if (r.type !== lastType) {
          if (lastType !== null) out += '\n';
          out += `# ${r.type.toUpperCase()}\n${line}\n${header}\n${line}\n`;
          lastType = r.type;
        }
        const rowStr =
          '|' + cols.map((c, i) => ' ' + pad(String(r[c] ?? ''), widths[i]) + ' ').join('|') + '|';
        out += rowStr + '\n';
      }
      out += line;
      return out.trimEnd();
    }

    function makeCSV(rows) {
      const cols = ['type', 'id', 'name', 'owned', 'condition', 'condition_source', 'notes'];
      const esc = (s) => {
        const v = String(s ?? '');
        return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      };
      let out = '';
      let lastType = null;
      for (const r of rows) {
        if (r.type !== lastType) {
          if (lastType !== null) out += '\n';
          out += `# ${String(r.type || '').toUpperCase()}\n`;
          lastType = r.type;
        }
        out += cols.map((c) => esc(r[c] ?? '')).join(',') + '\n';
      }
      return out.trimEnd();
    }

    let _uBlobUrl = null;
    uBtn.addEventListener('click', () => {
      try {
        // 1) Core unlockables from ProfileStore
        const core = ProfileStore.summarizeUnlockables({ includeLocked: true });
        if (!core || !Array.isArray(core.rows)) throw new Error('no data');

        // 2) Filter out any skins that are NOT in the live SkinManager catalog
        const liveSkinIds =
          SkinManager?.getCatalog?.()?.map((s) => s.id) ||
          SkinManager?.getRegisteredSkins?.()?.map((s) => s.id || s) ||
          [];
        const liveSkinSet = new Set(liveSkinIds);

        const filtered = core.rows.filter((r) =>
          r.type === 'skin' && liveSkinSet.size ? liveSkinSet.has(r.id) : true
        );

        // 3) Append a BANK section built from the live Bank snapshot
        const bal = Bank.get();
        const bankRows = Object.entries(bal).map(([id, amt]) => ({
          type: 'bank',
          id,
          name: id.charAt(0).toUpperCase() + id.slice(1),
          owned: String(amt ?? 0),
          condition: '',
          condition_source: 'Bank',
          notes: '',
        }));

        // 4) Sort by type then name for stable output
        const rows = [...filtered, ...bankRows].sort(
          (a, b) =>
            (a.type || '').localeCompare(b.type || '') || (a.name || '').localeCompare(b.name || '')
        );

        // 5) Build the chosen output format from our merged rows
        const format = fmtSel.value; // 'csv' | 'table'
        const text = format === 'csv' ? makeCSV(rows) : makePrettyTable(rows);
        const fileNameBase = core.fileName?.replace(/\.csv$/i, '') || `unlockables_${Date.now()}`;

        const fileName = format === 'csv' ? `${fileNameBase}.csv` : `${fileNameBase}_table.txt`;
        const mime = format === 'csv' ? 'text/csv' : 'text/plain';

        uOut.value = text;
        uCopy.disabled = false;
        uDl.disabled = false;

        if (_uBlobUrl) URL.revokeObjectURL(_uBlobUrl);
        const blob = new Blob([text], { type: mime });
        _uBlobUrl = URL.createObjectURL(blob);
        uDl.onclick = () => {
          const a = document.createElement('a');
          a.href = _uBlobUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
        };
      } catch (e) {
        uOut.value = 'Failed to compute CSV: ' + (e?.message || String(e));
        uCopy.disabled = true;
        uDl.disabled = true;
      }
    });

    uCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(uOut.value || '');
        const old = uCopy.textContent;
        uCopy.textContent = 'Copied!';
        setTimeout(() => (uCopy.textContent = old), 900);
      } catch {
        const old = uCopy.textContent;
        uCopy.textContent = 'Failed';
        setTimeout(() => (uCopy.textContent = old), 900);
      }
    });

    // ===== PICK SET (collapsible) ==========================================
    const pickWrap = document.createElement('details');
    pickWrap.dataset.global = '1';
    pickWrap.style.cssText = 'margin-top:8px;';
    pickWrap.open = false;
    const sum = document.createElement('summary');
    sum.textContent = 'Pick Set (toggle)';
    sum.style.cssText = 'cursor:pointer; color:#fff;';
    pickWrap.appendChild(sum);
    const pickList = document.createElement('div');
    pickList.id = 'dbgPickList';
    pickList.style.cssText = 'margin-top:6px; font-family:monospace;';
    pickList.textContent = 'None';
    pickWrap.appendChild(pickList);
    div.appendChild(pickWrap);
    this.$pickSet = pickList;

    // ===== EVENT TAIL =======================================================
    const evWrap = document.createElement('details');
    evWrap.dataset.global = '1';
    evWrap.style.cssText = 'margin-top:8px;';
    evWrap.open = false;

    const evSum = document.createElement('summary');
    evSum.textContent = 'Analytics (last 50)';
    evSum.style.cssText = 'cursor:pointer; color:#fff;';
    evWrap.appendChild(evSum);

    const evCtl = document.createElement('div');
    evCtl.style.cssText = 'display:flex; gap:6px; align-items:center; margin:6px 0;';
    const evFilter = document.createElement('input');
    evFilter.type = 'text';
    evFilter.placeholder = 'filter (e.g., shape:, level:)';
    evFilter.style.cssText =
      'flex:1; padding:3px 6px; background:#111; color:#fff; border:1px solid #333; border-radius:4px;';
    const evClear = document.createElement('button');
    evClear.textContent = 'Clear';
    evClear.style.cssText = 'font-size:12px; padding:3px 8px;';
    evClear.addEventListener('click', () => {
      this.clearEventTail();
      renderTail();
    });
    evCtl.appendChild(evFilter);
    evCtl.appendChild(evClear);
    const evExport = document.createElement('button');
    evExport.textContent = 'Export';
    evExport.style.cssText = 'font-size:12px; padding:3px 8px; margin-left:6px;';
    evExport.addEventListener('click', () => this.exportAnalytics());
    evCtl.appendChild(evExport);
    evWrap.appendChild(evCtl);

    const evList = document.createElement('div');
    evList.style.cssText =
      'font-family:monospace; font-size:12px; white-space:pre-wrap; max-height:160px; overflow:auto; background:#0a0a0a; border:1px solid #222; padding:6px; border-radius:6px;';
    evWrap.appendChild(evList);

    div.appendChild(evWrap);

    const renderTail = () => {
      const rows = this.getEventTail() || [];
      const q = (evFilter.value || '').toLowerCase().trim();
      const filt = q ? rows.filter((r) => r.evt.toLowerCase().includes(q)) : rows;
      evList.innerHTML = filt
        .map((r) => {
          const t = new Date(r.ts).toLocaleTimeString();
          // Prefer normalized fields produced by Analytics.js:
          const hint = r.shape ?? (Number.isFinite(r.lvl) ? `L${r.lvl}` : r.mini ?? '');
          return `[${t}] ${r.evt}${hint ? ' ' + hint : ''}`;
        })
        .join('\n');
    };

    evFilter.addEventListener('input', renderTail);

    // keep it fresh while open
    this.bus?.on?.('run:start', renderTail);
    this.bus?.on?.('run:end', renderTail);
    this.bus?.on?.('shape:complete', renderTail);
    this.bus?.on?.('level:advance', renderTail);
    this.bus?.on?.('minigame:start', renderTail);
    this.bus?.on?.('minigame:win', renderTail);
    this.bus?.on?.('minigame:lose', renderTail);

    // ===== VERIFIERS ========================================================
    const verWrap = document.createElement('details');
    verWrap.dataset.global = '1';
    verWrap.style.cssText = 'margin-top:8px;';
    verWrap.open = false;

    const verSum = document.createElement('summary');
    verSum.textContent = 'Verifiers';
    verSum.style.cssText = 'cursor:pointer; color:#fff;';
    verWrap.appendChild(verSum);

    const verBtn = document.createElement('button');
    verBtn.textContent = 'Run verifiers';
    verBtn.style.cssText = 'font-size:12px; padding:4px 10px; margin:6px 0;';
    verWrap.appendChild(verBtn);

    const verOut = document.createElement('div');
    verOut.style.cssText = 'font-family:monospace; font-size:12px; white-space:pre-wrap;';
    verWrap.appendChild(verOut);

    div.appendChild(verWrap);

    const renderVerify = (res) => {
      if (!res) return;
      const sh = (res.shapes || [])
        .map(
          (s) => `${s.ok ? '✅' : '❌'} ${s.id || s.name || 'unnamed'}${s.err ? ' — ' + s.err : ''}`
        )
        .join('\n');
      const mg = (res.minigames || [])
        .map(
          (m) =>
            `${m.ok ? '✅' : '❌'} ${m.id}${
              m.errs && m.errs.length ? ' — ' + m.errs.join(', ') : ''
            }`
        )
        .join('\n');
      const errs = res.errors && res.errors.length ? '\nErrors:\n' + res.errors.join('\n') : '';
      verOut.textContent = `Shapes:\n${sh || '(none)'}\n\nMini-games:\n${mg || '(none)'}${errs}`;
    };

    verBtn.addEventListener('click', async () => {
      verOut.textContent = 'Running…';
      try {
        const r = await this.runVerifiers();
        renderVerify(r);
      } catch (e) {
        verOut.textContent = 'Failed: ' + (e?.message || String(e));
      }
    });

    // also repaint if a report is emitted elsewhere
    this.bus?.on?.('verify:report', renderVerify);

    // mount
    document.body.appendChild(div);
    this.root = div;
    window.__debugUI = this;

    this.root.classList.add('dm-hidden'); // start hidden; W toggles it
    this.isOpen = false;

    // update runtime/global visibility when the screen changes
    this._applyScreenMode();
    this._screenObs = new MutationObserver(() => this._applyScreenMode());
    this._screenObs.observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });

    // toggle button
    this.ensureToggle();
    // --- Hotkeys (W / Space / S / A / D) ---------------------------------
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler, true);
    }
    this._keyHandler = (e) => {
      if (e.repeat) return;

      // Don’t hijack keys while typing in form fields
      const t = e.target;
      const tag = (t && t.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;

      switch (e.code) {
        case 'KeyW': {
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          e.preventDefault();
          this.toggle(); // call our API directly
          break;
        }
        case 'Space': {
          // Force Complete
          e.preventDefault();
          this.forceComplete?.();
          break;
        }
        case 'KeyS': {
          // +150,000,000 score
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          this.addScore?.(150_000_000);
          break;
        }
        case 'KeyA': {
          // Give random power-up
          e.preventDefault();
          const ids = this.getPowerUpIds?.() || [];
          if (ids.length) {
            const pick = ids[(Math.random() * ids.length) | 0];
            this.grantPowerUpById?.(pick);
          }
          break;
        }
        case 'KeyD': {
          // Give random upgrade
          e.preventDefault();
          const list = this.getAvailableUpgrades?.() || [];
          if (list.length) {
            const pick = list[(Math.random() * list.length) | 0];
            const id = pick.id || pick;
            this.grantUpgradeById?.(id);
          }
          break;
        }
      }
    };
    window.addEventListener('keydown', this._keyHandler, true);
    // ----------------------------------------------------------------------
    this.update();
  }

  // Show/hide the entire panel (used by W and the button)
  toggle(force) {
    const wantOpen = typeof force === 'boolean' ? force : !this.isOpen;
    this.isOpen = wantOpen;
    if (!this.root) return;

    // set both style and class so nothing fights us
    this.root.style.display = wantOpen ? 'block' : 'none';
    this.root.classList.toggle('dm-hidden', !wantOpen);

    if (this.toggleBtn) {
      this.toggleBtn.textContent = wantOpen ? 'Hide Debug Menu' : 'Toggle Debug Menu';
    }
    if (wantOpen) this._applyScreenMode();
  }

  // Show runtime sections only in GAME; always show global/economy tools
  _applyScreenMode() {
    const inGame =
      document.body.getAttribute('data-screen') === 'game' ||
      (window.__router && window.__router.getState && window.__router.getState() === 'GAME');

    const show = (selector, on) => {
      this.root?.querySelectorAll(selector)?.forEach((el) => {
        el.style.display = on ? '' : 'none';
      });
    };

    show('[data-runtime]', inGame);
    show('[data-global]', true);
  }

  ensureToggle() {
    if (this.toggleBtn) return;
    const btn = document.createElement('button');
    btn.id = 'debugToggleBtn';
    btn.textContent = 'Toggle Debug Menu';
    btn.style.cssText =
      'position:absolute; top:50px; right:20px; font-size:14px; padding:5px 12px; z-index:101;';
    btn.addEventListener('click', () => this.toggle());
    document.body.appendChild(btn);
    this.toggleBtn = btn;
  }

  unmount() {
    if (this.toggleBtn && this.toggleBtn.parentNode)
      this.toggleBtn.parentNode.removeChild(this.toggleBtn);
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.toggleBtn = null;
    this.root = null;

    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
    if (this._screenObs) {
      try {
        this._screenObs.disconnect();
      } catch {}
      this._screenObs = null;
    }
    if (window.__debugUI === this) {
      try {
        delete window.__debugUI;
      } catch {
        window.__debugUI = null;
      }
    }
  }

  destroy() {
    this.unmount();
  }

  // thin live-updaters used by main.js
  setTimeRemaining(sec) {
    if (this.$timeLeft) this.$timeLeft.textContent = (Number(sec) || 0).toFixed(2);
  }

  update() {
    if (!this.root) return;

    // current + level
    if (this.$shapeName)
      this.$shapeName.textContent = this.shapeManager?.getCurrentShapeName?.() || 'None';
    const lvl = this.getLevel();
    if (this.$levelNum) {
      const cyc =
        lvl === 4 && this.shapeManager?.getInfiniteCycleIndex
          ? ` (cycle ${this.shapeManager.getInfiniteCycleIndex()})`
          : '';
      this.$levelNum.textContent = lvl === 4 ? `∞${cyc}` : String(lvl);
    }

    // selectors reflect current state
    if (this.$modeSel) this.$modeSel.value = this.getMode();
    if (this.$levelSel) this.$levelSel.value = String(lvl);
    if (this.$shapeSel && this.shapeManager?.getCurrentShapeName) {
      this.$shapeSel.value = this.shapeManager.getCurrentShapeName() || this.$shapeSel.value;
    }

    // 🆕 Behavior, Mini-game, Run time
    if (this.$behavior)
      this.$behavior.textContent = this.shapeManager?.getCurrentShapeType?.() || '—';

    if (this.$mini) this.$mini.textContent = this.miniGameManager?.getName?.() || 'None' || 'None';

    if (this.$runTime) {
      const s = Math.max(0, Math.floor(this.getRunSeconds()));
      const mm = Math.floor(s / 60).toString();
      const ss = (s % 60).toString().padStart(2, '0');
      this.$runTime.textContent = `${mm}:${ss}`;
    }

    // next + pickset
    if (this.$next) {
      const nxt = this.shapeManager?.getNextShapeNameAndLevel?.() || { name: '', level: lvl };
      this.$next.textContent = nxt.name
        ? `${nxt.name}, Level ${nxt.level === 4 ? '∞' : nxt.level}`
        : 'None';
    }
    if (this.$pickSet) {
      const pick = this.shapeManager?.getPickSet?.() || [];
      const completed = this.shapeManager?.getCompletedShapes?.() || [];
      const inProg = this.shapeManager?.getInProgressShapes?.() || [];
      const curr = this.shapeManager?.getCurrentShapeName?.() || '';
      this.$pickSet.innerHTML = pick.length
        ? pick
            .map((s) => {
              if (completed.includes(s.name)) return `✅ ${s.name}`;
              if (inProg.includes(s.name)) return `🟡 ${s.name}`;
              if (s.name === curr) return `🔵 ${s.name}`;
              return `⬜ ${s.name}`;
            })
            .join('<br>')
        : 'None';
    }
    if (this.$speedSel) this.$speedSel.value = String(this.getSpeed());
    if (this.$miniLvlSel) this.$miniLvlSel.value = String(lvl);
    if (this.$miniSel && typeof this.getMiniGameIds === 'function') {
      const list = this.getMiniGameIds();
      if (Array.isArray(list) && list.length && this.$miniSel.options.length !== list.length) {
        this.$miniSel.innerHTML = list.map((id) => `<option value="${id}">${id}</option>`).join('');
      }
    }
    if (this.$completed) this.$completed.textContent = String(this.getRunCompleted());
    if (this.$fps) this.$fps.textContent = String(Math.round(this.getFPS()));
    if (this.$fpsTog) this.$fpsTog.checked = !!this.getShowFPSOverlay();
    if (this.$fpsTog2) this.$fpsTog2.checked = !!this.getShowFPSOverlay();
    // Perf snapshot
    const pf = this.getPerf?.() || {};
    if (this.$spk) this.$spk.textContent = String(pf.spikes3s ?? 0);
    if (this.$lt) this.$lt.textContent = String(pf.longTasks ?? 0);
    if (this.$mem) this.$mem.textContent = pf.memoryMB != null ? pf.memoryMB + ' MB' : '–';
    if (pf.buckets) {
      const n = (v) => (Math.round((v || 0) * 10) / 10).toFixed(1);
      if (this.$bUpd) this.$bUpd.textContent = `upd ${n(pf.buckets.update)}`;
      if (this.$bPA) this.$bPA.textContent = `play ${n(pf.buckets.playArea)}`;
      if (this.$bFX) this.$bFX.textContent = `fx ${n(pf.buckets.fx)}`;
      if (this.$bHUD) this.$bHUD.textContent = `hud ${n(pf.buckets.hud)}`;
    }
    const isoOnly = this.getMode() === 'isolation';
    if (this.$shapeSel) this.$shapeSel.disabled = !isoOnly;
    if (this.$levelSel) this.$levelSel.disabled = !isoOnly;
    if (this.$goBtn) this.$goBtn.disabled = !isoOnly;
    if (this.$miniSel) this.$miniSel.disabled = !isoOnly;
    if (this.$miniLvlSel) this.$miniLvlSel.disabled = !isoOnly;
    if (this.$miniGo) this.$miniGo.disabled = !isoOnly;
    if (this.$miniSel && this.$miniSel.nextSibling) {
    }
  }
}
