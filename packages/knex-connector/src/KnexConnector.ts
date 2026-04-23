try {
  const pg = require('pg');
  pg.types.setTypeParser(20, 'text', parseInt);
} catch (e) {}

import * as Knex from 'knex';
import {
  FilterSpecial,
  Filter,
  FilterIn,
  FilterBetween,
  FilterRaw,
  BaseType,
  Connector,
  Scope,
  Dict,
  SortDirection,
  KeyType,
} from '@next-model/core';

export class KnexConnector implements Connector {
  knex: Knex;

  constructor(options: Knex.Config) {
    this.knex = Knex(options);
  }

  private table(tableName: string): Knex.QueryBuilder {
    return this.knex(tableName);
  }

  private async propertyFilter(query: Knex.QueryBuilder, filter: Dict<any>) {
    query = query.where(filter);
    return { query };
  }

  private async andFilter(query: Knex.QueryBuilder, filters: Filter<Dict<any>>[]) {
    const self = this;
    for (const filter of filters) {
      query = query.andWhere(async function() {
        await self.filter(this, filter);
      });
    }
    return { query };
  }

  private async notFilter(query: Knex.QueryBuilder, filter: Filter<Dict<any>>) {
    const self = this;
    query = query.whereNot(async function() {
      (await self.filter(this, filter)).query;
    });
    return { query };
  }

  private async orFilter(query: Knex.QueryBuilder, filters: Filter<Dict<any>>[]) {
    const self = this;
    for (const filter of filters) {
      query = query.orWhere(function() {
        self.filter(this, filter);
      });
    }
    return { query };
  }

