# History

## vNext

### Initial release

- New `@next-model/mariadb-connector` package: thin extension of `@next-model/mysql-connector` that takes advantage of MariaDB-specific features.
- Reuses the `mysql2/promise` driver (wire-compatible with MariaDB), the same connection pool, identifier quoting, filter compilation, and transaction handling as the MySQL connector.
- Overrides `batchInsert` to use `INSERT … RETURNING *` (MariaDB 10.5+) and `deleteAll` to use `DELETE … RETURNING *` (MariaDB 10.0+), so those methods skip the up-front `SELECT` capture and the consecutive auto-increment id-expansion trick the MySQL connector needs. `updateAll` is **not** overridden — MariaDB does not support `UPDATE … RETURNING`, so it falls through to the parent's SELECT-then-UPDATE implementation.
- Overrides `createTable` for the `json` column kind: MariaDB's `JSON` is an alias for `LONGTEXT`, so the connector emits `LONGTEXT CHECK (JSON_VALID(...))` to keep the validation guarantee MySQL's native `JSON` provides.
- Validated through the shared `runModelConformance` suite + RETURNING-specific tests against a real MariaDB 11 service container in CI.
