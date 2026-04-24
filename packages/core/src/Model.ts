import { NotFoundError, PersistenceError, ValidationError } from './errors.js';
import { normalizeFilterShape } from './FilterEngine.js';
import { MemoryConnector } from './MemoryConnector.js';
import {
  type AggregateKind,
  type Callback,
  type Callbacks,
  type Connector,
  type Dict,
  type Filter,
  KeyType,
  type Order,
  type OrderColumn,
  type Schema,
  type Scope,
  SortDirection,
  type Validator,
} from './types.js';
import { camelize, pascalize, singularize } from './util.js';

export type AssociationOptions = {
  foreignKey?: string;
  primaryKey?: string;
  polymorphic?: string;
  typeKey?: string;
  typeValue?: string;
};

export type IncludeSpec =
  | { belongsTo: typeof ModelClass; foreignKey: string; primaryKey?: string }
  | { hasMany: typeof ModelClass; foreignKey: string; primaryKey?: string }
  | { hasOne: typeof ModelClass; foreignKey: string; primaryKey?: string };

export type IncludeMap = Record<string, IncludeSpec>;

export type HasManyThroughOptions = {
  throughForeignKey?: string;
  targetForeignKey?: string;
  selfPrimaryKey?: string;
  targetPrimaryKey?: string;
};

function encodeCursor(value: unknown, key: string): string {
  return Buffer.from(JSON.stringify({ [key]: value }), 'utf8').toString('base64url');
}

function encodeCompositeCursor(fields: Dict<unknown>): string {
  return Buffer.from(JSON.stringify(fields), 'utf8').toString('base64url');
}

function decodeCompositeCursor(token: string): Dict<unknown> {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object') return parsed as Dict<unknown>;
    throw new PersistenceError(`Invalid pagination cursor: ${token}`);
  } catch (err) {
    if (err instanceof PersistenceError) throw err;
    throw new PersistenceError(`Invalid pagination cursor: ${token}`);
  }
}

type TimestampsOption = boolean | { createdAt?: boolean | string; updatedAt?: boolean | string };

type SoftDeleteOption = boolean | string | { column?: string };

function resolveTimestampColumn(
  value: boolean | string | undefined,
  defaultName: string,
): string | undefined {
  if (value === false) return undefined;
  if (value === undefined || value === true) return defaultName;
  return value;
}

export function resolveTimestampColumns(option: TimestampsOption | undefined): {
  createdAtColumn: string | undefined;
  updatedAtColumn: string | undefined;
} {
  if (option === false) return { createdAtColumn: undefined, updatedAtColumn: undefined };
  if (option === undefined || option === true) {
    return { createdAtColumn: 'createdAt', updatedAtColumn: 'updatedAt' };
  }
  return {
    createdAtColumn: resolveTimestampColumn(option.createdAt, 'createdAt'),
    updatedAtColumn: resolveTimestampColumn(option.updatedAt, 'updatedAt'),
  };
}

async function applyIncludes(records: ModelClass[], map: IncludeMap): Promise<void> {
  if (records.length === 0) return;
  for (const [name, spec] of Object.entries(map)) {
    if ('belongsTo' in spec) {
      const preloaded = await (spec.belongsTo as typeof ModelClass).preloadBelongsTo(records, {
        foreignKey: spec.foreignKey,
        primaryKey: spec.primaryKey,
      });
      for (const record of records) {
        const attrs = record.attributes() as Dict<any>;
        const fk = attrs[spec.foreignKey];
        (record as unknown as Dict<unknown>)[name] = fk == null ? undefined : preloaded.get(fk);
      }
    } else if ('hasMany' in spec) {
      const selfPk = spec.primaryKey ?? 'id';
      const preloaded = await (spec.hasMany as typeof ModelClass).preloadHasMany(records, {
        foreignKey: spec.foreignKey,
        primaryKey: selfPk,
      });
      for (const record of records) {
        const attrs = record.attributes() as Dict<any>;
        const id = attrs[selfPk];
        (record as unknown as Dict<unknown>)[name] = preloaded.get(id) ?? [];
      }
    } else if ('hasOne' in spec) {
      const selfPk = spec.primaryKey ?? 'id';
      const preloaded = await (spec.hasOne as typeof ModelClass).preloadHasMany(records, {
        foreignKey: spec.foreignKey,
        primaryKey: selfPk,
      });
      for (const record of records) {
        const attrs = record.attributes() as Dict<any>;
        const id = attrs[selfPk];
        (record as unknown as Dict<unknown>)[name] = preloaded.get(id)?.[0];
      }
    }
  }
}

export function resolveSoftDelete(option: SoftDeleteOption | undefined): {
  softDeleteMode: 'active' | 'only' | false;
  softDeleteColumn: string;
} {
  if (option === undefined || option === false) {
    return { softDeleteMode: false, softDeleteColumn: 'discardedAt' };
  }
  if (option === true) {
    return { softDeleteMode: 'active', softDeleteColumn: 'discardedAt' };
  }
  if (typeof option === 'string') {
    return { softDeleteMode: 'active', softDeleteColumn: option };
  }
  return { softDeleteMode: 'active', softDeleteColumn: option.column ?? 'discardedAt' };
}

export type ScopeFn<Self> = (self: Self, ...args: any[]) => Self;

export type ScopeMap<Self> = Dict<ScopeFn<Self>>;

export type ScopesToMethods<Self, S extends ScopeMap<Self>> = {
  [K in keyof S]: (...args: S[K] extends (self: any, ...rest: infer R) => any ? R : never) => Self;
};

