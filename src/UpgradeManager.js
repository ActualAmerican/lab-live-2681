// src/UpgradeManager.js
import { getEligibleUpgrades } from './libs/UpgradeLibrary.js';

export const UPGRADE_PRICES = [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000];

export default class UpgradeManager {
constructor({ hud, shapeManager, bus }){
    this.game = { hud, shapeManager };
    this.bus  = bus;
    this.levels = {};               // id -> level for this run (we keep 1 for now)
    this.purchasedSlots = new Set();// which price slots are already filled
    this.getScore   = () => 0;
    this.spendScore = () => {};
  }
  setScoreAccessors({ getScore, spendScore }){
    this.getScore   = getScore;
    this.spendScore = spendScore;
  }

  resetRun(){
  this.levels = {};
  this.purchasedSlots.clear();
  // clean any global effects we used in demo upgrades
  window.scoreMultiplier = 1;
  window.timeBonus = 1;
  window.mistakeShields = 0;
}

  purchase(slotIndex){
    // sequential lock: all previous slots must be purchased
    for (let i = 0; i < slotIndex; i++){
      if (!this.purchasedSlots.has(i)) return { ok:false, reason:'locked' };
    }
    if (this.purchasedSlots.has(slotIndex)) return { ok:false, reason:'occupied' };

    const price = UPGRADE_PRICES[slotIndex] ?? 0;
    if (this.getScore() < price)   return { ok:false, reason:'insufficient' };

    const pool = getEligibleUpgrades(this.levels);
    if (!pool.length)              return { ok:false, reason:'empty_pool' };

    // spend-first
    this.spendScore(price);

    // random draw (no stacking for now → set level to 1)
    const jewel = pool[Math.floor(Math.random() * pool.length)];
    this.levels[jewel.id] = 1;

    this.purchasedSlots.add(slotIndex);
    jewel.apply?.(this.game, 1);
    this.bus?.emit?.('upgrade:purchased', {
  id: jewel.id,
  name: jewel.name,
  icon: jewel.icon,
  slot: slotIndex,
  price,
  level: 1
});
    return { ok:true, id:jewel.id, name:jewel.name, icon:jewel.icon, level:1 };
  }

      getAvailableUpgrades(){
    // If no free price slots left, nothing can be granted.
    const MAX_SLOTS = UPGRADE_PRICES.length;
    if (this.purchasedSlots.size >= MAX_SLOTS) return [];

    // Exclude those we already own in this run.
    const all = getEligibleUpgrades({}); // full catalog
    const owned = new Set(Object.keys(this.levels || {}));
    return all
      .filter(u => !owned.has(u.id))
      .map(u => ({ id: u.id, name: u.name, icon: u.icon }));
  }

  grantById(id){

  // first free slot
  let slot = 0;
  const maxSlots = UPGRADE_PRICES.length;
  while (this.purchasedSlots.has(slot) && slot < maxSlots) slot++;
  if (slot >= maxSlots) return { ok:false, reason:'no_slot' };

  const pool = getEligibleUpgrades(this.levels);
  const jewel = pool.find(u => u.id === id);
  if (!jewel) return { ok:false, reason:'unknown' };

  // mark owned and occupy the slot (debug grant = free)
  this.levels[id] = (this.levels[id] || 0) + 1;
  this.purchasedSlots.add(slot);
  jewel.apply?.(this.game, 1);

  // 🔔 reveal the tile in the HUD immediately
  this.game.hud?.revealUpgrade(slot, { icon: jewel.icon, level: 1 });

  // event for logs
  this.bus?.emit?.('upgrade:purchased', {
    id: jewel.id, name: jewel.name, icon: jewel.icon,
    slot, price: 0, level: 1, debug: true
  });

  return { ok:true, slot, id: jewel.id, icon: jewel.icon };
}

}
