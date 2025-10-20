// src/libs/AnalyticsTransport.js
// Pluggable transport (stubbed OFF by default)
const AnalyticsTransport = {
  enabled: false, // keep OFF for RC builds
  flushIntervalMs: 15000,
  queue: [],
  enqueue(rec) {
    if (!this.enabled) return;
    this.queue.push(rec);
    // In the future: POST this.queue to your endpoint, then clear on success
  },
  flush() {
    // no-op for now
  },
};
export default AnalyticsTransport;
