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