export class ModelClass {
  static tableName: string;
  static filter: Filter<any> | undefined;
  static limit: number | undefined;
  static skip: number | undefined;
  static order: OrderColumn<any>[];
  static keys: Dict<KeyType>;
  static connector: Connector;
  static init: (props: any) => Dict<any>;
  /**
   * When set, the Model writes the current timestamp to this column on
   * create. Set to `undefined` (via `timestamps: false` or
   * `timestamps: { createdAt: false }`) to disable.
   */
  static createdAtColumn: string | undefined = 'createdAt';
  /**
   * When set, the Model writes the current timestamp to this column on
   * create, save, and `touch()`. `undefined` to disable.
   */
  static updatedAtColumn: string | undefined = 'updatedAt';
  /** Column used by `discard()` / `restore()` + the soft-delete scope. */
  static softDeleteColumn: string = 'discardedAt';
  static softDelete: 'active' | 'only' | false = false;
  /**
   * Map of column → allowed enum values, populated by the `enums: {...}` factory
   * option. Each value generates a chainable class scope and an instance
   * predicate; out-of-range values fail `isValid()`.
   */
  static enums: Dict<readonly string[]> = {};
  /**
   * When set, `all()` / `first()` / `last()` / `find()` / `findBy()` fetch
   * only these columns (plus every primary key) from the connector. Model
   * instances are still returned; they just carry partial data. Set via the
   * `fields(...keys)` chainable.
   */
  static selectedFields: string[] | undefined = undefined;
  /**
   * When set, `all()` eager-loads the declared associations after the main
   * fetch and attaches them as properties on every returned instance. See
   * `Model.includes({...})` for details.
   */
  static selectedIncludes: IncludeMap | undefined = undefined;
  static validators: Validator<any>[] = [];
  static callbacks: Callbacks<any> = {};

