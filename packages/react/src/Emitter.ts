export class Emitter {
  private listeners = new Set<() => void>();

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  emit(): void {
    for (const cb of [...this.listeners]) {
      try { cb(); } catch { /* swallow — one bad listener must not block others */ }
    }
  }
}
