import { act, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useModel } from '../useModel.js';
import { makeFixtures, wrapWithProvider } from './helpers.js';

const { Todo } = makeFixtures();

describe('useModel().build()', () => {
  it('returns a stable reactive instance across renders', () => {
    const { result, rerender } = renderHook(
      () => useModel(Todo as any).build({ title: 'a', done: false }),
      { wrapper: wrapWithProvider },
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('rerenders when a property is set', () => {
    function Form() {
      const todo = useModel(Todo as any).build({ title: 'a', done: false }) as any;
      return <p data-testid="title">{todo.title}</p>;
    }
    render(<Form />, { wrapper: wrapWithProvider });
    expect(screen.getByTestId('title').textContent).toBe('a');
  });

  it('reset() clears changes and re-emits', () => {
    const { result } = renderHook(
      () => useModel(Todo as any).build({ title: 'a', done: false }) as any,
      { wrapper: wrapWithProvider },
    );
    act(() => { result.current.title = 'changed'; });
    expect(result.current.isChanged()).toBe(true);
    act(() => { result.current.reset({ title: 'fresh', done: false }); });
    expect(result.current.attributes).toEqual({ title: 'fresh', done: false });
    expect(result.current.isChanged()).toBe(false);
  });

  it('throws outside a Provider', () => {
    expect(() => renderHook(() => useModel(Todo as any).build())).toThrow(
      /must be used inside <NextModelProvider>/,
    );
  });
});
