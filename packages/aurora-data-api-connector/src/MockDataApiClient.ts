import knexPkg, { type Knex } from 'knex';

import type { DataApiClient, DataApiQueryResult } from './DataApiConnector.js';

const createKnex = knexPkg.knex;

export interface MockDataApiClientOptions {
  knex?: Knex;
}

export class MockDataApiClient implements DataApiClient {
  knex: Knex;
  private trx: Knex.Transaction | undefined;
  private transactionCounter = 0;

  constructor(options: MockDataApiClientOptions = {}) {
    this.knex =
      options.knex ??
      createKnex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });
  }

  destroy(): Promise<void> {
    return this.knex.destroy();
  }

  async query(sql: string, params: Record<string, any> = {}): Promise<DataApiQueryResult> {
    const bindings: any[] = [];
    const positionalSql = sql.replace(/:([a-zA-Z_][\w]*)/g, (_, name) => {
      if (!(name in params)) {
        throw new Error(`Missing binding for :${name}`);
      }
      bindings.push(params[name]);
      return '?';
    });

    const client = this.trx ?? this.knex;
    const op = positionalSql
      .trim()
      .match(/^(\w+)/i)?.[1]
      ?.toLowerCase();

    if (op === 'select') {
      const records = (await client.raw(positionalSql, bindings)) as Record<string, any>[];
      return { records };
    }

    if (op === 'insert') {
      await client.raw(positionalSql, bindings);
      const idRow = (await client.raw('SELECT last_insert_rowid() AS id')) as Array<{ id: number }>;
      const insertId = idRow?.[0]?.id;
      return { records: [], insertId, numberOfRecordsUpdated: 1 };
    }

    if (op === 'update' || op === 'delete') {
      const result: any = await client.raw(positionalSql, bindings);
      const changes =
        result && typeof result === 'object' && 'changes' in result
          ? (result as any).changes
          : undefined;
      return { records: [], numberOfRecordsUpdated: changes };
    }

    const records = (await client.raw(positionalSql, bindings)) as Record<string, any>[];
    return { records: Array.isArray(records) ? records : [] };
  }

  async beginTransaction(): Promise<string> {
    if (this.trx) {
      throw new Error('Transaction already active');
    }
    this.trx = await this.knex.transaction();
    this.transactionCounter += 1;
    return `mock-trx-${this.transactionCounter}`;
  }

  async commitTransaction(_id: unknown): Promise<void> {
    if (!this.trx) throw new Error('No active transaction to commit');
    await this.trx.commit();
    this.trx = undefined;
  }

  async rollbackTransaction(_id: unknown): Promise<void> {
    if (!this.trx) throw new Error('No active transaction to rollback');
    await this.trx.rollback();
    this.trx = undefined;
  }
}
