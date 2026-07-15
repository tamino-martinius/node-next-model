import type { Dict } from '@next-model/core';
import Database from 'better-sqlite3';
import type { PostgrestBuilderLike, PostgrestResult, SupabaseClientLike } from './types.js';

type Op = { column: string; op: string; value: unknown; notOp?: string };

/**
 * Undo `pgrstValue`'s quoting (see `filters.ts`): if `raw` (already trimmed)
 * is wrapped in double quotes, strip them and unescape `\"` → `"` and
 * `\\` → `\`. Otherwise return it as-is.
 */
function unquotePgrstValue(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  return s;
}

/**
 * Normalize the value passed to an `in`/`not(...,'in',...)` filter into an array.
 * Accepts a JS array as-is, or the PostgREST string form `'(a,b,c)'` (leading `(`
 * and trailing `)` stripped, split on top-level commas — a comma inside a
 * double-quoted element does not split — each element unquoted).
 */
function parseInValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const inner = value.replace(/^\(/, '').replace(/\)$/, '');
    return splitTopLevel(inner, ',').map(unquotePgrstValue);
  }
  return [value];
}

/** PostgREST condition operator → SQL operator, shared by the `or()` parser. */
const OR_CONDITION_OPS: Dict<string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
};

/**
 * Split `input` on top-level occurrences of `separator` only — commas nested
 * inside `(...)` (e.g. the body of an `and(...)` group) do not split, and
 * neither do separators/parens found inside a `"..."` quoted value (the form
 * `pgrstValue` — see `filters.ts` — produces for values containing reserved
 * characters). A `\"` inside the quotes is an escaped quote, not a boundary.
 */
function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"' && input[i - 1] !== '\\') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === separator && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

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
    this.ops.push({ column: c, op: 'not', notOp: operator.toLowerCase(), value: v });
    return this;
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
        const parseCondition = (raw: string) => {
          // Only the first two dots delimit `col` and `op` — the remainder
          // is the value verbatim, since a quoted value (`pgrstValue`, see
          // `filters.ts`) may itself contain dots/commas.
          const firstDot = raw.indexOf('.');
          const secondDot = raw.indexOf('.', firstDot + 1);
          const col = raw.slice(0, firstDot);
          const o = raw.slice(firstDot + 1, secondDot);
          const val = unquotePgrstValue(raw.slice(secondDot + 1));
          params.push(o === 'like' ? val.replace(/\*/g, '%') : val);
          return `"${col}" ${OR_CONDITION_OPS[o] ?? '='} ?`;
        };
        // Split on TOP-LEVEL commas only — commas inside an `and(...)` group
        // must not shatter the group (PostgREST's `or(and(...),...)` syntax).
        const alts = splitTopLevel(String(op.value), ',').map((part) => {
          const andMatch = part.match(/^and\((.*)\)$/);
          if (andMatch) {
            const inner = splitTopLevel(andMatch[1], ',').map(parseCondition);
            return `(${inner.join(' AND ')})`;
          }
          return parseCondition(part);
        });
        return `(${alts.join(' OR ')})`;
      }
      if (op.op === 'not') {
        const notOp = op.notOp ?? 'eq';
        if (notOp === 'is') return `"${op.column}" IS NOT NULL`;
        if (notOp === 'in') {
          const arr = parseInValues(op.value);
          params.push(...arr);
          return `"${op.column}" NOT IN (${arr.map(() => '?').join(', ')})`;
        }
        if (notOp === 'like' || notOp === 'ilike') {
          params.push(op.value);
          return `"${op.column}" NOT LIKE ?`;
        }
        const negated: Dict<string> = {
          eq: '<>',
          neq: '=',
          gt: '<=',
          gte: '<',
          lt: '>=',
          lte: '>',
        };
        params.push(op.value);
        return `"${op.column}" ${negated[notOp] ?? '<>'} ?`;
      }
      if (op.op === 'IS') return `"${op.column}" IS NULL`;
      if (op.op === 'IN') {
        const arr = parseInValues(op.value);
        params.push(...arr);
        return `"${op.column}" IN (${arr.map(() => '?').join(', ')})`;
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
