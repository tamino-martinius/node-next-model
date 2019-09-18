"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const util_1 = require("./util");
const globalStorage = {};
const globalLastIds = {};
class MemoryConnector {
    constructor(props) {
        this.storage = (props && props.storage) || globalStorage;
        this.lastIds = (props && props.lastIds) || globalLastIds;
    }
    collection(tableName) {
        return (this.storage[tableName] = this.storage[tableName] || []);
    }
    nextId(tableName) {
        this.lastIds[tableName] = this.lastIds[tableName] || 0;
        return ++this.lastIds[tableName];
    }
    async items({ tableName, filter = {}, limit, skip, order = [], }) {
        let items = await this.filter(this.collection(tableName), filter);
        if (skip && limit) {
            items = items.slice(skip, skip + limit);
        }
        else if (skip) {
            items = items.slice(skip);
        }
        else if (limit) {
            items = items.slice(0, limit);
        }
        for (let orderIndex = order.length - 1; orderIndex >= 0; orderIndex -= 1) {
            const key = order[orderIndex].key;
            const dir = order[orderIndex].dir || types_1.SortDirection.Asc;
            items = items.sort((a, b) => {
                if (a[key] > b[key]) {
                    return dir;
                }
                if (a[key] < b[key]) {
                    return -dir;
                }
                if ((a[key] === null || a[key] === undefined) &&
                    b[key] !== null &&
                    b[key] !== undefined) {
                    return dir;
                }
                if ((b[key] === null || b[key] === undefined) &&
                    a[key] !== null &&
                    a[key] !== undefined) {
                    return -dir;
                }
                return 0;
            });
        }
        return items;
    }
    async propertyFilter(items, filter) {
        // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter))
        const counts = {};
        items.forEach(item => (counts[item.id] = 0));
        for (const key in filter) {
            items.forEach(item => {
                if (item[key] === filter[key]) {
                    counts[item.id] += 1;
                }
            });
        }
        const filterCount = Object.keys(filter).length;
        return items.filter(item => counts[item.id] === filterCount);
    }
    async andFilter(items, filters) {
        // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter))
        const counts = items.reduce((obj, item) => {
            obj[item.id] = 0;
            return obj;
        }, {});
        await Promise.all(filters.map(async (filter) => {
            const filterItems = await this.filter(items, filter);
            filterItems.forEach(item => {
                counts[item.id] += 1;
            });
        }));
        const filterCount = filters.length;
        return items.filter(item => counts[item.id] === filterCount);
    }
    async notFilter(items, filter) {
        // Cost: (1, n, 1) => O(n) = 2n + O(this.filter(n))
        const array = await this.filter(items, filter);
        const exists = {};
        array.forEach(item => {
            exists[item.id] = exists[item.id] || true;
        });
        return await items.filter(item => !exists[item.id]);
    }
    async orFilter(items, filters) {
        // Cost: (1, n, m) => O(n,m) = (n) + (n * m) + (m * O(this.filter(n)))
        const arrays = await Promise.all(filters.map(async (filter) => await this.filter(items, filter)));
        const exists = {};
        arrays.forEach(array => array.forEach(item => {
            exists[item.id] = exists[item.id] || true;
        }));
        return items.filter(item => exists[item.id]);
    }
    async inFilter(items, filter) {
        // Cost: (1, n, m) => O(n, m) = n * m;
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return items.filter(item => {
                const values = filter[key];
                if (Array.isArray(values)) {
                    for (const value of values) {
                        if (item[key] === value)
                            return true;
                    }
                }
                return false;
            });
        }
        throw '[TODO] Should not reach error';
    }
    async notInFilter(items, filter) {
        // Cost: (1, n, m) => O(n, m) = n * m;
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return items.filter(item => {
                const values = filter[key];
                if (Array.isArray(values)) {
                    for (const value of values) {
                        if (item[key] === value)
                            return false;
                    }
                }
                return true;
            });
        }
        throw '[TODO] Should not reach error';
    }
    async nullFilter(items, key) {
        // Cost: (1, n, 1) => O(n) = n;
        return items.filter(item => item[key] === null || item[key] === undefined);
    }
    async notNullFilter(items, key) {
        // Cost: (1, n, 1) => O(n) = n;
        return items.filter(item => item[key] !== null && item[key] !== undefined);
    }
    async betweenFilter(items, filter) {
        // Cost: (1, n, 1) => O(n) = n;
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            const filterBetween = filter[key];
            if (filterBetween !== undefined) {
                return items.filter(item => filterBetween.to >= item[key] && item[key] >= filterBetween.from);
            }
        }
        throw '[TODO] Should not reach error';
    }
    async notBetweenFilter(items, filter) {
        // Cost: (1, n, 1) => O(n) = n;
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            const filterBetween = filter[key];
            if (filterBetween !== undefined) {
                return items.filter(item => filterBetween.to < item[key] || item[key] < filterBetween.from);
            }
        }
        throw '[TODO] Should not reach error';
    }
    async gtFilter(items, filter) {
        // Cost: (1, n, 1) => O(n) = n;
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return items.filter(item => item[key] > filter[key]);
        }
        throw '[TODO] Should not reach error';
    }
    async gteFilter(items, filter) {
        // Cost: (1, n, 1) => O(n) = n;
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return items.filter(item => item[key] >= filter[key]);
        }
        throw '[TODO] Should not reach error';
    }
    async ltFilter(items, filter) {
        // Cost: (1, n, 1) => O(n) = n;
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return items.filter(item => item[key] < filter[key]);
        }
        throw '[TODO] Should not reach error';
    }
    async lteFilter(items, filter) {
        // Cost: (1, n, 1) => O(n) = n;
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        for (const key in filter) {
            return items.filter(item => item[key] <= filter[key]);
        }
        throw '[TODO] Should not reach error';
    }
    async rawFilter(items, filter) {
        // Cost: (1, n, 1) => O(n) = n;
        const fn = eval(filter.$query);
        const params = filter.$bindings;
        if (Array.isArray(params)) {
            return items.filter(item => fn(item, ...params));
        }
        else {
            return items.filter(item => fn(item, params));
        }
    }
    async asyncFilter(items, asyncFilter) {
        const filter = await asyncFilter;
        if (filter && Object.keys(filter).length > 0) {
            return this.filter(items, filter);
        }
        else {
            return items;
        }
    }
    async specialFilter(items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        if (filter.$and !== undefined)
            return await this.andFilter(items, filter.$and);
        if (filter.$or !== undefined)
            return await this.orFilter(items, filter.$or);
        if (filter.$not !== undefined)
            return await this.notFilter(items, filter.$not);
        if (filter.$in !== undefined)
            return await this.inFilter(items, filter.$in);
        if (filter.$notIn !== undefined)
            return await this.notInFilter(items, filter.$notIn);
        if (filter.$null !== undefined)
            return await this.nullFilter(items, filter.$null);
        if (filter.$notNull !== undefined)
            return await this.notNullFilter(items, filter.$notNull);
        if (filter.$between !== undefined)
            return await this.betweenFilter(items, filter.$between);
        if (filter.$notBetween !== undefined)
            return await this.notBetweenFilter(items, filter.$notBetween);
        if (filter.$gt !== undefined)
            return await this.gtFilter(items, filter.$gt);
        if (filter.$gte !== undefined)
            return await this.gteFilter(items, filter.$gte);
        if (filter.$lt !== undefined)
            return await this.ltFilter(items, filter.$lt);
        if (filter.$lte !== undefined)
            return await this.lteFilter(items, filter.$lte);
        if (filter.$raw !== undefined)
            return await this.rawFilter(items, filter.$raw);
        if (filter.$async !== undefined)
            return await this.asyncFilter(items, filter.$async);
        throw '[TODO] Should not reach error';
    }
    async filter(items, filter = {}) {
        for (const key in filter) {
            if (key.startsWith('$')) {
                return await this.specialFilter(items, filter);
            }
        }
        return await this.propertyFilter(items, filter);
    }
    async query(scope) {
        const items = await this.items(scope);
        return util_1.clone(items);
    }
    async count(scope) {
        try {
            const items = await this.items(scope);
            return items.length;
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    async select(scope, ...keys) {
        try {
            const items = await this.items(scope);
            return items.map(item => {
                const obj = {};
                for (const key of keys) {
                    obj[key] = item[key];
                }
                return obj;
            });
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    async updateAll(scope, attrs) {
        try {
            const items = await this.items(scope);
            items.forEach(item => {
                for (const key in attrs) {
                    item[key] = attrs[key];
                }
            });
            return Promise.resolve(util_1.clone(items));
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    async deleteAll(scope) {
        try {
            const items = await this.items(scope);
            const result = util_1.clone(items);
            const collection = this.collection(scope.tableName);
            let index = 0;
            while (index < collection.length) {
                if (items.includes(collection[index])) {
                    collection.splice(index, 1);
                }
                else {
                    index += 1;
                }
            }
            return result;
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    async batchInsert(tableName, keys, items) {
        try {
            const result = [];
            for (const item of items) {
                const keyValues = {};
                for (const key in keys) {
                    switch (keys[key]) {
                        case types_1.KeyType.uuid:
                            keyValues[key] = util_1.uuid();
                            break;
                        case types_1.KeyType.number:
                            keyValues[key] = this.nextId(tableName);
                            break;
                    }
                }
                const attributes = Object.assign(Object.assign({}, item), keyValues);
                this.collection(tableName).push(attributes);
                result.push(util_1.clone(attributes));
            }
            return Promise.resolve(result);
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    async execute(query, bindings) {
        const fn = eval(query);
        if (Array.isArray(bindings)) {
            return fn(this.storage, ...bindings);
        }
        else {
            return fn(this.storage, bindings);
        }
    }
}
exports.MemoryConnector = MemoryConnector;
exports.default = MemoryConnector;
