// src/libs/PowerUpLibrary.js
export class PowerUp {
  id = 'base';
  name = 'Unnamed';
  type = 'active'; // 'active' | 'passive'
  icon = '✨';
  maxLevel = 5;
  cost(level){ return 50 * level; }

  // lifecycle hooks
  onAttach(game) {}
  onDetach(game) {}
  onActivate(game) {}      // for active power-ups
  onTick(game, dt) {}      // passive updates
  onEvent(game, evt) {}    // listen to Event Bus later
}

export const powerUpRegistry = [];
export function registerPowerUp(bp){ powerUpRegistry.push(bp); }
export function getPowerUpById(id){ return powerUpRegistry.find(p => p.id === id) || null; }

// --- helpers ---
export function getAllPowerUpIds(){
  return powerUpRegistry.map(p => p.id);
}

// --- temporary demo power-ups (replace later with your real designs) ---
class PU_Shield extends PowerUp {
  id='shield'; name='Shield'; icon='🛡️';
  onActivate(game){ console.log('[PU] Shield used'); }
}
class PU_Burst extends PowerUp {
  id='burst'; name='Score Burst'; icon='⚡';
  onActivate(game){ console.log('[PU] Score burst used'); }
}
class PU_Slow extends PowerUp {
  id='slow'; name='Time Slow'; icon='⏳';
  onActivate(game){ console.log('[PU] Time slow used'); }
}

registerPowerUp(new PU_Shield());
registerPowerUp(new PU_Burst());
registerPowerUp(new PU_Slow());
