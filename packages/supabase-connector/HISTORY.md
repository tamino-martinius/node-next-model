# History

## Unreleased

- Initial `@next-model/supabase-connector`: run the next-model query DSL against Supabase via `@supabase/supabase-js` (PostgREST).
- Fixed packaging: `MockSupabaseClient` is no longer re-exported from the main entry, keeping the dev-only `better-sqlite3` out of production installs. Import it from `@next-model/supabase-connector/mock-client` instead.
- Added CI (`test-supabase-connector`, hermetic — mock-backed, no service container), a package README with a capability matrix and known-limitations section, a runnable demo (`demos/node/server/supabase`), and the `next-model-supabase-connector` agent skill.
