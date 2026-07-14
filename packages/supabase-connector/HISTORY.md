# History

## vNext

### Added

- Initial `@next-model/supabase-connector`: runs the next-model query DSL against Supabase via `@supabase/supabase-js` (PostgREST). One connector for both server (service_role) and browser (anon) usage — construction accepts a `SupabaseClient`, a `{ client }` wrapper, or `{ url, key, options }`. Translates `query`, `count`, `select`, `batchInsert`, `updateAll`, `deleteAll`, `upsert`, `aggregate`, `deltaUpdate`, `queryScoped`, and the full `Filter` operator set to PostgREST. Unbounded reads paginate around PostgREST's max-rows cap (configurable `pageSize`).
- `MockSupabaseClient` (better-sqlite3-backed) exported from the `./mock-client` subpath for hermetic tests — kept off the package's main entry so the dev-only `better-sqlite3` never loads for production consumers. Tests run against the mock by default and, when `SUPABASE_URL`/keys are set, against a real Supabase/PostgREST via an opt-in live harness.
- Package README with a capability matrix and known-limitations section, a mock-backed demo (`demos/node/server/supabase`), and the `next-model-supabase-connector` skill.

### Notes

- DDL (`createTable`/`dropTable`/`hasTable`/`alterTable`/`ensureSchema`), raw `execute`, and `transaction` throw `UnsupportedOperationError` — PostgREST cannot run them. Manage schema with Supabase migrations. `aggregate` reduces fetched values client-side and `deltaUpdate` is a non-atomic SELECT-then-UPDATE.
