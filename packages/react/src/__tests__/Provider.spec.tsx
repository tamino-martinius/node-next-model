import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NextModelProvider, useStore } from '../Provider.js';
import { Store } from '../Store.js';

describe('NextModelProvider', () => {
  it('provides a Store via context', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NextModelProvider>{children}</NextModelProvider>
    );
    const { result } = renderHook(() => useStore(), { wrapper });
    expect(result.current).toBeInstanceOf(Store);
  });

  it('disposes the Store on unmount', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NextModelProvider>{children}</NextModelProvider>
    );
    const { result, unmount } = renderHook(() => useStore(), { wrapper });
    const store = result.current;
    unmount();
    expect(store.isDisposed()).toBe(true);
  });

  it('throws when useStore is called outside a Provider', () => {
    expect(() => renderHook(() => useStore())).toThrow(
      /must be used inside <NextModelProvider>/,
    );
  });
});
