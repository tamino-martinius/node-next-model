# memory-node

Plain Node demo of `@next-model/core`'s built-in `MemoryConnector`. No external infrastructure — runs end-to-end in process memory.

```sh
pnpm install
pnpm start
```

What it shows:

- `Model({...})` with named scopes
- Schema DSL via `connector.createTable(...)`
- CRUD: create, update, reload, delete
- Filter chains (`adults().orderBy({key:'age'})`)
- Aggregates (`count`, `avg`)
- Associations (`hasMany`)
- Cursor pagination (`paginateCursor({ after, limit })`)
- Transactions (with rollback semantics)
