import { filterList } from './FilterEngine';
import { defineTable } from './schema';
import { KeyType, SortDirection, } from './types';
import { clone, uuid } from './util';
const globalStorage = {};
const globalLastIds = {};
export class MemoryConnector {
    constructor(props) {
        this.inTransaction = false;
        this.storage = props?.storage || globalStorage;
        this.lastIds = props?.lastIds || globalLastIds;
    }
    collection(tableName) {
        // biome-ignore lint/suspicious/noAssignInExpressions: lazy-init pattern
        return (this.storage[tableName] = this.storage[tableName] || []);
    }
    nextId(tableName) {
        this.lastIds[tableName] = this.lastIds[tableName] || 0;
        return ++this.lastIds[tableName];
    }
    async items({ tableName, filter = {}, limit, skip, order = [], }) {
        let items = await filterList(this.collection(tableName), filter);
        for (let orderIndex = order.length - 1; orderIndex >= 0; orderIndex -= 1) {
            const key = order[orderIndex].key;
            const dir = order[orderIndex].dir || SortDirection.Asc;
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
        if (skip && limit) {
            items = items.slice(skip, skip + limit);
        }
        else if (skip) {
            items = items.slice(skip);
        }
        else if (limit) {
            items = items.slice(0, limit);
        }
        return items;
    }
    async query(scope) {
        const items = await this.items(scope);
        return clone(items);
    }
    async count(scope) {
        const items = await this.items(scope);
        return items.length;
    }
    async select(scope, ...keys) {
        const items = await this.items(scope);
        return items.map((item) => {
            const obj = {};
            for (const key of keys) {
                obj[key] = item[key];
            }
            return obj;
        });
    }
    async updateAll(scope, attrs) {
        const items = await this.items(scope);
        items.forEach((item) => {
            for (const key in attrs) {
                item[key] = attrs[key];
            }
        });
        return clone(items);
    }
    async deleteAll(scope) {
        const items = await this.items(scope);
        const result = clone(items);
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
    async batchInsert(tableName, keys, items) {
        const result = [];
        for (const item of items) {
            const keyValues = {};
            for (const key in keys) {
                switch (keys[key]) {
                    case KeyType.uuid:
                        keyValues[key] = uuid();
                        break;
                    case KeyType.number:
                        keyValues[key] = this.nextId(tableName);
                        break;
                    case KeyType.manual:
                        break;
                }
            }
            const attributes = { ...item, ...keyValues };
            this.collection(tableName).push(attributes);
            result.push(clone(attributes));
        }
        return result;
    }
    async hasTable(tableName) {
        return Object.prototype.hasOwnProperty.call(this.storage, tableName);
    }
    async createTable(tableName, blueprint) {
        defineTable(tableName, blueprint);
        if (!Object.prototype.hasOwnProperty.call(this.storage, tableName)) {
            this.storage[tableName] = [];
        }
    }
    async dropTable(tableName) {
        delete this.storage[tableName];
        delete this.lastIds[tableName];
    }
    async aggregate(scope, kind, key) {
        const items = await this.items(scope);
        const values = items
            .map((item) => item[key])
            .filter((v) => typeof v === 'number' && !Number.isNaN(v));
        if (values.length === 0)
            return undefined;
        switch (kind) {
            case 'sum':
                return values.reduce((acc, v) => acc + v, 0);
            case 'min':
                return Math.min(...values);
            case 'max':
                return Math.max(...values);
            case 'avg':
                return values.reduce((acc, v) => acc + v, 0) / values.length;
        }
    }
    async execute(query, bindings) {
        const fn = compileExecute(query);
        if (Array.isArray(bindings)) {
            return fn(this.storage, ...bindings);
        }
        return fn(this.storage, bindings);
    }
    async transaction(fn) {
        if (this.inTransaction)
            return fn();
        const storageSnapshot = structuredClone(this.storage);
        const lastIdsSnapshot = { ...this.lastIds };
        this.inTransaction = true;
        try {
            const result = await fn();
            this.inTransaction = false;
            return result;
        }
        catch (err) {
            for (const key in this.storage)
                delete this.storage[key];
            Object.assign(this.storage, storageSnapshot);
            for (const key in this.lastIds)
                delete this.lastIds[key];
            Object.assign(this.lastIds, lastIdsSnapshot);
            this.inTransaction = false;
            throw err;
        }
    }
}
function compileExecute(source) {
    // biome-ignore lint/security/noGlobalEval: MemoryConnector.execute evaluates raw query strings by design
    return eval(source);
}
export default MemoryConnector;
//# sourceMappingURL=MemoryConnector.js.map