// src/libs/UpgradeLibrary.js
export class Upgrade {
  id = 'base';
  name = 'Unnamed';
  icon = '⬆️';
  maxLevel = 1;                         // >1 means it can stack
  cost(level){ return 100 * level; }    // per-level cost (not used for slot price labels)
  apply(game, level) {}                 // called after a purchase
  remove(game, level) {}                // optional
}

export const upgradeRegistry = [];
export function registerUpgrade(u){ upgradeRegistry.push(u); }
export function getUpgradeById(id){ return upgradeRegistry.find(x => x.id === id) || null; }
export function getEligibleUpgrades(currentLevels){
  return upgradeRegistry.filter(u => (currentLevels[u.id] || 0) < (u.maxLevel || 1));
}
