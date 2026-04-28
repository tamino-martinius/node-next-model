import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { NextModelProvider } from '../Provider.js';
import { useModel } from '../useModel.js';
import { makeFixtures } from './helpers.js';

const { Todo, reset } = makeFixtures();

beforeEach(async () => {
  await reset();
  await Todo.create({ title: 'a', done: false });
});

describe('StrictMode', () => {
  it('refcount converges after StrictMode double-mount', async () => {
    function Watcher() {
      const { data, isLoading } = useModel(Todo as any).watch();
      return isLoading ? null : <p data-testid="n">{(data as unknown[]).length}</p>;
    }
    const view = render(
      <StrictMode>
        <NextModelProvider>
          <Watcher />
        </NextModelProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(view.getByTestId('n').textContent).toBe('1'));
    view.unmount();
    // No assertion failure / unhandled errors = clean teardown.
  });
});
