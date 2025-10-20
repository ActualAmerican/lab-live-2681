// src/ui/Hotbar.js
export default class Hotbar {
  constructor({ slots = 4 } = {}) {
    this._events = {};
    this.slots = [];

    this.element = document.createElement('div');
    this.element.className = 'hotbar';

    // minimal scoped styles (safe to move to styles.css later)
    const s = document.createElement('style');
s.textContent = `
  .hotbar{ display:flex; gap:12px; align-items:center; }
  .hotbar, .hotbar *{ -webkit-user-select:none; -moz-user-select:none; -ms-user-select:none; user-select:none; }

  .hbSlot{
    width:90px; height:90px; border:2px solid #fff; border-radius:6px;
    display:flex; align-items:center; justify-content:center; background:transparent;
    transition: transform 150ms cubic-bezier(.22,.61,.36,1);
    will-change: transform;
  }

  /* Hover grow only when usable */
  .hbSlot.hb-canUse:hover{ transform: scale(1.06); }

  .hbIcon{ font-size:28px; line-height:1; }

  /* === Animations === */
  @keyframes hbUse {
    0%   { transform: scale(1);   }
    40%  { transform: scale(0.90);}
    100% { transform: scale(1);   }
  }
  .hbSlot.hb-using { animation: hbUse 200ms ease-out; }

  @keyframes hbReveal {
  0%   { transform: scale(0.92); opacity: 0; }
  40%  { transform: scale(0.98); opacity: 0.9; }
  70%  { transform: scale(1.04); opacity: 1;   }
  100% { transform: scale(1.00); opacity: 1;   }
}
.hbSlot.hb-reveal { animation: hbReveal 340ms ease-out both; }

  @keyframes hbShake {
    0%,100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    50% { transform: translateX(4px); }
    75% { transform: translateX(-2px); }
  }
  .hotbar.hb-full { animation: hbShake 280ms ease-out; }
`;

this.element.appendChild(s);

    for (let i = 0; i < slots; i++) {
      const icon = document.createElement('div');
      icon.className = 'hbIcon';
      icon.textContent = ''; // set via setSlot()

      const slot = document.createElement('div');
      slot.className = 'hbSlot';
      slot.appendChild(icon);
      this.element.appendChild(slot);

      // click to activate
      slot.addEventListener('click', () =>
        this._emit('activate', { slot: i, id: this.slots[i]?.id ?? null })
      );

      this.slots[i] = { id: null, level: 0, iconEl: icon, el: slot };
    }
  }

  setLoadout(arr){ arr.forEach((cfg, i) => this.setSlot(i, cfg)); }
  setSlot(i, cfg = {}) {
  const s = this.slots[i]; if (!s) return;
  const hadId = !!s.id;

  s.id    = cfg.id ?? null;
  s.level = cfg.level ?? 0;
  s.iconEl.textContent = cfg.icon ?? '';

  // Usable if it actually has a power-up
  s.el?.classList.toggle('hb-canUse', !!s.id);

  // Pop-in when we go from empty -> has power-up
  if (!hadId && s.id) {
    s.el.classList.remove('hb-reveal'); void s.el.offsetWidth; // restart anim
    s.el.classList.add('hb-reveal');
    s.el.addEventListener('animationend', () => {
      s.el.classList.remove('hb-reveal');
    }, { once: true });
  }
}

  on(type, fn){ (this._events[type] ||= new Set()).add(fn); return () => this.off(type, fn); }
  off(type, fn){ this._events[type]?.delete(fn); }
  _emit(type, data){ this._events[type]?.forEach(fn => fn(data)); }

  animateUse(slotIndex, onDone){
  const s = this.slots[slotIndex]; if (!s?.el) { onDone?.(); return; }
  const el = s.el;
  el.classList.remove('hb-using'); void el.offsetWidth; // restart
  el.classList.add('hb-using');
  el.addEventListener('animationend', () => {
    el.classList.remove('hb-using');
    onDone?.();
  }, { once: true });
}

flashFull(){
  this.element.classList.remove('hb-full'); void this.element.offsetWidth;
  this.element.classList.add('hb-full');
  this.element.addEventListener('animationend', () => {
    this.element.classList.remove('hb-full');
  }, { once: true });
}
}
