// src/libs/EventBus.js
export default class EventBus {
  constructor(){ this._map = new Map(); }

  on(evt, fn){
    if (!this._map.has(evt)) this._map.set(evt, new Set());
    this._map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }

  once(evt, fn){
    const off = this.on(evt, (payload) => { off(); fn(payload); });
    return off;
  }

  off(evt, fn){
    const set = this._map.get(evt);
    if (set) { set.delete(fn); if (set.size === 0) this._map.delete(evt); }
  }

  emit(evt, payload){
    const set = this._map.get(evt);
    if (!set) return;
    [...set].forEach(fn => { try { fn(payload); } catch(e){ console.error('[EventBus]', evt, e); } });
  }
}