  private async inFilter(query: Knex.QueryBuilder, filter: Partial<FilterIn<Dict<any>>>) {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return { query: query.whereIn(key, <any>filter[key]) };
    }
    throw '[TODO] Should not reach error';
  }

  private async notInFilter(query: Knex.QueryBuilder, filter: Partial<FilterIn<Dict<any>>>) {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return { query: query.whereNotIn(key, <any>filter[key]) };
    }
    throw '[TODO] Should not reach error';
  }

  private async nullFilter(query: Knex.QueryBuilder, key: string) {
    return { query: query.whereNull(key) };
  }

  private async notNullFilter(query: Knex.QueryBuilder, key: string) {
    return { query: query.whereNotNull(key) };
  }

  private async betweenFilter(query: Knex.QueryBuilder, filter: Partial<FilterBetween<Dict<any>>>) {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      const filterBetween = filter[key];
      if (filterBetween !== undefined) {
        return { query: query.andWhereBetween(key, [filterBetween.from, filterBetween.to]) };
      }
    }
    throw '[TODO] Should not reach error';
  }

  private async notBetweenFilter(
    query: Knex.QueryBuilder,
    filter: Partial<FilterBetween<Dict<any>>>,
  ) {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      const filterBetween = filter[key];
      if (filterBetween !== undefined) {
        return {
          query: query.andWhereNotBetween(key, [<any>filterBetween.from, <any>filterBetween.to]),
        };
      }
    }
    throw '[TODO] Should not reach error';
  }

  private async gtFilter(query: Knex.QueryBuilder, filter: Partial<Dict<any>>) {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      return { query: query.where(key, '>', <any>filter[key]) };
    }
    throw '[TODO] Should not reach error';
  }

  private async gteFilter(query: Knex.QueryBuilder, filter: Partial<Dict<any>>) {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      const value: BaseType = <any>filter[key];
      if (value !== undefined) {
        return { query: query.where(key, '>=', value) };
      }
    }
    throw '[TODO] Should not reach error';
  }

  private async ltFilter(query: Knex.QueryBuilder, filter: Partial<Dict<any>>) {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      const value: BaseType = <any>filter[key];
      if (value !== undefined) {
        return { query: query.where(key, '<', value) };
      }
    }
    throw '[TODO] Should not reach error';
  }

  private async lteFilter(query: Knex.QueryBuilder, filter: Partial<Dict<any>>) {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    for (const key in filter) {
      const value: BaseType = <any>filter[key];
      if (value !== undefined) {
        return { query: query.where(key, '<=', value) };
      }
    }
    throw '[TODO] Should not reach error';
  }

  private async rawFilter(query: Knex.QueryBuilder, filter: FilterRaw) {
    return {
      query: query.whereRaw(filter.$query, filter.$bindings || []),
    };
  }

  private async asyncFilter(query: Knex.QueryBuilder, filter: Promise<Filter<Dict<any>>>) {
    return this.filter(query, await filter);
  }

  private async specialFilter(
    query: Knex.QueryBuilder,
    filter: FilterSpecial<Dict<any>>,
  ): Promise<{ query: Knex.QueryBuilder }> {
    if (Object.keys(filter).length !== 1) throw '[TODO] Return proper error';
    if (filter.$and !== undefined) return this.andFilter(query, filter.$and);
    if (filter.$or !== undefined) return this.orFilter(query, filter.$or);
    if (filter.$not !== undefined) return this.notFilter(query, filter.$not);
    if (filter.$in !== undefined) return this.inFilter(query, filter.$in);
    if (filter.$notIn !== undefined) return this.notInFilter(query, filter.$notIn);
    if (filter.$null !== undefined) return this.nullFilter(query, filter.$null as string);
    if (filter.$notNull !== undefined) return this.notNullFilter(query, filter.$notNull as string);
    if (filter.$between !== undefined) return this.betweenFilter(query, filter.$between);
    if (filter.$notBetween !== undefined) return this.notBetweenFilter(query, filter.$notBetween);
    if (filter.$gt !== undefined) return this.gtFilter(query, filter.$gt);
    if (filter.$gte !== undefined) return this.gteFilter(query, filter.$gte);
    if (filter.$lt !== undefined) return this.ltFilter(query, filter.$lt);
    if (filter.$lte !== undefined) return this.lteFilter(query, filter.$lte);
    if (filter.$async !== undefined) return this.asyncFilter(query, filter.$async);
    if (filter.$raw !== undefined) return this.rawFilter(query, filter.$raw);
    throw '[TODO] Should not reach error';
  }

  private async filter(query: Knex.QueryBuilder, filter: Filter<Dict<any>> | undefined) {
    if (!filter || Object.keys(filter).length === 0) {
      return { query };
    }
    for (const key in filter) {
      if (key.startsWith('$')) {
        return this.specialFilter(query, <FilterSpecial<Dict<any>>>filter);
      }
    }
    return await this.propertyFilter(query, <Partial<Dict<any>>>filter);
  }

  private async collection(scope: Scope) {
    const table = this.table(scope.tableName);
    let { query } = await this.filter(table, scope.filter);
    if (scope.limit !== undefined) {
      query = query.limit(scope.limit);
    }
    if (scope.skip !== undefined) {
      query = query.offset(scope.skip);
    }
    return { query };
  }

  async query(scope: Scope): Promise<Dict<any>[]> {
    let { query } = await this.collection(scope);
    for (const order of scope.order || []) {
      const direction = order.dir === SortDirection.Asc ? 'asc' : 'desc';
      query = query.orderBy(order.key, direction);
    }
    try {
      const rows: Dict<any>[] = await query.select('*');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async count(scope: Scope): Promise<number> {
    const { query } = await this.collection(scope);
    const rows: Dict<any>[] = await query.count();
    if (rows.length >= 0) {
      for (const key in rows[0]) {
        return <any>rows[0][key];
      }
    }
    throw '[TODO] Should not reach error';
  }

  async select(scope: Scope, ...keys: string[]): Promise<Dict<any>[]> {
    let { query } = await this.collection(scope);
    for (const order of scope.order || []) {
      const direction = order.dir === SortDirection.Asc ? 'asc' : 'desc';
      query = query.orderBy(order.key, direction);
    }
    try {
      const rows: Dict<any>[] = await query.select(...keys);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  async updateAll(scope: Scope, attrs: Dict<any>): Promise<Dict<any>[]> {
    const { query } = await this.collection(scope);
    const rows = await query.update(attrs).returning(`${scope.tableName}.*`);
    return rows as Dict<any>[];
  }

  async deleteAll(scope: Scope): Promise<Dict<any>[]> {
    const { query } = await this.collection(scope);
    const rows = await query.del().returning(`${scope.tableName}.*`);
    return rows as Dict<any>[];
  }

  async batchInsert(
    tableName: string,
    keys: Dict<KeyType>,
    items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    const primaryKey = Object.keys(keys)[0];
    const table = this.table(tableName);
    const idsOrRows = await table.insert(items).returning(`${tableName}.*`);
    if (idsOrRows.length > 0 && typeof idsOrRows[0] === 'number') {
      const rows = (await this.table(tableName)
        .whereIn(primaryKey, idsOrRows)
        .select('*')) as Dict<any>[];
      const rowDict: Dict<Dict<any>> = {};
      rows.map(row => (rowDict[row[primaryKey]] = row));
      return idsOrRows.map(id => rowDict[id]);
    }
    return idsOrRows;
  }

  async execute(query: string, bindings: BaseType | BaseType[]): Promise<any[]> {
    const rows: any = await this.knex.raw(query, bindings as any);
    if (this.knex.client.config.client === 'sqlite3') {
      return rows;
    } else if (this.knex.client.config.client === 'postgres') {
      return rows.rows;
    } else {
      return rows[0];
    }
  }
}

export default KnexConnector;
