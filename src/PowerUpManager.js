// src/PowerUpManager.js
import { getPowerUpById } from './libs/PowerUpLibrary.js';

    export default class PowerUpManager {
    constructor({ shapeManager, hud, hotbar, bus } = {}){
    this.game = { shapeManager, hud };
    this.hotbar = hotbar;
    this.bus = bus;
    this.equipped = [null, null, null, null]; // 4 slots
    this.cooldowns = [0,0,0,0];               // ms remaining per slot
    this.lastTs = performance.now();
  }

  resetRun(){
    this.equipped = [null, null, null, null];
    this.cooldowns = [0,0,0,0];
  }

  tick() {
    const now = performance.now();
    const dt = now - this.lastTs;
    this.lastTs = now;
    for (let i=0;i<this.cooldowns.length;i++){
      this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    }
    for (const pu of this.equipped){
      pu?.onTick?.(this.game, dt/1000);
    }
  }

  equip(slot, id){
  const bp = getPowerUpById(id);
  if (!bp) return false;
  this.equipped[slot] = bp;
  bp.onAttach?.(this.game);
  this.bus?.emit?.('powerup:granted', { id, slot });
  return true;
}

  activate(slot){
  const pu = this.equipped[slot];
  if (!pu) return false;
  if (this.cooldowns[slot] > 0) return false;

  // Trigger the effect immediately…
  pu.onActivate?.(this.game);
  this.bus?.emit?.('powerup:used', { id: pu.id, slot });
  
  // …then play a quick shrink animation before clearing the slot/icon.
  const clear = () => {
    this.equipped[slot] = null;
    this.hotbar?.setSlot(slot, { id:null, level:0, icon:'' });
  };
  if (this.hotbar?.animateUse) {
    this.hotbar.animateUse(slot, clear);
  } else {
    clear();
  }
  return true;
}

  upgrade(slot){
    console.log('[PowerUpManager] upgrade slot', slot, this.equipped[slot]?.id);
    return true;
  }

    firstEmptySlot(){
    return this.equipped.findIndex(s => !s);
  }

    grantById(id){
    // duplicates are OK now; only require an empty slot
    const slot = this.firstEmptySlot();
    if (slot === -1) return { ok:false, reason:'no_slot' };

    const ok = this.equip(slot, id);
    if (!ok) return { ok:false, reason:'unknown' };

    // reflect in Hotbar immediately
    const bp = getPowerUpById(id) || {};
    this.hotbar?.setSlot(slot, { id, level: 1, icon: bp.icon || '★' });

    return { ok:true, slot };
  }
}
