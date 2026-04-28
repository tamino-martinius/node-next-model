import { describe, expect, it, vi } from 'vitest';
import { Emitter } from '../Emitter.js';

describe('Emitter', () => {
  it('calls subscribed callbacks on emit', () => {
    const e = new Emitter();
    const a = vi.fn();
    const b = vi.fn();
    e.subscribe(a);
    e.subscribe(b);
    e.emit();
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('returns an unsubscribe function', () => {
    const e = new Emitter();
    const cb = vi.fn();
    const off = e.subscribe(cb);
    off();
    e.emit();
    expect(cb).not.toHaveBeenCalled();
  });

  it('tolerates a callback that throws — others still run', () => {
    const e = new Emitter();
    const a = vi.fn(() => {
      throw new Error('boom');
    });
    const b = vi.fn();
    e.subscribe(a);
    e.subscribe(b);
    expect(() => e.emit()).not.toThrow();
    expect(b).toHaveBeenCalled();
  });
});
