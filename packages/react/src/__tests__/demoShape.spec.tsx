import { act, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useInvalidateKeys, useModel } from '../index.js';
import { NextModelProvider } from '../Provider.js';
import { makeFixtures } from './helpers.js';

const { Todo, reset } = makeFixtures();

describe('demo-shape integration', () => {
  beforeEach(async () => {
    await reset();
    await Todo.create({ title: 'one', done: false });
  });

  it('parent watch updates when child saves + invalidates', async () => {
    function Parent() {
      const list = useModel(Todo as any)
        .orderBy({ key: 'id' })
        .watch({ keys: ['todos'] });
      if (list.isLoading) return <p>loading</p>;
      return (
        <div>
          <ul data-testid="list">
            {(list.data as any[]).map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
          <Form />
        </div>
      );
    }
    function Form() {
      const newTodo = useModel(Todo as any).build({ title: '', done: false }) as any;
      const invalidate = useInvalidateKeys();
      return (
        <button
          type="button"
          data-testid="add"
          onClick={async () => {
            newTodo.title = 'two';
            await newTodo.save();
            invalidate(['todos']);
            newTodo.reset({ title: '', done: false });
          }}
        >
          add
        </button>
      );
    }

    const view = render(
      <StrictMode>
        <NextModelProvider>
          <Parent />
        </NextModelProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(view.getByTestId('list').children.length).toBe(1));
    await act(async () => {
      view.getByTestId('add').click();
    });
    await waitFor(() => expect(view.getByTestId('list').children.length).toBe(2));
  });

  it('reset() detaches the build shell so subsequent saves are inserts', async () => {
    let draftRef: any = null;
    let invalidateRef: ((k: (string | symbol)[]) => void) | null = null;
    function Parent() {
      const list = useModel(Todo as any)
        .orderBy({ key: 'id' })
        .watch({ keys: ['todos'] });
      const draft = useModel(Todo as any).build({ title: '', done: false }) as any;
      const invalidate = useInvalidateKeys();
      draftRef = draft;
      invalidateRef = invalidate;
      if (list.isLoading) return <p>loading</p>;
      return (
        <ul data-testid="list">
          {(list.data as any[]).map((t) => (
            <li key={t.id}>{t.title}</li>
          ))}
        </ul>
      );
    }

    const view = render(
      <NextModelProvider>
        <Parent />
      </NextModelProvider>,
    );
    await waitFor(() => expect(view.getByTestId('list').children.length).toBe(1));

    // First add: alpha
    await act(async () => {
      draftRef.title = 'alpha';
      await draftRef.save();
      invalidateRef!(['todos']);
      draftRef.reset({ title: '', done: false });
    });
    await waitFor(() => expect(view.getByTestId('list').children.length).toBe(2));
    expect(view.getByTestId('list').textContent).toContain('one');
    expect(view.getByTestId('list').textContent).toContain('alpha');

    // Second add: beta. Without the build-shell-skip-softRegister fix, this
    // would either update 'alpha' in place OR the watch would render the
    // freshly-reset draft (empty) for the alpha row.
    await act(async () => {
      draftRef.title = 'beta';
      await draftRef.save();
      invalidateRef!(['todos']);
      draftRef.reset({ title: '', done: false });
    });
    await waitFor(() => expect(view.getByTestId('list').children.length).toBe(3));
    expect(view.getByTestId('list').textContent).toContain('one');
    expect(view.getByTestId('list').textContent).toContain('alpha');
    expect(view.getByTestId('list').textContent).toContain('beta');
  });

  it('parent watch updates in-place when child toggles + saves', async () => {
    function Parent() {
      const list = useModel(Todo as any)
        .orderBy({ key: 'id' })
        .watch();
      if (list.isLoading) return <p>loading</p>;
      return (
        <ul data-testid="list">
          {(list.data as any[]).map((t) => (
            <li key={t.id} data-testid={`item-${t.id}`}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={async () => {
                  t.done = !t.done;
                  await t.save();
                }}
              />
              {t.done ? 'DONE' : 'OPEN'}
            </li>
          ))}
        </ul>
      );
    }

    const view = render(
      <StrictMode>
        <NextModelProvider>
          <Parent />
        </NextModelProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(view.getByTestId('list').children.length).toBe(1));
    expect(view.getByTestId(/item-/).textContent).toContain('OPEN');
    const cb = view.container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => {
      cb.click();
    });
    await waitFor(() => expect(view.getByTestId(/item-/).textContent).toContain('DONE'));
  });
});
