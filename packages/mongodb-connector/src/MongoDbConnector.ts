import {
  type AggregateKind,
  type AlterTableOp,
  type AlterTableSpec,
  type BaseType,
  type Connector,
  type Dict,
  defineTable,
  type Filter,
  FilterError,
  type FilterRaw,
  type FilterSpecial,
  KeyType,
  PersistenceError,
  type Scope,
  SortDirection,
  type TableBuilder,
  UnsupportedOperationError,
} from '@next-model/core';
import { type Collection, type Db, MongoClient, type MongoClientOptions, type Sort } from 'mongodb';

export interface MongoDbConfig {
  /** Connection URL (e.g. `mongodb://localhost:27017`). */
  url?: string;
  /** Database name. Default `nextmodel`. */
  database?: string;
  /** node-mongodb client options. */
  options?: MongoClientOptions;
  /** Bring your own client. Caller controls connect/disconnect. */
  client?: MongoClient;
}

const COUNTERS = '_nm_counters';
const SCHEMAS = '_nm_schemas';

function requireSingleKey(filter: Dict<any>, operator: string): string {
  const keys = Object.keys(filter);
  if (keys.length !== 1) {
    throw new FilterError(`${operator} expects exactly one key, received ${keys.length}`);
  }
  return keys[0];
}

