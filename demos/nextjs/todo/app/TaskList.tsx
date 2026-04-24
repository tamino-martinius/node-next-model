'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';

import { addTask, deleteTask, toggleTask } from './actions';

export interface TaskRow {
  id: number;
  userId: number;
  title: string;
  done: boolean;
}

type OptimisticAction =
  | { kind: 'add'; task: TaskRow }
  | { kind: 'toggle'; id: number }
  | { kind: 'delete'; id: number };

function applyAction(tasks: TaskRow[], action: OptimisticAction): TaskRow[] {
  switch (action.kind) {
    case 'add':
      return [...tasks, action.task];
    case 'toggle':
      return tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    case 'delete':
      return tasks.filter((t) => t.id !== action.id);
  }
}

export function TaskList({
  tasks,
  userId,
  userName,
}: {
  tasks: TaskRow[];
  userId: number | null;
  userName: string | undefined;
}) {
  const [optimistic, addOptimistic] = useOptimistic(tasks, applyAction);
  const [, startTransition] = useTransition();
  const tempIdRef = useRef(-1);

  const onAdd = (title: string) => {
    if (userId == null) return;
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      addOptimistic({
        kind: 'add',
        task: { id: tempIdRef.current--, userId, title: trimmed, done: false },
      });
      await addTask(userId, trimmed);
    });
  };

  const onToggle = (id: number) => {
    startTransition(async () => {
      addOptimistic({ kind: 'toggle', id });
      await toggleTask(id);
    });
  };

  const onDelete = (id: number) => {
    startTransition(async () => {
      addOptimistic({ kind: 'delete', id });
      await deleteTask(id);
    });
  };

  return (
    <section className="tasks">
      <h2>tasks {userName && <small>for {userName}</small>}</h2>
      <ul className="task-list">
        {optimistic.map((t) => (
          <li key={t.id} className={t.done ? 'done' : undefined}>
            <input type="checkbox" checked={t.done} onChange={() => onToggle(t.id)} />
            <span className="task-text">{t.title}</span>
            <button type="button" onClick={() => onDelete(t.id)} title="delete task">
              ×
            </button>
          </li>
        ))}
        {optimistic.length === 0 && userName && (
          <li className="muted">(no tasks for {userName})</li>
        )}
        {!userName && <li className="muted">(create a user first)</li>}
      </ul>
      {userName && <AddForm placeholder={`add task for ${userName}`} onAdd={onAdd} />}
    </section>
  );
}

function AddForm({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onAdd(trimmed);
        setValue('');
      }}
    >
      <input
        name="text"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit">add</button>
    </form>
  );
}
