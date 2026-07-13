import type { Dict } from '@next-model/core';
import Database from 'better-sqlite3';
import type { PostgrestBuilderLike, PostgrestResult, SupabaseClientLike } from './types.js';

type Op = { column: string; op: string; value: unknown };

class MockQueryBuilder implements PostgrestBuilderLike {
  private mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private columns = '*';
  private wantCount = false;
  private headOnly = false;
  private wantRepresentation = false;
  private ops: Op[] = [];
  private orderSql = '';
  private limitSql = '';
  private values: Dict<any>[] = [];
  private updateValues: Dict<any> = {};
  private onConflict: string[] = [];
  private ignoreDuplicates = false;

  constructor(
    private db: Database.Database,
    private table: string,
  ) {}

  select(columns = '*', options: { count?: 'exact'; head?: boolean } = {}): this {
    if (this.mode === 'select') this.columns = columns;
    this.wantRepresentation = true;
    if (options.count === 'exact') this.wantCount = true;
    if (options.head) this.headOnly = true;
    return this;
  }
  insert(values: Dict<any> | Dict<any>[]): this {
    this.mode = 'insert';
    this.values = Array.isArray(values) ? values : [values];
    this.wantRepresentation = false;
    return this;
  }
  update(values: Dict<any>): this {
    this.mode = 'update';
    this.updateValues = values;
    return this;
  }
  delete(): this {
    this.mode = 'delete';
    return this;
  }
  upsert(
    values: Dict<any>[],
    options: { onConflict?: string; ignoreDuplicates?: boolean } = {},
  ): this {
    this.mode = 'upsert';
    this.values = Array.isArray(values) ? values : [values];
    this.onConflict = options.onConflict ? options.onConflict.split(',').map((s) => s.trim()) : [];
    this.ignoreDuplicates = options.ignoreDuplicates === true;
    return this;
  }
  private push(column: string, op: string, value: unknown): this {
    this.ops.push({ column, op, value });
    return this;
  }
  eq(c: string, v: unknown) {
    return this.push(c, '=', v);
  }
  neq(c: string, v: unknown) {
    return this.push(c, '!=', v);
  }
  gt(c: string, v: unknown) {
    return this.push(c, '>', v);
  }
  gte(c: string, v: unknown) {
    return this.push(c, '>=', v);
  }
  lt(c: string, v: unknown) {
    return this.push(c, '<', v);
  }
  lte(c: string, v: unknown) {
    return this.push(c, '<=', v);
  }
  like(c: string, v: string) {
    return this.push(c, 'LIKE', v);
  }
  ilike(c: string, v: string) {
    return this.push(c, 'LIKE', v);
  }
  in(c: string, v: unknown[]) {
    return this.push(c, 'IN', v);
  }
  is(c: string, _v: null) {
    return this.push(c, 'IS', null);
  }
  not(c: string, operator: string, v: unknown) {
    return this.push(c, `NOT ${operator.toUpperCase()}`, v);
  }
  or(filters: string) {
    return this.push('__or__', 'OR', filters);
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    const dir = options.ascending === false ? 'DESC' : 'ASC';
    this.orderSql += `${this.orderSql ? ', ' : ' ORDER BY '}"${column}" ${dir}`;
    return this;
  }
  limit(count: number) {
    this.limitSql = ` LIMIT ${Number(count)}`;
    return this;
  }
  range(from: number, to: number) {
    this.limitSql = ` LIMIT ${to - from + 1} OFFSET ${from}`;
    return this;
  }

  private whereClause(): { sql: string; params: unknown[] } {
    if (this.ops.length === 0) return { sql: '', params: [] };
    const params: unknown[] = [];
    const parts = this.ops.map((op) => {
      if (op.op === 'OR') {
        const alts = String(op.value)
          .split(',')
          .map((raw) => {
            const [col, o, val] = raw.split('.');
            const map: Dict<string> = {
              eq: '=',
              neq: '!=',
              gt: '>',
              gte: '>=',
              lt: '<',
              lte: '<=',
              like: 'LIKE',
            };
            params.push(o === 'like' ? val.replace(/\*/g, '%') : val);
            return `"${col}" ${map[o] ?? '='} ?`;
          });
        return `(${alts.join(' OR ')})`;
      }
      if (op.op === 'IS') return `"${op.column}" IS NULL`;
      if (op.op === 'NOT IS') return `"${op.column}" IS NOT NULL`;
      if (op.op === 'IN' || op.op === 'NOT IN') {
        const arr = op.value as unknown[];
        params.push(...arr);
        return `"${op.column}" ${op.op} (${arr.map(() => '?').join(', ')})`;
      }
      params.push(op.value);
      return `"${op.column}" ${op.op} ?`;
    });
    return { sql: ` WHERE ${parts.join(' AND ')}`, params };
  }