function requireNonEmpty(filter: Dict<any>, operator: string): void {
  if (Object.keys(filter).length === 0) {
    throw new FilterError(`${operator} expects at least one key`);
  }
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Translate a SQL `LIKE` pattern (`_` and `%`) into an anchored regex. */
function likeToRegex(pattern: string): RegExp {
  let out = '^';
  for (const ch of pattern) {
    if (ch === '%') out += '.*';
    else if (ch === '_') out += '.';
    else out += escapeRegExp(ch);
  }
  out += '$';
  return new RegExp(out);
}

function stripId<T extends Dict<any>>(doc: T | null): T | undefined {
  if (!doc) return undefined;
  const { _id: _drop, ...rest } = doc;
  return rest as T;
}

export class MongoDbConnector implements Connector {
  client: MongoClient;
  db: Db;
  private ownsClient: boolean;
  private inTransaction = false;

  constructor(config: MongoDbConfig = {}) {
    if (config.client) {
      this.client = config.client;
      this.ownsClient = false;
    } else {
      const url = config.url ?? 'mongodb://127.0.0.1:27017';
      this.client = new MongoClient(url, config.options);
      this.ownsClient = true;
    }
    this.db = this.client.db(config.database ?? 'nextmodel');
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async destroy(): Promise<void> {
    if (this.ownsClient) await this.client.close();
  }

  private collection(tableName: string): Collection<Dict<any>> {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
      throw new PersistenceError(`Refusing to use unsafe collection name: ${tableName}`);
    }
    return this.db.collection<Dict<any>>(tableName);
  }

  private compileFilter(filter: Filter<any> | undefined): Dict<any> {
    if (!filter) return {};
    const f = filter as FilterSpecial<Dict<any>> & Partial<Dict<any>>;
    if (f.$and !== undefined) {
      return { $and: (f.$and as Filter<any>[]).map((child) => this.compileFilter(child)) };
    }
    if (f.$or !== undefined) {
      return { $or: (f.$or as Filter<any>[]).map((child) => this.compileFilter(child)) };
    }
    if (f.$not !== undefined) {
      return { $nor: [this.compileFilter(f.$not as Filter<any>)] };
    }
    if (f.$in !== undefined) {
      requireNonEmpty(f.$in as Dict<any>, '$in');
      const key = requireSingleKey(f.$in as Dict<any>, '$in');
      const list = (f.$in as Dict<any>)[key];
      if (!Array.isArray(list) || list.length === 0) {
        throw new FilterError(`$in.${key} requires a non-empty array`);
      }
      return { [key]: { $in: list } };
    }
    if (f.$notIn !== undefined) {
      requireNonEmpty(f.$notIn as Dict<any>, '$notIn');
      const key = requireSingleKey(f.$notIn as Dict<any>, '$notIn');
      const list = (f.$notIn as Dict<any>)[key];
      if (!Array.isArray(list) || list.length === 0) {
        throw new FilterError(`$notIn.${key} requires a non-empty array`);
      }
      return { [key]: { $nin: list } };
    }
    if (f.$null !== undefined) return { [f.$null as string]: { $eq: null } };
    if (f.$notNull !== undefined) return { [f.$notNull as string]: { $ne: null } };
    if (f.$between !== undefined) {
      const key = requireSingleKey(f.$between as Dict<any>, '$between');
      const range = (f.$between as Dict<any>)[key] as { from: BaseType; to: BaseType };
      return { [key]: { $gte: range.from, $lte: range.to } };
    }
    if (f.$notBetween !== undefined) {
      const key = requireSingleKey(f.$notBetween as Dict<any>, '$notBetween');
      const range = (f.$notBetween as Dict<any>)[key] as { from: BaseType; to: BaseType };
      return { $or: [{ [key]: { $lt: range.from } }, { [key]: { $gt: range.to } }] };
    }
    if (f.$gt !== undefined) {
      const key = requireSingleKey(f.$gt as Dict<any>, '$gt');
      return { [key]: { $gt: (f.$gt as Dict<any>)[key] } };
    }
    if (f.$gte !== undefined) {
      const key = requireSingleKey(f.$gte as Dict<any>, '$gte');
      return { [key]: { $gte: (f.$gte as Dict<any>)[key] } };
    }
    if (f.$lt !== undefined) {
      const key = requireSingleKey(f.$lt as Dict<any>, '$lt');
      return { [key]: { $lt: (f.$lt as Dict<any>)[key] } };
    }
    if (f.$lte !== undefined) {
      const key = requireSingleKey(f.$lte as Dict<any>, '$lte');
      return { [key]: { $lte: (f.$lte as Dict<any>)[key] } };
    }
    if (f.$like !== undefined) {
      const key = requireSingleKey(f.$like as Dict<any>, '$like');
      const pattern = (f.$like as Dict<string>)[key];
      return { [key]: likeToRegex(pattern) };
    }
    if (f.$raw !== undefined) {
      const raw = f.$raw as FilterRaw;
      // For Mongo, $raw.$query is expected to be a JSON-encoded mongo filter.
      try {
        return JSON.parse(raw.$query);
      } catch {
        throw new FilterError('$raw.$query must be JSON-encoded mongo filter');
      }
    }
    if (f.$async !== undefined) {
      throw new FilterError('$async filters must be resolved before reaching the connector');
    }
    return filter as Dict<any>;
  }

  private buildSort(order: Scope['order']): Sort | undefined {
    if (!order || order.length === 0) return undefined;
    const sort: Dict<1 | -1> = {};
    for (const col of order) {
      const dir = (col.dir ?? SortDirection.Asc) === SortDirection.Asc ? 1 : -1;
      sort[col.key as string] = dir;
    }
    return sort as Sort;
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    let cursor = this.collection(scope.tableName).find(this.compileFilter(scope.filter));
    const sort = this.buildSort(scope.order);
    if (sort) cursor = cursor.sort(sort);
    if (scope.skip !== undefined) cursor = cursor.skip(scope.skip);
    if (scope.limit !== undefined) cursor = cursor.limit(scope.limit);
    const docs = await cursor.toArray();
    return docs.map((d) => stripId(d) as Dict<any>);
  }

  async count(scope: Scope): Promise<number> {
    return this.collection(scope.tableName).countDocuments(this.compileFilter(scope.filter));
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    const projection: Dict<0 | 1> = { _id: 0 };
    for (const k of keys) projection[k] = 1;
    let cursor = this.collection(scope.tableName)
      .find(this.compileFilter(scope.filter))
      .project<Dict<any>>(projection);
    const sort = this.buildSort(scope.order);
    if (sort) cursor = cursor.sort(sort);
    if (scope.skip !== undefined) cursor = cursor.skip(scope.skip);
    if (scope.limit !== undefined) cursor = cursor.limit(scope.limit);
    return cursor.toArray();
  }

  async updateAll(scope: Scope, attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    if (Object.keys(attrs).length === 0) return this.query(scope);
    const filter = this.compileFilter(scope.filter);
    await this.collection(scope.tableName).updateMany(filter, { $set: attrs });
    return this.query(scope);
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const matching = await this.query(scope);
    if (matching.length === 0) return [];
    await this.collection(scope.tableName).deleteMany(this.compileFilter(scope.filter));
    return matching;
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    if (items.length === 0) return [];
    const primaryKey = Object.keys(keys)[0] ?? 'id';
    const keyType = keys[primaryKey];
    const docs: Dict<any>[] = [];
    for (const item of items) {
      const doc: Dict<any> = { ...item };
      if (doc[primaryKey] === undefined) {
        if (keyType === KeyType.uuid) doc[primaryKey] = globalThis.crypto.randomUUID();
        else if (keyType === KeyType.number) doc[primaryKey] = await this.nextSequence(tableName);
        else if (keyType === KeyType.manual) {
          throw new PersistenceError(`KeyType.manual requires the caller to supply ${primaryKey}`);
        }
      }
      docs.push(doc);
    }
    await this.collection(tableName).insertMany(docs);
    return docs.map((d) => stripId(d) as Dict<any>);
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    // Mongo has no SQL; expose a `db.command` escape hatch where `query` is
    // the command name and `bindings` (object) carries its arguments.
    const args = Array.isArray(bindings) ? bindings[0] : bindings;
    const result = await this.db.command({ [query]: args });
    return Array.isArray(result) ? result : [result];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn();
    const seenTables = new Set(await this.listTables());
    const snapshots = new Map<string, Dict<any>[]>();
    for (const name of seenTables) {
      const docs = await this.collection(name).find({}).toArray();
      snapshots.set(name, docs);
    }
    this.inTransaction = true;
    try {
      const result = await fn();
      this.inTransaction = false;
      return result;
    } catch (err) {
      const current = new Set(await this.listTables());
      for (const name of current) {
        if (!seenTables.has(name))
          await this.collection(name)
            .drop()
            .catch(() => {});
      }
      for (const [name, docs] of snapshots) {
        await this.collection(name).deleteMany({});
        if (docs.length > 0) await this.collection(name).insertMany(docs);
      }
      this.inTransaction = false;
      throw err;
    }
  }

  async aggregate(scope: Scope, kind: AggregateKind, key: string): Promise<number | undefined> {
    const op = `$${kind}` as const;
    const cursor = this.collection(scope.tableName).aggregate([
      { $match: this.compileFilter(scope.filter) },
      { $group: { _id: null, result: { [op]: `$${key}` } } },
    ]);
    const [doc] = await cursor.toArray();
    if (!doc || doc.result === null || doc.result === undefined) return undefined;
    return Number(doc.result);
  }

  async hasTable(tableName: string): Promise<boolean> {
    const meta = await this.db.collection<Dict<any>>(SCHEMAS).findOne({ name: tableName });
    return meta !== null;
  }

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    if (await this.hasTable(tableName)) return;
    const def = defineTable(tableName, blueprint);
    await this.db.createCollection(tableName).catch(() => {});
    await this.db.collection<Dict<any>>(SCHEMAS).insertOne({ name: tableName, definition: def });
    for (const idx of def.indexes) {
      const keys: Dict<1> = {};
      for (const col of idx.columns) keys[col] = 1;
      await this.collection(tableName).createIndex(keys, {
        name: idx.name,
        unique: idx.unique,
      });
    }
  }

  async dropTable(tableName: string): Promise<void> {
    await this.collection(tableName)
      .drop()
      .catch(() => {});
    await this.db.collection<Dict<any>>(SCHEMAS).deleteOne({ name: tableName });
    await this.db.collection<Dict<any>>(COUNTERS).deleteOne({ _id: tableName as any });
  }

  async alterTable(spec: AlterTableSpec): Promise<void> {
    for (const op of spec.ops) {
      await this.applyAlterOp(spec.tableName, op);
    }
  }

  private async applyAlterOp(tableName: string, op: AlterTableOp): Promise<void> {
    const collection = this.collection(tableName);
    switch (op.op) {
      case 'addColumn':
      case 'changeColumn':
        return;
      case 'removeColumn':
        await collection.updateMany({}, { $unset: { [op.name]: '' } });
        return;
      case 'renameColumn':
        await collection.updateMany({}, { $rename: { [op.from]: op.to } });
        return;
      case 'addIndex': {
        const keys: Dict<1> = {};
        for (const col of op.columns) keys[col] = 1;
        await collection.createIndex(keys, { name: op.name, unique: op.unique });
        return;
      }
      case 'removeIndex': {
        const target = Array.isArray(op.nameOrColumns)
          ? op.nameOrColumns.join('_1_') + '_1'
          : op.nameOrColumns;
        await collection.dropIndex(target).catch(() => {});
        return;
      }
      case 'renameIndex':
        throw new UnsupportedOperationError(
          'MongoDbConnector cannot rename indexes; drop and recreate instead',
        );
      case 'addForeignKey':
      case 'removeForeignKey':
      case 'addCheckConstraint':
      case 'removeCheckConstraint':
        throw new UnsupportedOperationError(
          `MongoDbConnector cannot apply ${op.op}: mongodb does not enforce relational constraints. Drop the operation from the migration or guard it with a connector capability check.`,
        );
    }
  }

  private async listTables(): Promise<string[]> {
    const docs = await this.db
      .collection<Dict<any>>(SCHEMAS)
      .find({}, { projection: { name: 1, _id: 0 } })
      .toArray();
    return docs.map((d) => d.name as string);
  }

  private async nextSequence(tableName: string): Promise<number> {
    const result = await this.db
      .collection<Dict<any>>(COUNTERS)
      .findOneAndUpdate(
        { _id: tableName as any },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
    return Number(result?.seq ?? 1);
  }
}
