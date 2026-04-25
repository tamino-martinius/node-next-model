import type {
  BaseType,
  ColumnDefinition,
  Dict,
  KeyType,
  Scope,
  TableBuilder,
  UpsertSpec,
} from '@next-model/core';
import { defineTable, PersistenceError } from '@next-model/core';
import { MysqlConnector, quoteIdent } from '@next-model/mysql-connector';

/**
 * MariaDB connector. Wire-compatible with the MySQL protocol so it reuses
 * `MysqlConnector`'s pool, identifier quoting, and filter compilation, but
 * overrides `batchInsert` and `deleteAll` to use MariaDB's `RETURNING`
 * clause — `INSERT … RETURNING *` (10.5+) and `DELETE … RETURNING *`
 * (10.0+). MariaDB does **not** support `UPDATE … RETURNING`, so
 * `updateAll` falls through to the parent's SELECT-then-UPDATE approach.
 *
 * Schema DDL is also tweaked: MariaDB's `JSON` is an alias for `LONGTEXT`,
 * so the connector emits `LONGTEXT CHECK (JSON_VALID(...))` to get the
 * same validation guarantee you get from MySQL's native JSON type.
 */
export class MariaDbConnector extends MysqlConnector {
  async batchInsert(
    tableName: string,
    _keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    const allKeys = new Set<string>();
    for (const item of items) for (const k of Object.keys(item)) allKeys.add(k);
    const cols = Array.from(allKeys);
    if (cols.length === 0) {
      return (await this.run(
        `INSERT INTO ${quoteIdent(tableName)} () VALUES () RETURNING *`,
      )) as Dict<any>[];
    }
    const params: BaseType[] = [];
    const valueRows: string[] = [];
    for (const item of items) {
      const placeholders = cols.map((c) => {
        params.push(item[c] as BaseType);
        return '?';
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const sql = `INSERT INTO ${quoteIdent(tableName)} (${cols
      .map(quoteIdent)
      .join(', ')}) VALUES ${valueRows.join(', ')} RETURNING *`;
    const rows = (await this.run(sql, params)) as Dict<any>[];
    if (rows.length === 0) {
      throw new PersistenceError(`batchInsert into ${tableName} returned no rows`);
    }
    return rows;
  }

  async upsert(spec: UpsertSpec): Promise<Dict<any>[]> {
    if (spec.rows.length === 0) return [];
    const allKeys = new Set<string>();
    for (const row of spec.rows) for (const k of Object.keys(row)) allKeys.add(k);
    const cols = Array.from(allKeys);
    const updateColumns =
      spec.updateColumns ?? cols.filter((c: string) => !spec.conflictTarget.includes(c));
    const ignore = spec.ignoreOnly === true || updateColumns.length === 0;

    const params: BaseType[] = [];
    const valueRows: string[] = [];
    for (const row of spec.rows) {
      const placeholders = cols.map((c) => {
        params.push(row[c] as BaseType);
        return '?';
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const ignorePrefix = ignore ? 'IGNORE ' : '';
    let sql = `INSERT ${ignorePrefix}INTO ${quoteIdent(spec.tableName)} (${cols
      .map(quoteIdent)
      .join(', ')}) VALUES ${valueRows.join(', ')}`;
    if (!ignore) {
      sql += ` ON DUPLICATE KEY UPDATE ${updateColumns
        .map((c: string) => `${quoteIdent(c)} = VALUES(${quoteIdent(c)})`)
        .join(', ')}`;
    }
    sql += ' RETURNING *';
    const inserted = (await this.run(sql, params)) as Dict<any>[];

    // RETURNING on MariaDB only emits inserted rows; UPDATE-on-conflict and
    // IGNORE-skipped rows aren't returned. Backfill via SELECT.
    const tupleKey = (row: Dict<any>) =>
      spec.conflictTarget.map((c: string) => JSON.stringify(row[c])).join('|');
    const byTuple = new Map<string, Dict<any>>();
    for (const row of inserted) byTuple.set(tupleKey(row), row);
    const missing = spec.rows.filter((r) => !byTuple.has(tupleKey(r)));
    if (missing.length > 0) {
      const fetched = await this.selectByConflict(spec.tableName, spec.conflictTarget, missing);
      for (const row of fetched) byTuple.set(tupleKey(row), row);
    }
    return spec.rows
      .map((row: Dict<any>) => byTuple.get(tupleKey(row)))
      .filter((row: Dict<any> | undefined): row is Dict<any> => row !== undefined);
  }

  private async selectByConflict(
    tableName: string,
    conflictTarget: string[],
    rows: Dict<any>[],
  ): Promise<Dict<any>[]> {
    const params: BaseType[] = [];
    let where: string;
    if (conflictTarget.length === 1) {
      const [col] = conflictTarget;
      const placeholders = rows.map((r) => {
        params.push(r[col] as BaseType);
        return '?';
      });
      where = `${quoteIdent(col)} IN (${placeholders.join(', ')})`;
    } else {
      where = rows
        .map((r) => {
          const parts = conflictTarget.map((c) => {
            params.push(r[c] as BaseType);
            return `${quoteIdent(c)} = ?`;
          });
          return `(${parts.join(' AND ')})`;
        })
        .join(' OR ');
    }
    return (await this.run(
      `SELECT * FROM ${quoteIdent(tableName)} WHERE ${where}`,
      params,
    )) as Dict<any>[];
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const where = this.buildWhere(scope.filter);
    let sql = `DELETE FROM ${quoteIdent(scope.tableName)}`;
    if (where.sql) sql += ` WHERE ${where.sql}`;
    sql += ' RETURNING *';
    return (await this.run(sql, where.params)) as Dict<any>[];
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    const def = defineTable(tableName, blueprint);
    if (await this.hasTable(tableName)) return;
    const colSql: string[] = [];
    for (const col of def.columns) colSql.push(this.mariaColumnDdl(col));
    const sql = `CREATE TABLE ${quoteIdent(tableName)} (${colSql.join(', ')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
    await this.runMutation(sql);
    for (const idx of def.indexes) {
      const cols = idx.columns.map(quoteIdent).join(', ');
      const name = quoteIdent(idx.name ?? `idx_${tableName}_${idx.columns.join('_')}`);
      const unique = idx.unique ? 'UNIQUE ' : '';
      await this.runMutation(`CREATE ${unique}INDEX ${name} ON ${quoteIdent(tableName)} (${cols})`);
    }
  }

  private mariaColumnDdl(col: ColumnDefinition): string {
    const parts: string[] = [quoteIdent(col.name)];
    if (col.autoIncrement) {
      parts.push('INT NOT NULL AUTO_INCREMENT PRIMARY KEY');
    } else {
      parts.push(this.mariaColumnType(col));
      if (!col.nullable) parts.push('NOT NULL');
      if (col.primary) parts.push('PRIMARY KEY');
      if (col.unique && !col.primary) parts.push('UNIQUE');
    }
    if (col.default !== undefined && !col.autoIncrement) {
      parts.push(`DEFAULT ${this.mariaDefaultLiteral(col.default)}`);
    }
    return parts.join(' ');
  }

  private mariaColumnType(col: ColumnDefinition): string {
    switch (col.type) {
      case 'string':
        return `VARCHAR(${col.limit ?? 255})`;
      case 'text':
        return 'TEXT';
      case 'integer':
        return 'INT';
      case 'bigint':
        return 'BIGINT';
      case 'float':
        return 'FLOAT';
      case 'decimal':
        return col.precision !== undefined
          ? `DECIMAL(${col.precision}${col.scale !== undefined ? `, ${col.scale}` : ''})`
          : 'DECIMAL';
      case 'boolean':
        return 'TINYINT(1)';
      case 'date':
        return 'DATE';
      case 'datetime':
      case 'timestamp':
        return 'DATETIME';
      case 'json':
        // MariaDB's JSON is an alias for LONGTEXT; the CHECK constraint
        // gives back the validation guarantee you get from MySQL's native JSON.
        return `LONGTEXT CHECK (JSON_VALID(${quoteIdent(col.name)}))`;
    }
  }

  private mariaDefaultLiteral(value: ColumnDefinition['default']): string {
    if (value === 'currentTimestamp') return 'CURRENT_TIMESTAMP';
    if (value === null) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}