  static async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.connector.transaction(fn);
  }

  static modelScope() {
    let filter = this.filter;
    const softColumn = this.softDeleteColumn;
    if (this.softDelete === 'active') {
      filter = filter ? { $and: [{ $null: softColumn }, filter] } : { $null: softColumn };
    } else if (this.softDelete === 'only') {
      filter = filter ? { $and: [{ $notNull: softColumn }, filter] } : { $notNull: softColumn };
    }
    return {
      tableName: this.tableName,
      filter,
      limit: this.limit,
      skip: this.skip,
      order: this.order,
    } as Scope;
  }

  static limitBy<M extends typeof ModelClass>(this: M, amount: number) {
    return class extends (this as typeof ModelClass) {
      static limit = amount;
    } as M;
  }

  static unlimited<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static limit = undefined;
    } as M;
  }

  static skipBy<M extends typeof ModelClass>(this: M, amount: number) {
    return class extends (this as typeof ModelClass) {
      static skip = amount;
    } as M;
  }

  static unskipped<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static skip = undefined;
    } as M;
  }

  static orderBy<M extends typeof ModelClass>(this: M, order: Order<any>) {
    const newOrder = [...this.order, ...(Array.isArray(order) ? order : [order])];
    return class extends (this as typeof ModelClass) {
      static order = newOrder;
    } as M;
  }

  static unordered<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static order: OrderColumn<any>[] = [];
    } as M;
  }

  static reorder<M extends typeof ModelClass>(this: M, order: Order<any>) {
    return class extends (this as typeof ModelClass) {
      static order = Array.isArray(order) ? order : [order];
    } as M;
  }

  static filterBy<M extends typeof ModelClass>(this: M, andFilterInput: Filter<any>) {
    const andFilter = normalizeFilterShape(andFilterInput);
    const hasSpecial = (f: Filter<any>) => Object.keys(f).some((k) => k.startsWith('$'));
    let filter: Filter<any> | undefined = andFilter;
    if (this.filter) {
      if (hasSpecial(this.filter) || hasSpecial(andFilter)) {
        filter = { $and: [this.filter, andFilter] };
      } else {
        for (const key in this.filter) {
          if ((this.filter as any)[key] !== undefined && (andFilter as any)[key] !== undefined) {
            filter = { $and: [filter, andFilter] };
            break;
          }
          (filter as any)[key] = (this.filter as any)[key];
        }
      }
    }
    if (Object.keys(andFilter).length === 0) filter = this.filter;
    return class extends (this as typeof ModelClass) {
      static filter = filter;
    } as M;
  }

  static orFilterBy<M extends typeof ModelClass>(this: M, orFilterInput: Filter<any>) {
    const orFilter = normalizeFilterShape(orFilterInput);
    const filter =
      Object.keys(orFilter).length === 0
        ? this.filter
        : this.filter
          ? { $or: [this.filter, orFilter] }
          : orFilter;
    return class extends (this as typeof ModelClass) {
      static filter = filter;
    } as M;
  }

  static unfiltered<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static filter = undefined;
    } as M;
  }

  static reverse<M extends typeof ModelClass>(this: M) {
    const primaryKey = Object.keys(this.keys)[0] ?? 'id';
    const existing = this.order.length > 0 ? this.order : [{ key: primaryKey }];
    const flipped = existing.map((col) => ({
      key: col.key,
      dir:
        (col.dir ?? SortDirection.Asc) === SortDirection.Asc
          ? SortDirection.Desc
          : SortDirection.Asc,
    }));
    return class extends (this as typeof ModelClass) {
      static order = flipped;
    } as M;
  }

  static unscoped<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static filter = undefined;
      static limit = undefined;
      static skip = undefined;
      static order: OrderColumn<any>[] = [];
      static softDelete: 'active' | 'only' | false = false;
      static selectedFields: string[] | undefined = undefined;
      static selectedIncludes: IncludeMap | undefined = undefined;
    } as M;
  }

  /**
   * Restrict subsequent `all()` / `first()` / `last()` / `find()` / `findBy()`
   * fetches to the given columns. The Model's primary key(s) are always
   * included even when omitted from the list so instances can still save,
   * reload and delete.
   */
  static fields<M extends typeof ModelClass>(this: M, ...keys: string[]) {
    return class extends (this as typeof ModelClass) {
      static selectedFields = keys;
    } as M;
  }

  static allFields<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static selectedFields: string[] | undefined = undefined;
    } as M;
  }

  static on(event: keyof Callbacks<any>, handler: Callback<any>): () => void {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    const list = this.callbacks[event] as Callback<any>[];
    list.push(handler);
    return () => {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  static withDiscarded<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static softDelete: 'active' | 'only' | false = false;
    } as M;
  }

  static onlyDiscarded<M extends typeof ModelClass>(this: M) {
    return class extends (this as typeof ModelClass) {
      static softDelete: 'active' | 'only' | false = 'only';
    } as M;
  }

  static build<M extends typeof ModelClass>(this: M, createProps: any) {
    return new this(this.init(createProps)) as InstanceType<M>;
  }

  static buildScoped<M extends typeof ModelClass>(this: M, createProps: any) {
    return new this(this.init({ ...this.filter, ...createProps })) as InstanceType<M>;
  }

  static create<M extends typeof ModelClass>(this: M, createProps: any) {
    return this.build<M>(createProps).save();
  }

  static createScoped<M extends typeof ModelClass>(this: M, props: any) {
    return this.buildScoped<M>(props).save();
  }

  static async createMany<M extends typeof ModelClass>(this: M, propsList: any[]) {
    const now = new Date();
    const createdCol = this.createdAtColumn;
    const updatedCol = this.updatedAtColumn;
    const insertProps = propsList.map((p) => {
      const base = this.init(p) as Dict<any>;
      if (createdCol && base[createdCol] === undefined) base[createdCol] = now;
      if (updatedCol && base[updatedCol] === undefined) base[updatedCol] = now;
      return base;
    });
    const items = await this.connector.batchInsert(this.tableName, this.keys, insertProps);
    return items.map((item) => {
      const keys: Dict<any> = {};
      for (const key in this.keys) {
        keys[key] = item[key];
        delete item[key];
      }
      return new this(item, keys) as InstanceType<M>;
    });
  }

  /**
   * Declare associations to eager-load alongside subsequent `all()` / `first()`
   * / `last()` / `find()` calls. Each map entry names the property to attach
   * on each returned instance and how to load it.
   *
   * @example
   * const posts = await Post.includes({
   *   user: { belongsTo: User, foreignKey: 'userId' },
   *   comments: { hasMany: Comment, foreignKey: 'postId' },
   * }).all();
   * posts[0].user       // User instance (pre-loaded; no extra round-trip)
   * posts[0].comments   // Comment[]    (pre-loaded)
   *
   * Without `includes(...)` the same associations work as before — the
   * Rails-style `this.belongsTo(User)` / `this.hasMany(Comment)` helpers
   * on each instance still return a `Promise` (lazy load). `includes(...)`
   * is the opt-in to eager-load and cut N+1 round-trips when you know up
   * front which associations every row needs.
   */
  static includes<M extends typeof ModelClass>(this: M, map: IncludeMap): M {
    const previous = this.selectedIncludes ?? {};
    const next = { ...previous, ...map };
    return class extends (this as typeof ModelClass) {
      static selectedIncludes = next;
    } as M;
  }

  static withoutIncludes<M extends typeof ModelClass>(this: M): M {
    return class extends (this as typeof ModelClass) {
      static selectedIncludes: IncludeMap | undefined = undefined;
    } as M;
  }

  static async all<M extends typeof ModelClass>(this: M) {
    const primaryKeys = Object.keys(this.keys);
    const items = this.selectedFields
      ? await this.connector.select(
          this.modelScope(),
          ...Array.from(new Set([...primaryKeys, ...this.selectedFields])),
        )
      : await this.connector.query(this.modelScope());
    const records = items.map((item) => {
      const keys: Dict<any> = {};
      for (const key of primaryKeys) {
        keys[key] = item[key];
        delete item[key];
      }
      return new this(item, keys) as InstanceType<M>;
    });
    if (this.selectedIncludes) {
      await applyIncludes(records, this.selectedIncludes);
    }
    return records;
  }

  static async first<M extends typeof ModelClass>(this: M) {
    const items = await this.limitBy(1).all<M>();
    return items.pop();
  }

  static async last<M extends typeof ModelClass>(this: M) {
    return (this.reverse() as M).first<M>();
  }

  static async *inBatchesOf<M extends typeof ModelClass>(
    this: M,
    size: number,
  ): AsyncGenerator<InstanceType<M>[], void, void> {
    const batchSize = Math.max(1, Math.floor(size));
    const primaryKey = Object.keys(this.keys)[0] ?? 'id';
    const ordered = this.order.length > 0 ? this : this.orderBy({ key: primaryKey });
    const baseSkip = this.skip ?? 0;
    const totalLimit = this.limit;
    let offset = 0;
    while (true) {
      const remaining = totalLimit === undefined ? batchSize : totalLimit - offset;
      if (remaining <= 0) return;
      const take = Math.min(batchSize, remaining);
      const batch = await ordered
        .unlimited()
        .unskipped()
        .skipBy(baseSkip + offset)
        .limitBy(take)
        .all<M>();
      if (batch.length === 0) return;
      yield batch;
      if (batch.length < take) return;
      offset += batch.length;
    }
  }

  static async *findEach<M extends typeof ModelClass>(
    this: M,
    size = 100,
  ): AsyncGenerator<InstanceType<M>, void, void> {
    for await (const batch of this.inBatchesOf<M>(size)) {
      for (const item of batch) yield item;
    }
  }

  static async paginate<M extends typeof ModelClass>(
    this: M,
    page: number,
    perPage = 25,
  ): Promise<{
    items: InstanceType<M>[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const safePage = Math.max(1, Math.floor(page));
    const safePerPage = Math.max(1, Math.floor(perPage));
    const skip = (safePage - 1) * safePerPage;
    const scoped = this.limitBy(safePerPage).skipBy(skip);
    const [items, total] = await Promise.all([
      scoped.all<M>(),
      this.unlimited().unskipped().count(),
    ]);
    const totalPages = total === 0 ? 0 : Math.ceil(total / safePerPage);
    return {
      items,
      total,
      page: safePage,
      perPage: safePerPage,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1,
    };
  }

  /**
   * Cursor-based ("keyset") pagination. Avoids the O(skip) cost of
   * `.paginate()`'s LIMIT/OFFSET path, so it stays cheap on large tables.
   *
   * Pass `after` to advance forward ("next page"), `before` to walk
   * backward ("previous page"). Without either, returns the first page.
   *
   * The chain's lead `orderBy` column is used as the cursor key; the
   * primary key is always included as a tie-breaker so rows with identical
   * sort values paginate deterministically. Descending orders flip the
   * `$gt` / `$lt` semantics so `after` always advances in the order
   * direction the caller asked for.
   *
   * When no `orderBy` is set, cursor pagination uses the primary key.
   */
  static async paginateCursor<M extends typeof ModelClass>(
    this: M,
    options: { after?: string; before?: string; limit?: number } = {},
  ): Promise<{
    items: InstanceType<M>[];
    nextCursor?: string;
    prevCursor?: string;
    hasMore: boolean;
  }> {
    const limit = Math.max(1, Math.floor(options.limit ?? 25));
    const primaryKey = Object.keys(this.keys)[0] ?? 'id';
    const leadOrder = this.order[0];
    const orderKey = (leadOrder?.key as string | undefined) ?? primaryKey;
    const orderDir = leadOrder?.dir ?? SortDirection.Asc;
    const usesPrimaryOnly = orderKey === primaryKey;
    let scoped: M = this;
    let reverse = false;

    const stepDirection = (walk: 'after' | 'before'): 'forward' | 'backward' => {
      const forward = walk === 'after';
      if (orderDir === SortDirection.Desc) return forward ? 'backward' : 'forward';
      return forward ? 'forward' : 'backward';
    };

    const buildFilter = (token: string, walk: 'after' | 'before'): Filter<any> => {
      const payload = decodeCompositeCursor(token);
      const orderValue = payload[orderKey];
      const primaryValue = payload[primaryKey];
      const direction = stepDirection(walk);
      const cmp = direction === 'forward' ? '$gt' : '$lt';
      if (usesPrimaryOnly) {
        return { [cmp]: { [primaryKey]: primaryValue } } as Filter<any>;
      }
      // (orderKey <cmp> value) OR (orderKey == value AND primaryKey <cmp> id)
      return {
        $or: [
          { [cmp]: { [orderKey]: orderValue } },
          {
            $and: [{ [orderKey]: orderValue }, { [cmp]: { [primaryKey]: primaryValue } }],
          },
        ],
      } as Filter<any>;
    };

    if (options.after !== undefined) {
      scoped = scoped.filterBy(buildFilter(options.after, 'after')) as M;
    } else if (options.before !== undefined) {
      scoped = scoped.filterBy(buildFilter(options.before, 'before')).reverse() as M;
      reverse = true;
    }
    const fetched = await scoped.limitBy(limit + 1).all<M>();
    const hasMore = fetched.length > limit;
    let items = hasMore ? fetched.slice(0, limit) : fetched;
    if (reverse) items = items.reverse();
    const first = items[0] as Dict<any> | undefined;
    const last = items[items.length - 1] as Dict<any> | undefined;
    const tokenFor = (row: Dict<any>): string =>
      usesPrimaryOnly
        ? encodeCursor(row[primaryKey], primaryKey)
        : encodeCompositeCursor({
            [orderKey]: row[orderKey],
            [primaryKey]: row[primaryKey],
          });
    return {
      items,
      nextCursor: hasMore && last ? tokenFor(last) : undefined,
      prevCursor: first ? tokenFor(first) : undefined,
      hasMore,
    };
  }

  static async ids<M extends typeof ModelClass>(this: M) {
    const primaryKey = Object.keys(this.keys)[0] ?? 'id';
    return this.pluck(primaryKey);
  }

  static async select(...keys: any[]) {
    const items = await this.connector.select(this.modelScope(), ...keys);
    return items;
  }

  static async pluck(key: string) {
    const items = await this.select(key as any);
    return items.map((item) => item[key]);
  }

  static async pluckUnique(key: string) {
    const values = await this.pluck(key);
    const seen = new Set<any>();
    const result: any[] = [];
    for (const v of values) {
      if (!seen.has(v)) {
        seen.add(v);
        result.push(v);
      }
    }
    return result;
  }

  static async count<M extends typeof ModelClass>(this: M) {
    return await this.connector.count(this.modelScope());
  }

  static async countBy(key: string): Promise<Map<any, number>> {
    const values = await this.pluck(key);
    const result = new Map<any, number>();
    for (const value of values) {
      result.set(value, (result.get(value) ?? 0) + 1);
    }
    return result;
  }

  static async groupBy<M extends typeof ModelClass>(
    this: M,
    key: string,
  ): Promise<Map<any, InstanceType<M>[]>> {
    const items = await this.all<M>();
    const result = new Map<any, InstanceType<M>[]>();
    for (const item of items) {
      const bucket = (item.attributes() as Dict<any>)[key];
      const list = result.get(bucket);
      if (list) {
        list.push(item);
      } else {
        result.set(bucket, [item]);
      }
    }
    return result;
  }

  static async preloadBelongsTo<M extends typeof ModelClass>(
    this: M,
    records: any[],
    options: { foreignKey: string; primaryKey?: string },
  ): Promise<Map<any, InstanceType<M>>> {
    const fk = options.foreignKey;
    const pk = options.primaryKey ?? Object.keys(this.keys)[0] ?? 'id';
    const ids = new Set<any>();
    for (const record of records) {
      const attrs = typeof record?.attributes === 'function' ? record.attributes() : record;
      const value = attrs?.[fk];
      if (value !== undefined && value !== null) ids.add(value);
    }
    if (ids.size === 0) return new Map();
    const related = await this.filterBy({ $in: { [pk]: [...ids] } } as Filter<any>).all<M>();
    const result = new Map<any, InstanceType<M>>();
    for (const r of related) {
      const key = (r.attributes() as Dict<any>)[pk];
      result.set(key, r);
    }
    return result;
  }

  static async preloadHasMany<M extends typeof ModelClass>(
    this: M,
    records: any[],
    options: { foreignKey: string; primaryKey?: string },
  ): Promise<Map<any, InstanceType<M>[]>> {
    const fk = options.foreignKey;
    const pk = options.primaryKey ?? 'id';
    const ids = new Set<any>();
    for (const record of records) {
      const attrs = typeof record?.attributes === 'function' ? record.attributes() : record;
      const value = attrs?.[pk];
      if (value !== undefined && value !== null) ids.add(value);
    }
    const result = new Map<any, InstanceType<M>[]>();
    for (const id of ids) result.set(id, []);
    if (ids.size === 0) return result;
    const related = await this.filterBy({ $in: { [fk]: [...ids] } } as Filter<any>).all<M>();
    for (const r of related) {
      const key = (r.attributes() as Dict<any>)[fk];
      const list = result.get(key);
      if (list) list.push(r);
      else result.set(key, [r]);
    }
    return result;
  }

  static async aggregate<M extends typeof ModelClass>(
    this: M,
    kind: AggregateKind,
    key: string,
  ): Promise<number | undefined> {
    return await this.connector.aggregate(this.modelScope(), kind, key);
  }

  static async sum<M extends typeof ModelClass>(this: M, key: string) {
    return (await this.aggregate('sum', key)) ?? 0;
  }

  static async min<M extends typeof ModelClass>(this: M, key: string) {
    return this.aggregate('min', key);
  }

  static async max<M extends typeof ModelClass>(this: M, key: string) {
    return this.aggregate('max', key);
  }

  static async avg<M extends typeof ModelClass>(this: M, key: string) {
    return this.aggregate('avg', key);
  }

  static async deleteAll<M extends typeof ModelClass>(this: M) {
    return await this.connector.deleteAll(this.modelScope());
  }

  static async updateAll<M extends typeof ModelClass>(this: M, attrs: Dict<any>) {
    const effectiveAttrs = { ...attrs };
    const updatedCol = this.updatedAtColumn;
    if (updatedCol && effectiveAttrs[updatedCol] === undefined) {
      effectiveAttrs[updatedCol] = new Date();
    }
    return await this.connector.updateAll(this.modelScope(), effectiveAttrs);
  }

  static async findBy<M extends typeof ModelClass>(this: M, filter: Filter<any>) {
    return await this.filterBy(filter).first<M>();
  }

  static async exists<M extends typeof ModelClass>(this: M, filter?: Filter<any>) {
    const scoped = filter === undefined ? this : this.filterBy(filter);
    return (await scoped.count()) > 0;
  }

  static async find<M extends typeof ModelClass>(this: M, id: number | string) {
    const primaryKey = Object.keys(this.keys)[0] ?? 'id';
    const record = await this.findBy<M>({ [primaryKey]: id });
    if (!record) {
      throw new NotFoundError(`${this.name || 'Record'} with ${primaryKey}=${id} not found`);
    }
    return record;
  }

  static async findOrFail<M extends typeof ModelClass>(this: M, filter: Filter<any>) {
    const record = await this.findBy<M>(filter);
    if (!record) throw new NotFoundError('Record not found');
    return record;
  }

  static async findOrBuild<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    createProps: any,
  ) {
    const record = await this.findBy<M>(filter);
    if (record) return record;
    return this.build<M>({ ...filter, ...createProps });
  }

  static async firstOrCreate<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    createProps: any = {},
  ) {
    const record = await this.findBy<M>(filter);
    if (record) return record;
    return this.create<M>({ ...filter, ...createProps });
  }

  static async updateOrCreate<M extends typeof ModelClass>(
    this: M,
    filter: Filter<any>,
    attrs: Dict<any>,
  ) {
    const record = await this.findBy<M>(filter);
    if (record) {
      return (record as any).update(attrs) as Promise<InstanceType<M>>;
    }
    return this.create<M>({ ...filter, ...attrs });
  }

  persistentProps: Dict<any>;
  changedProps: Dict<any> = {};
  lastSavedChanges: Dict<{ from: any; to: any }> = {};
  keys: Dict<any> | undefined;

  constructor(props: Dict<any>, keys?: Dict<any>) {
    this.persistentProps = props;
    this.keys = keys;

    for (const key in this.persistentProps) {
      Object.defineProperty(this, key, {
        get: () => this.attributes()[key],
        set: (value) => this.assign({ [key]: value }),
      });
    }

    const model = this.constructor as typeof ModelClass;

    for (const key in model.keys) {
      Object.defineProperty(this, key, {
        get: () => (this.keys ? this.keys[key] : undefined),
      });
    }
  }

  isPersistent() {
    return this.keys !== undefined;
  }

  isNew() {
    return this.keys === undefined;
  }

  attributes(): Dict<any> {
    return { ...this.persistentProps, ...this.changedProps, ...this.keys };
  }

  toJSON(): Dict<any> {
    return this.attributes();
  }

  pick(keys: string[]): Dict<any> {
    const attrs = this.attributes();
    const result: Dict<any> = {};
    for (const key of keys) {
      if (key in attrs) result[key] = attrs[key];
    }
    return result;
  }

  omit(keys: string[]): Dict<any> {
    const attrs = this.attributes();
    const skip = new Set(keys);
    const result: Dict<any> = {};
    for (const key in attrs) {
      if (!skip.has(key)) result[key] = attrs[key];
    }
    return result;
  }

  assign<M extends ModelClass>(this: M, props: Dict<any>) {
    for (const key in props) {
      if (this.persistentProps[key] !== props[key]) {
        this.changedProps[key] = props[key];
      } else {
        delete this.changedProps[key];
      }
    }
    return this as M;
  }

  isChanged(): boolean {
    return Object.keys(this.changedProps).length > 0;
  }

  isChangedBy(key: string): boolean {
    return key in this.changedProps;
  }

  changes(): Dict<{ from: any; to: any }> {
    const result: Dict<{ from: any; to: any }> = {};
    for (const key in this.changedProps) {
      result[key] = { from: this.persistentProps[key], to: this.changedProps[key] };
    }
    return result;
  }

  savedChanges(): Dict<{ from: any; to: any }> {
    return { ...this.lastSavedChanges };
  }

  savedChangeBy(key: string): { from: any; to: any } | undefined {
    return this.lastSavedChanges[key];
  }

  wasChanged(): boolean {
    return Object.keys(this.lastSavedChanges).length > 0;
  }

  wasChangedBy(key: string): boolean {
    return key in this.lastSavedChanges;
  }

  revertChange<M extends ModelClass>(this: M, key: string) {
    delete this.changedProps[key];
    return this as M;
  }

  revertChanges<M extends ModelClass>(this: M) {
    this.changedProps = {};
    return this as M;
  }

  itemScope(): Scope {
    const model = this.constructor as typeof ModelClass;
    return {
      tableName: model.tableName,
      filter: this.keys,
      limit: 1,
      skip: 0,
      order: [],
    };
  }

  belongsTo<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): Promise<InstanceType<Related> | undefined> {
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(Related.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(Related.keys)[0] ?? 'id';
    const attrs = this.attributes() as Dict<any>;
    const fkValue = attrs[fk];
    if (fkValue === undefined || fkValue === null) {
      return Promise.resolve(undefined);
    }
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      const expectedType = options.typeValue ?? Related.tableName;
      if (attrs[typeKey] !== expectedType) {
        return Promise.resolve(undefined);
      }
    }
    return Related.findBy({ [pk]: fkValue }) as Promise<InstanceType<Related> | undefined>;
  }

  hasMany<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): Related {
    const selfModel = this.constructor as typeof ModelClass;
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(selfModel.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const pkValue = (this as any)[pk];
    const filter: Dict<any> = { [fk]: pkValue };
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      filter[typeKey] = options.typeValue ?? selfModel.tableName;
    }
    return Related.filterBy(filter) as Related;
  }

  hasOne<Related extends typeof ModelClass>(
    this: ModelClass,
    Related: Related,
    options: AssociationOptions = {},
  ): Promise<InstanceType<Related> | undefined> {
    const selfModel = this.constructor as typeof ModelClass;
    const poly = options.polymorphic;
    const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(selfModel.tableName)}Id`);
    const pk = options.primaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const pkValue = (this as any)[pk];
    if (pkValue === undefined || pkValue === null) {
      return Promise.resolve(undefined);
    }
    const filter: Dict<any> = { [fk]: pkValue };
    if (poly) {
      const typeKey = options.typeKey ?? `${poly}Type`;
      filter[typeKey] = options.typeValue ?? selfModel.tableName;
    }
    return Related.findBy(filter) as Promise<InstanceType<Related> | undefined>;
  }

  hasManyThrough<Target extends typeof ModelClass, Through extends typeof ModelClass>(
    this: ModelClass,
    Target: Target,
    Through: Through,
    options: HasManyThroughOptions = {},
  ): Target {
    const selfModel = this.constructor as typeof ModelClass;
    const throughFk = options.throughForeignKey ?? `${singularize(selfModel.tableName)}Id`;
    const targetFk = options.targetForeignKey ?? `${singularize(Target.tableName)}Id`;
    const selfPk = options.selfPrimaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
    const targetPk = options.targetPrimaryKey ?? Object.keys(Target.keys)[0] ?? 'id';
    const selfPkValue = (this as any)[selfPk];
    const asyncPending = (async () => {
      const ids = await Through.filterBy({ [throughFk]: selfPkValue }).pluck(targetFk);
      return { $in: { [targetPk]: ids } } as Filter<any>;
    })();
    return Target.filterBy({ $async: asyncPending } as Filter<any>) as Target;
  }

  async increment<M extends ModelClass>(this: M, key: string, by = 1) {
    if (!this.keys) {
      throw new PersistenceError('Cannot increment a record that has not been saved');
    }
    const current = Number((this.attributes() as Dict<any>)[key] ?? 0);
    return this.update({ [key]: current + by });
  }

  async decrement<M extends ModelClass>(this: M, key: string, by = 1) {
    return this.increment(key, -by);
  }

  async isValid(): Promise<boolean> {
    const model = this.constructor as typeof ModelClass;
    for (const validator of model.validators) {
      if (!(await validator(this))) return false;
    }
    return true;
  }

  async runCallbacks(kind: keyof Callbacks<any>): Promise<void> {
    const model = this.constructor as typeof ModelClass;
    const callbacks = model.callbacks[kind] as Callback<any>[] | undefined;
    if (!callbacks) return;
    for (const callback of callbacks) {
      await callback(this);
    }
  }

  async save<M extends ModelClass>(this: M) {
    const model = this.constructor as typeof ModelClass;
    if (!(await this.isValid())) {
      throw new ValidationError('Validation failed');
    }
    const now = new Date();
    const isInsert = !this.keys;

    await this.runCallbacks('beforeSave');
    await this.runCallbacks(isInsert ? 'beforeCreate' : 'beforeUpdate');

    const snapshot: Dict<{ from: any; to: any }> = {};

    if (this.keys) {
      const changedKeys = Object.keys(this.changedProps);
      if (changedKeys.length > 0) {
        if (model.updatedAtColumn) {
          this.changedProps[model.updatedAtColumn] = now;
        }
        for (const key in this.changedProps) {
          snapshot[key] = { from: this.persistentProps[key], to: this.changedProps[key] };
        }
        const items = await model.connector.updateAll(this.itemScope(), this.changedProps);
        const item = items.pop();
        if (item) {
          for (const key in model.keys) {
            this.keys[key] = item[key];
            delete item[key];
          }
          this.persistentProps = item;
          this.changedProps = {};
        } else {
          throw new NotFoundError('Item not found');
        }
      }
    } else {
      const insertProps = { ...this.persistentProps, ...this.changedProps };
      if (model.createdAtColumn && insertProps[model.createdAtColumn] === undefined) {
        insertProps[model.createdAtColumn] = now;
      }
      if (model.updatedAtColumn && insertProps[model.updatedAtColumn] === undefined) {
        insertProps[model.updatedAtColumn] = now;
      }
      const items = await model.connector.batchInsert(model.tableName, model.keys, [insertProps]);
      const item = items.pop();
      if (item) {
        this.keys = {};
        for (const key in model.keys) {
          this.keys[key] = item[key];
          delete item[key];
        }
        for (const key in item) {
          snapshot[key] = { from: undefined, to: item[key] };
        }
        for (const key in this.keys) {
          snapshot[key] = { from: undefined, to: this.keys[key] };
        }
        this.persistentProps = item;
        this.changedProps = {};
      } else {
        throw new PersistenceError('Failed to insert item');
      }
    }

    this.lastSavedChanges = snapshot;

    await this.runCallbacks(isInsert ? 'afterCreate' : 'afterUpdate');
    await this.runCallbacks('afterSave');

    return this as M;
  }

  async update<M extends ModelClass>(this: M, attrs: Dict<any>) {
    this.assign(attrs);
    return this.save();
  }

  async touch<M extends ModelClass>(this: M) {
    if (!this.keys) {
      throw new PersistenceError('Cannot touch a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    const updatedCol = model.updatedAtColumn;
    if (!updatedCol) {
      throw new PersistenceError('Cannot touch a record whose Model has no updatedAt column');
    }
    const now = new Date();
    const items = await model.connector.updateAll(this.itemScope(), { [updatedCol]: now });
    const item = items.pop();
    if (!item) throw new NotFoundError('Item not found');
    for (const key in model.keys) delete item[key];
    this.persistentProps = item;
    this.changedProps = {};
    return this as M;
  }

  async reload<M extends ModelClass>(this: M) {
    if (!this.keys) {
      throw new PersistenceError('Cannot reload a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    const items = await model.connector.query(this.itemScope());
    const item = items.pop();
    if (!item) throw new NotFoundError('Item not found');
    for (const key in model.keys) delete item[key];
    this.persistentProps = item;
    this.changedProps = {};
    return this as M;
  }

  async delete<M extends ModelClass>(this: M) {
    if (!this.keys) {
      throw new PersistenceError('Cannot delete a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    await this.runCallbacks('beforeDelete');
    const items = await model.connector.deleteAll(this.itemScope());
    if (items.length === 0) {
      throw new NotFoundError('Item not found');
    }
    this.persistentProps = { ...this.persistentProps, ...this.changedProps, ...this.keys };
    this.changedProps = {};
    this.keys = undefined;
    await this.runCallbacks('afterDelete');
    return this as M;
  }

  isDiscarded(): boolean {
    const model = this.constructor as typeof ModelClass;
    const value = (this.attributes() as Dict<any>)[model.softDeleteColumn];
    return value !== null && value !== undefined;
  }

  async discard<M extends ModelClass>(this: M): Promise<M> {
    if (!this.keys) {
      throw new PersistenceError('Cannot discard a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    (this as ModelClass).assign({ [model.softDeleteColumn]: new Date() } as Dict<any>);
    return (this as ModelClass).save() as Promise<M>;
  }

  async restore<M extends ModelClass>(this: M): Promise<M> {
    if (!this.keys) {
      throw new PersistenceError('Cannot restore a record that has not been saved');
    }
    const model = this.constructor as typeof ModelClass;
    (this as ModelClass).assign({ [model.softDeleteColumn]: null } as Dict<any>);
    return (this as ModelClass).save() as Promise<M>;
  }
}

export function Model<
  CreateProps = {},
  PersistentProps extends Schema = {},
  Keys extends Dict<KeyType> = { id: KeyType.number },
  Scopes extends ScopeMap<any> = {},
>(props: {
  tableName: string;
  init: (props: CreateProps) => PersistentProps;
  filter?: Filter<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  limit?: number;
  skip?: number;
  order?: Order<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  connector?: Connector;
  keys?: Keys;
  timestamps?: boolean | { createdAt?: boolean | string; updatedAt?: boolean | string };
  softDelete?: boolean | string | { column?: string };
  validators?: Validator<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >[];
  callbacks?: Callbacks<
    PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
  >;
  scopes?: Scopes;
  /**
   * Map of column → allowed string values. Each value becomes a chainable
   * class scope (`Post.draft()`) plus an instance predicate (`post.isDraft()`).
   * Snake_case values map to camelCase scopes / PascalCase predicates.
   */
  enums?: Dict<readonly string[]>;
}) {
  const connector = props.connector ? props.connector : new MemoryConnector();
  const order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
  const keyDefinitions = props.keys || { id: KeyType.number };
  const { createdAtColumn, updatedAtColumn } = resolveTimestampColumns(props.timestamps);
  const { softDeleteMode, softDeleteColumn } = resolveSoftDelete(props.softDelete);
  const enumDefs = props.enums || {};
  const builtInValidators: Validator<any>[] = [];
  if (Object.keys(enumDefs).length > 0) {
    builtInValidators.push((record) => {
      const attrs = record.attributes() as Dict<any>;
      for (const column in enumDefs) {
        const value = attrs[column];
        if (value === undefined || value === null) continue;
        if (!enumDefs[column].includes(value)) return false;
      }
      return true;
    });
  }
  const validators = [...(props.validators || []), ...builtInValidators];
  const callbacks = props.callbacks || {};
  const scopeDefs = props.scopes || ({} as Scopes);

  const ModelSubclass = class Model extends ModelClass {
    static tableName = props.tableName;
    static filter = props.filter;
    static limit = props.limit;
    static skip = props.skip;
    static order = order;
    static keys = keyDefinitions;
    static connector = connector;
    static init = props.init as any;
    static createdAtColumn = createdAtColumn;
    static updatedAtColumn = updatedAtColumn;
    static softDelete = softDeleteMode;
    static softDeleteColumn = softDeleteColumn;
    static enums = enumDefs;
    static validators = validators as Validator<any>[];
    static callbacks = callbacks as Callbacks<any>;

    static orderBy<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.orderBy(order) as M;
    }

    static reorder<M extends typeof ModelClass>(
      this: M,
      order: Order<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.reorder(order) as M;
    }

    static filterBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.filterBy(filter) as M;
    }

    static orFilterBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return super.orFilterBy(filter) as M;
    }

    static on(
      event: keyof Callbacks<any>,
      handler: Callback<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ): () => void {
      return super.on(event, handler as Callback<any>);
    }

    static async select(...keys: [keyof Keys | keyof PersistentProps][]) {
      return super.select(...(keys as any[])) as any as Partial<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >[];
    }

    static async pluck(key: keyof Keys | keyof PersistentProps) {
      return super.pluck(key as string);
    }

    static async pluckUnique(key: keyof Keys | keyof PersistentProps) {
      return super.pluckUnique(key as string);
    }

    static async ids<M extends typeof ModelClass>(this: M) {
      return super.ids();
    }

    static async all<M extends typeof ModelClass>(this: M) {
      return (await super.all()) as (InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
    }

    static async first<M extends typeof ModelClass>(this: M) {
      return (await super.first()) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async last<M extends typeof ModelClass>(this: M) {
      return (await super.last()) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async *inBatchesOf<M extends typeof ModelClass>(this: M, size: number) {
      for await (const batch of super.inBatchesOf(size)) {
        yield batch as (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
      }
    }

    static async *findEach<M extends typeof ModelClass>(this: M, size?: number) {
      for await (const item of super.findEach(size)) {
        yield item as InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
      }
    }

    static async paginate<M extends typeof ModelClass>(this: M, page: number, perPage?: number) {
      const result = await super.paginate(page, perPage);
      return result as {
        items: (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
        total: number;
        page: number;
        perPage: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }

    static async paginateCursor<M extends typeof ModelClass>(
      this: M,
      options?: { after?: string; before?: string; limit?: number },
    ) {
      const result = await super.paginateCursor(options);
      return result as {
        items: (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
        nextCursor?: string;
        prevCursor?: string;
        hasMore: boolean;
      };
    }

    static async count<M extends typeof ModelClass>(this: M) {
      return await super.count();
    }

    static async countBy(key: keyof Keys | keyof PersistentProps) {
      return super.countBy(key as string);
    }

    static async groupBy<M extends typeof ModelClass>(
      this: M,
      key: keyof Keys | keyof PersistentProps,
    ) {
      const result = await super.groupBy(key as string);
      return result as Map<
        any,
        (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[]
      >;
    }

    static async preloadBelongsTo<M extends typeof ModelClass>(
      this: M,
      records: any[],
      options: { foreignKey: string; primaryKey?: keyof Keys & string },
    ) {
      const result = await super.preloadBelongsTo(records, options);
      return result as Map<
        any,
        InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>
      >;
    }

    static async preloadHasMany<M extends typeof ModelClass>(
      this: M,
      records: any[],
      options: { foreignKey: keyof PersistentProps & string; primaryKey?: string },
    ) {
      const result = await super.preloadHasMany(records, options);
      return result as Map<
        any,
        (InstanceType<M> &
          PersistentProps &
          Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[]
      >;
    }

    static async sum<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.sum(key as string);
    }

    static async min<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.min(key as string);
    }

    static async max<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.max(key as string);
    }

    static async avg<M extends typeof ModelClass>(this: M, key: keyof PersistentProps) {
      return super.avg(key as string);
    }

    static async deleteAll<M extends typeof ModelClass>(this: M) {
      return (await super.deleteAll()) as (PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
      })[];
    }

    static async updateAll<M extends typeof ModelClass>(this: M, attrs: Partial<PersistentProps>) {
      return (await super.updateAll(attrs)) as (PersistentProps & {
        [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number;
      })[];
    }

    static async findBy<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return (await super.findBy(filter)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async exists<M extends typeof ModelClass>(
      this: M,
      filter?: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return await super.exists(filter);
    }

    static async find<M extends typeof ModelClass>(
      this: M,
      id: Keys[keyof Keys] extends KeyType.uuid ? string : number,
    ) {
      return (await super.find(id as number | string)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async findOrFail<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
    ) {
      return (await super.findOrFail(filter)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async findOrBuild<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      createProps: CreateProps,
    ) {
      return (await super.findOrBuild(filter, createProps)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async firstOrCreate<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      createProps: Partial<CreateProps> = {},
    ) {
      return (await super.firstOrCreate(filter, createProps)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async updateOrCreate<M extends typeof ModelClass>(
      this: M,
      filter: Filter<
        PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }
      >,
      attrs: Partial<PersistentProps>,
    ) {
      return (await super.updateOrCreate(filter, attrs)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static build<M extends typeof ModelClass>(this: M, props: CreateProps) {
      return super.build(props) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static buildScoped<M extends typeof ModelClass>(this: M, props: Partial<CreateProps>) {
      return super.buildScoped(props) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async create<M extends typeof ModelClass>(this: M, props: CreateProps) {
      return (await super.create(props)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async createScoped<M extends typeof ModelClass>(this: M, props: Partial<CreateProps>) {
      return (await super.createScoped(props)) as InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>;
    }

    static async createMany<M extends typeof ModelClass>(this: M, propsList: CreateProps[]) {
      return (await super.createMany(propsList)) as (InstanceType<M> &
        PersistentProps &
        Readonly<{ [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number }>)[];
    }

    persistentProps: PersistentProps;
    changedProps: Partial<PersistentProps> = {};
    keys: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number } | undefined;

    // biome-ignore lint/complexity/noUselessConstructor: narrows parent's Dict<any> params to PersistentProps/Keys
    constructor(
      props: PersistentProps,
      keys?: { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number },
    ) {
      super(props, keys);
    }

    attributes() {
      return {
        ...(this.persistentProps as object),
        ...(this.changedProps as object),
        ...(this.keys as object),
      } as PersistentProps & { [K in keyof Keys]: Keys[K] extends KeyType.uuid ? string : number };
    }

    toJSON() {
      return this.attributes();
    }

    pick<K extends keyof PersistentProps | keyof Keys>(keys: K[]) {
      return super.pick(keys as string[]) as Pick<
        PersistentProps & { [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number },
        K & (keyof PersistentProps | keyof Keys)
      >;
    }

    omit<K extends keyof PersistentProps | keyof Keys>(keys: K[]) {
      return super.omit(keys as string[]) as Omit<
        PersistentProps & { [P in keyof Keys]: Keys[P] extends KeyType.uuid ? string : number },
        K & (keyof PersistentProps | keyof Keys)
      >;
    }

    assign<M extends ModelClass>(this: M, props: Partial<PersistentProps>) {
      for (const key in props) {
        if (this.persistentProps[key] !== props[key]) {
          this.changedProps[key] = props[key];
        } else {
          delete this.changedProps[key];
        }
      }
      return this as M;
    }

    isChangedBy(key: keyof PersistentProps): boolean {
      return super.isChangedBy(key as string);
    }

    revertChange<M extends ModelClass>(this: M, key: keyof PersistentProps): M {
      return super.revertChange(key as string) as M;
    }

    update<M extends ModelClass>(this: M, attrs: Partial<PersistentProps>): Promise<M> {
      return super.update(attrs as Dict<any>) as Promise<M>;
    }
  };

  for (const name in scopeDefs) {
    (ModelSubclass as any)[name] = function (this: typeof ModelSubclass, ...args: any[]) {
      return scopeDefs[name](this, ...args);
    };
  }

  for (const column in enumDefs) {
    const values = enumDefs[column];
    (ModelSubclass as any)[`${column}Values`] = values;
    for (const value of values) {
      const scopeName = camelize(value);
      const predicateName = `is${pascalize(value)}`;
      if (scopeName in ModelSubclass) {
        throw new Error(
          `Enum value '${value}' for column '${column}' collides with existing static method '${scopeName}' on the Model`,
        );
      }
      if (predicateName in ModelSubclass.prototype) {
        throw new Error(
          `Enum value '${value}' for column '${column}' collides with existing instance method '${predicateName}' on the Model`,
        );
      }
      (ModelSubclass as any)[scopeName] = function (this: typeof ModelSubclass) {
        return this.filterBy({ [column]: value } as any);
      };
      (ModelSubclass.prototype as any)[predicateName] = function (this: ModelClass) {
        return (this.attributes() as Dict<any>)[column] === value;
      };
    }
  }

  return ModelSubclass as typeof ModelSubclass & ScopesToMethods<typeof ModelSubclass, Scopes>;
}

export default Model;
