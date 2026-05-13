export class Emitter {
  private listeners = new Set<() => void>();
  private version = 0;

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  emit(): void {
    this.version++;
    for (const cb of [...this.listeners]) {
      try {
        cb();
      } catch {
        /* swallow — one bad listener must not block others */
      }
    }
  }

  getVersion(): number {
    return this.version;
  }
}
