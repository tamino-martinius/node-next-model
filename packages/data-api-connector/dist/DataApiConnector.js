"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@next-model/core");
const Knex = require("knex");
class DataApiConnector {
    constructor(options) {
        this.knex = Knex({ client: 'pg' });
        this.dataApi = require('data-api-client')(options);
        if (options.debug !== undefined)
            this.debug = options.debug;
    }
    currentMilliseconds() {
        const hrTime = process.hrtime();
        return hrTime[0] * 1000 + hrTime[1] / 1000000;
    }
    async queryDataApi(query) {
        const startTime = this.currentMilliseconds();
        const sql = query.toSQL();
        if (sql.bindings.length !== (sql.sql.match(/\?/g) || []).length) {
            console.log('Possible SQL injection', sql);
            return [];
        }
        let i = 0;
        let params = {};
        const sqlStatement = sql.sql.replace(/\?/g, () => {
            const key = `param${i}`;
            params[key] = sql.bindings[i];
            i += 1;
            return `:${key}`;
        });
        const result = await this.dataApi.query(sqlStatement, params);
        if (this.debug) {
            const endTime = this.currentMilliseconds();
            const elapsedTime = endTime - startTime;
            console.log([sqlStatement, JSON.stringify(params), `${elapsedTime.toFixed(3)} ms\n`].join(' | '));
        }
        return result.records;
    }
    table(tableName) {
        return this.knex(tableName);
    }
    async propertyFilter(query, filter) {
        query = query.where(filter);
        return { query };
    }
    async andFilter(query, filters) {
        const self = this;
        for (const filter of filters) {
            query = query.andWhere(async function () {
                await self.filter(this, filter);
            });
        }
        return { query };
    }
    async notFilter(query, filter) {
        const self = this;
        query = query.whereNot(async function () {
            (await self.filter(this, filter)).query;
        });
        return { query };
    }
    async orFilter(query, filters) {
        const self = this;
        for (const filter of filters) {
            query = query.orWhere(function () {
                self.filter(this, filter);
            });
        }
        return { query };
    }
    async inFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return { query: query.whereIn(key, filter[key]) };
        }
        throw '[TODO] Should not reach error';
    }
    async notInFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return { query: query.whereNotIn(key, filter[key]) };
        }
        throw '[TODO] Should not reach error';
    }
    async nullFilter(query, key) {
        return { query: query.whereNull(key) };
    }
    async notNullFilter(query, key) {
        return { query: query.whereNotNull(key) };
    }
    async betweenFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            const filterBetween = filter[key];
            if (filterBetween !== undefined) {
                return { query: query.andWhereBetween(key, [filterBetween.from, filterBetween.to]) };
            }
        }
        throw '[TODO] Should not reach error';
    }
    async notBetweenFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            const filterBetween = filter[key];
            if (filterBetween !== undefined) {
                return {
                    query: query.andWhereNotBetween(key, [filterBetween.from, filterBetween.to]),
                };
            }
        }
        throw '[TODO] Should not reach error';
    }
    async gtFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return { query: query.where(key, '>', filter[key]) };
        }
        throw '[TODO] Should not reach error';
    }
    async gteFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            const value = filter[key];
            if (value !== undefined) {
                return { query: query.where(key, '>=', value) };
            }
        }
        throw '[TODO] Should not reach error';
    }
    async ltFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            const value = filter[key];
            if (value !== undefined) {
                return { query: query.where(key, '<', value) };
            }
        }
        throw '[TODO] Should not reach error';
    }
    async lteFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            const value = filter[key];
            if (value !== undefined) {
                return { query: query.where(key, '<=', value) };
            }
        }
        throw '[TODO] Should not reach error';
    }
    async rawFilter(query, filter) {
        return {
            query: query.whereRaw(filter.$query, filter.$bindings || []),
        };
    }
    async asyncFilter(query, filter) {
        return this.filter(query, await filter);
    }
    async specialFilter(query, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        if (filter.$and !== undefined)
            return this.andFilter(query, filter.$and);
        if (filter.$or !== undefined)
            return this.orFilter(query, filter.$or);
        if (filter.$not !== undefined)
            return this.notFilter(query, filter.$not);
        if (filter.$in !== undefined)
            return this.inFilter(query, filter.$in);
        if (filter.$notIn !== undefined)
            return this.notInFilter(query, filter.$notIn);
        if (filter.$null !== undefined)
            return this.nullFilter(query, filter.$null);
        if (filter.$notNull !== undefined)
            return this.notNullFilter(query, filter.$notNull);
        if (filter.$between !== undefined)
            return this.betweenFilter(query, filter.$between);
        if (filter.$notBetween !== undefined)
            return this.notBetweenFilter(query, filter.$notBetween);
        if (filter.$gt !== undefined)
            return this.gtFilter(query, filter.$gt);
        if (filter.$gte !== undefined)
            return this.gteFilter(query, filter.$gte);
        if (filter.$lt !== undefined)
            return this.ltFilter(query, filter.$lt);
        if (filter.$lte !== undefined)
            return this.lteFilter(query, filter.$lte);
        if (filter.$async !== undefined)
            return this.asyncFilter(query, filter.$async);
        if (filter.$raw !== undefined)
            return this.rawFilter(query, filter.$raw);
        throw '[TODO] Should not reach error';
    }
    async filter(query, filter) {
        if (!filter || Object.keys(filter).length === 0) {
            return { query };
        }
        for (const key in filter) {
            if (key.startsWith('$')) {
                return this.specialFilter(query, filter);
            }
        }
        return await this.propertyFilter(query, filter);
    }
    async collection(scope) {
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
    async query(scope) {
        let { query } = await this.collection(scope);
        for (const order of scope.order || []) {
            const direction = order.dir === core_1.SortDirection.Asc ? 'asc' : 'desc';
            query = query.orderBy(order.key, direction);
        }
        try {
            const rows = await this.queryDataApi(query.select('*'));
            return rows;
        }
        catch (error) {
            throw error;
        }
    }
    async count(scope) {
        const { query } = await this.collection(scope);
        const rows = await this.queryDataApi(query.count());
        if (rows.length >= 0) {
            for (const key in rows[0]) {
                return rows[0][key];
            }
        }
        throw '[TODO] Should not reach error';
    }
    async select(scope, ...keys) {
        let { query } = await this.collection(scope);
        for (const order of scope.order || []) {
            const direction = order.dir === core_1.SortDirection.Asc ? 'asc' : 'desc';
            query = query.orderBy(order.key, direction);
        }
        try {
            const rows = await this.queryDataApi(query.select(...keys));
            return rows;
        }
        catch (error) {
            throw error;
        }
    }
    async updateAll(scope, attrs) {
        const { query } = await this.collection(scope);
        const rows = await this.queryDataApi(query.update(attrs).returning(`${scope.tableName}.*`));
        return rows;
    }
    async deleteAll(scope) {
        const { query } = await this.collection(scope);
        const rows = await this.queryDataApi(query.del().returning(`${scope.tableName}.*`));
        return rows;
    }
    async batchInsert(tableName, keys, items) {
        const primaryKey = Object.keys(keys)[0];
        const table = this.table(tableName);
        const rows = await this.queryDataApi(table.insert(items).returning(`${tableName}.*`));
        return rows;
    }
    async execute(query, bindings) {
        throw new Error('Not implemented');
    }
}
exports.DataApiConnector = DataApiConnector;
exports.default = DataApiConnector;
