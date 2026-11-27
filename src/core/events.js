/** Tiny event bus. Systems talk through this, never by importing each other. */
export class EventBus {
  constructor() { this.map = new Map(); }
  /** @param {string} ev @param {Function} fn @returns {Function} unsubscribe */
  on(ev, fn) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev).add(fn);
    return () => this.map.get(ev)?.delete(fn);
  }
  /** @param {string} ev @param {*} [data] */
  emit(ev, data) {
    const set = this.map.get(ev);
    if (!set) return;
    for (const fn of [...set]) { try { fn(data); } catch (e) { console.error('[bus]', ev, e); } }
  }
  dispose() { this.map.clear(); }
}

export const bus = new EventBus();