  private runSelect(): PostgrestResult {
    const where = this.whereClause();
    if (this.wantCount) {
      const row = this.db
        .prepare(`SELECT COUNT(*) AS n FROM "${this.table}"${where.sql}`)
        .get(...where.params) as { n: number };
      if (this.headOnly) return { data: [], error: null, count: row.n };
      const data = this.db
        .prepare(
          `SELECT ${this.columns} FROM "${this.table}"${where.sql}${this.orderSql}${this.limitSql}`,
        )
        .all(...where.params) as Dict<any>[];
      return { data, error: null, count: row.n };
    }
    const data = this.db
      .prepare(
        `SELECT ${this.columns} FROM "${this.table}"${where.sql}${this.orderSql}${this.limitSql}`,
      )
      .all(...where.params) as Dict<any>[];
    return { data, error: null, count: null };
  }

  private resolve(): PostgrestResult {
    try {
      if (this.mode === 'select') return this.runSelect();

      if (this.mode === 'insert') {
        const inserted: Dict<any>[] = [];
        for (const row of this.values) {
          const cols = Object.keys(row);
          const info = this.db
            .prepare(
              `INSERT INTO "${this.table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
            )
            .run(...cols.map((c) => row[c]));
          if (this.wantRepresentation) {
            inserted.push(
              this.db
                .prepare(`SELECT * FROM "${this.table}" WHERE rowid = ?`)
                .get(info.lastInsertRowid) as Dict<any>,
            );
          }
        }
        return { data: this.wantRepresentation ? inserted : null, error: null, count: null };
      }

      if (this.mode === 'update') {
        const where = this.whereClause();
        const before = this.db
          .prepare(`SELECT rowid AS __rowid__ FROM "${this.table}"${where.sql}`)
          .all(...where.params) as { __rowid__: number }[];
        const setCols = Object.keys(this.updateValues);
        this.db
          .prepare(
            `UPDATE "${this.table}" SET ${setCols.map((c) => `"${c}" = ?`).join(', ')}${where.sql}`,
          )
          .run(...setCols.map((c) => this.updateValues[c]), ...where.params);
        const data = this.wantRepresentation
          ? before.map(
              (r) =>
                this.db
                  .prepare(`SELECT * FROM "${this.table}" WHERE rowid = ?`)
                  .get(r.__rowid__) as Dict<any>,
            )
          : null;
        return { data, error: null, count: null };
      }

      if (this.mode === 'delete') {
        const where = this.whereClause();
        const removed = this.wantRepresentation
          ? (this.db
              .prepare(`SELECT * FROM "${this.table}"${where.sql}`)
              .all(...where.params) as Dict<any>[])
          : null;
        this.db.prepare(`DELETE FROM "${this.table}"${where.sql}`).run(...where.params);
        return { data: removed, error: null, count: null };
      }

      // upsert
      const returned: Dict<any>[] = [];
      for (const row of this.values) {
        const cols = Object.keys(row);
        const conflict = this.onConflict;
        const updates = cols.filter((c) => !conflict.includes(c));
        const conflictSql =
          this.ignoreDuplicates || updates.length === 0
            ? `ON CONFLICT(${conflict.map((c) => `"${c}"`).join(', ')}) DO NOTHING`
            : `ON CONFLICT(${conflict.map((c) => `"${c}"`).join(', ')}) DO UPDATE SET ${updates.map((c) => `"${c}" = excluded."${c}"`).join(', ')}`;
        this.db
          .prepare(
            `INSERT INTO "${this.table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ${conflictSql}`,
          )
          .run(...cols.map((c) => row[c]));
        if (this.wantRepresentation && conflict.length > 0) {
          const found = this.db
            .prepare(
              `SELECT * FROM "${this.table}" WHERE ${conflict.map((c) => `"${c}" = ?`).join(' AND ')}`,
            )
            .get(...conflict.map((c) => row[c])) as Dict<any> | undefined;
          if (found) returned.push(found);
        }
      }
      return { data: this.wantRepresentation ? returned : null, error: null, count: null };
    } catch (err) {
      return { data: null, error: { message: (err as Error).message }, count: null };
    }
  }

  // biome-ignore lint/suspicious/noThenProperty: MockQueryBuilder intentionally implements PromiseLike so it composes with await + .then, mirroring PostgrestFilterBuilder.
  then<R1 = PostgrestResult, R2 = never>(
    onfulfilled?: ((value: PostgrestResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

export class MockSupabaseClient implements SupabaseClientLike {
  private db: Database.Database;
  constructor() {
    this.db = new Database(':memory:');
  }
  exec(sql: string): void {
    this.db.exec(sql);
  }
  from(table: string): PostgrestBuilderLike {
    return new MockQueryBuilder(this.db, table);
  }
  close(): void {
    this.db.close();
  }
}
