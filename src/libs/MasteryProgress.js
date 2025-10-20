// src/libs/MasteryProgress.js
import ProfileStore from './ProfileStore.js';

export default class MasteryProgress {
  constructor() {
    this.cache = {};
  }

  primeFromProfile() {
    const p = ProfileStore.get();
    this.cache.runs_completed = p?.stats?.lifetime?.runsCompleted || 0;
  }

  onRunEnd() {
    const p = ProfileStore.get();
    this.cache.runs_completed = p?.stats?.lifetime?.runsCompleted || 0;
  }

  get(metric) {
    return this.cache[metric];
  }
}
