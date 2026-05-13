'use client';

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';

import { createUser, deleteUser, renameUser, setCurrentUser } from './actions';

export interface UserRow {
  id: number;
  name: string;
}

type OptimisticAction =
  | { kind: 'add'; user: UserRow }
  | { kind: 'rename'; id: number; name: string }
  | { kind: 'delete'; id: number };

function applyAction(users: UserRow[], action: OptimisticAction): UserRow[] {
  switch (action.kind) {
    case 'add':
      return [...users, action.user];
    case 'rename':
      return users.map((u) => (u.id === action.id ? { ...u, name: action.name } : u));
    case 'delete':
      return users.filter((u) => u.id !== action.id);
  }
}

export function UserList({
  users,
  currentUserName,
}: {
  users: UserRow[];
  currentUserName: string | undefined;
}) {
  const [optimistic, addOptimistic] = useOptimistic(users, applyAction);
  const [, startTransition] = useTransition();
  const tempIdRef = useRef(-1);

  const onAdd = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      addOptimistic({ kind: 'add', user: { id: tempIdRef.current--, name: trimmed } });
      await createUser(trimmed);
    });
  };

  const onRename = (id: number, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      addOptimistic({ kind: 'rename', id, name: trimmed });
      await renameUser(id, trimmed);
    });
  };

  const onDelete = (id: number) => {
    if (!confirm('Delete this user and all their tasks?')) return;
    startTransition(async () => {
      addOptimistic({ kind: 'delete', id });
      await deleteUser(id);
    });
  };

  const onSelect = (name: string) => {
    startTransition(async () => {
      await setCurrentUser(name);
    });
  };

  return (
    <section className="users">
      <h2>users</h2>
      <ul className="user-list">
        {optimistic.map((u) => (
          <UserRowItem
            key={u.id}
            user={u}
            active={u.name === currentUserName}
            onSelect={() => onSelect(u.name)}
            onRename={(next) => onRename(u.id, next)}
            onDelete={() => onDelete(u.id)}
          />
        ))}
        {optimistic.length === 0 && <li className="muted">(no users yet — add one below)</li>}
      </ul>
      <AddForm placeholder="add user" onAdd={onAdd} />
    </section>
  );
}

function UserRowItem({
  user,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  user: UserRow;
  active: boolean;
  onSelect: () => void;
  onRename: (next: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(user.name);
  }, [editing, user.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== user.name) onRename(next);
  };

  return (
    <li className={active ? 'active' : undefined}>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') {
              setDraft(user.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="user-name"
          onClick={onSelect}
          onDoubleClick={() => setEditing(true)}
          title="double-click to rename"
        >
          {user.name}
        </button>
      )}
      {!editing && (
        <>
          <button type="button" onClick={() => setEditing(true)} title="rename">
            ✎
          </button>
          <button type="button" onClick={onDelete} title="delete user">
            ×
          </button>
        </>
      )}
    </li>
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
