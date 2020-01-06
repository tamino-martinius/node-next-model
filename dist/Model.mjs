import { KeyType } from './types';
import { MemoryConnector } from './MemoryConnector';
export class ModelClass {
    constructor(props, keys) {
        this.changedProps = {};
        this.persistentProps = props;
        this.keys = keys;
        for (const key in this.persistentProps) {
            Object.defineProperty(this, key, {
                get: () => this.attributes()[key],
                set: value => this.assign({ [key]: value }),
            });
        }
        const model = this.constructor;
        for (const key in model.keys) {
            Object.defineProperty(this, key, {
                get: () => (this.keys ? this.keys[key] : undefined),
            });
        }
    }
    static modelScope() {
        return {
            tableName: this.tableName,
            filter: this.filter,
            limit: this.limit,
            skip: this.skip,
            order: this.order,
        };
    }
    static limitBy(amount) {
        var _a;
        return _a = class extends this {
            },
            _a.limit = amount,
            _a;
    }
    static unlimited() {
        var _a;
        return _a = class extends this {
            },
            _a.limit = undefined,
            _a;
    }
    static skipBy(amount) {
        var _a;
        return _a = class extends this {
            },
            _a.skip = amount,
            _a;
    }
    static unskipped() {
        var _a;
        return _a = class extends this {
            },
            _a.skip = undefined,
            _a;
    }
    static orderBy(order) {
        var _a;
        const newOrder = [...this.order, ...(Array.isArray(order) ? order : [order])];
        return _a = class extends this {
            },
            _a.order = newOrder,
            _a;
    }
    static unordered() {
        var _a;
        return _a = class extends this {
            },
            _a.order = [],
            _a;
    }
    static reorder(order) {
        var _a;
        return _a = class extends this {
            },
            _a.order = Array.isArray(order) ? order : [order],
            _a;
    }
    static filterBy(andFilter) {
        var _a;
        let filter = andFilter;
        if (this.filter) {
            for (const key in this.filter) {
                if (this.filter[key] !== undefined && andFilter[key] !== undefined) {
                    filter = { $and: [filter, andFilter] };
                    break;
                }
                filter[key] = this.filter[key];
            }
        }
        if (Object.keys(andFilter).length === 0)
            filter = this.filter;
        return _a = class extends this {
            },
            _a.filter = filter,
            _a;
    }
    static orFilterBy(orFilter) {
        var _a;
        const filter = Object.keys(orFilter).length === 0
            ? this.filter
            : this.filter
                ? { $or: [this.filter, orFilter] }
                : orFilter;
        return _a = class extends this {
            },
            _a.filter = filter,
            _a;
    }
    static unfiltered() {
        var _a;
        return _a = class extends this {
            },
            _a.filter = undefined,
            _a;
    }
    static build(createProps) {
        return new this(this.init(createProps));
    }
    static buildScoped(createProps) {
        return new this(this.init({ ...this.filter, ...createProps }));
    }
    static create(createProps) {
        return this.build(createProps).save();
    }
    static createScoped(props) {
        return this.buildScoped(props).save();
    }
    static async all() {
        const items = await this.connector.query(this.modelScope());
        return items.map(item => {
            const keys = {};
            for (const key in this.keys) {
                keys[key] = item[key];
                delete item[key];
            }
            return new this(item, keys);
        });
    }
    static async first() {
        const items = await this.limitBy(1).all();
        return items.pop();
    }
    static async select(...keys) {
        const items = await this.connector.select(this.modelScope(), ...keys);
        return items;
    }
    static async pluck(key) {
        const items = await this.select(key);
        return items.map(item => item[key]);
    }
    static async count() {
        return await this.connector.count(this.modelScope());
    }
    isPersistent() {
        return this.keys !== undefined;
    }
    isNew() {
        return this.keys === undefined;
    }
    attributes() {
        return { ...this.persistentProps, ...this.changedProps, ...this.keys };
    }
    assign(props) {
        for (const key in props) {
            if (this.persistentProps[key] !== props[key]) {
                this.changedProps[key] = props[key];
            }
            else {
                delete this.changedProps[key];
            }
        }
        return this;
    }
    itemScope() {
        const model = this.constructor;
        return {
            tableName: model.tableName,
            filter: this.keys,
            limit: 1,
            skip: 0,
            order: [],
        };
    }
    async save() {
        const model = this.constructor;
        if (this.keys) {
            const changedKeys = Object.keys(this.changedProps);
            if (changedKeys.length > 0) {
                const items = await model.connector.updateAll(this.itemScope(), this.changedProps);
                const item = items.pop();
                if (item) {
                    for (const key in model.keys) {
                        this.keys[key] = item[key];
                        delete item[key];
                    }
                    this.persistentProps = item;
                    this.changedProps = {};
                }
                else {
                    throw 'Item not found';
                }
            }
        }
        else {
            const items = await model.connector.batchInsert(model.tableName, model.keys, [
                { ...this.persistentProps, ...this.changedProps },
            ]);
            const item = items.pop();
            if (item) {
                this.keys = {};
                for (const key in model.keys) {
                    this.keys[key] = item[key];
                    delete item[key];
                }
                this.persistentProps = item;
                this.changedProps = {};
            }
            else {
                throw 'Failed to insert item';
            }
        }
        return this;
    }
}
export function Model(props) {
    var _a;
    const connector = props.connector ? props.connector : new MemoryConnector();
    const order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
    const keyDefinitions = props.keys || { id: KeyType.number };
    return _a = class Model extends ModelClass {
            constructor(props, keys) {
                super(props, keys);
                this.changedProps = {};
            }
            static orderBy(order) {
                return super.orderBy(order);
            }
            static reorder(order) {
                return super.reorder(order);
            }
            static filterBy(filter) {
                return super.filterBy(filter);
            }
            static orFilterBy(filter) {
                return super.orFilterBy(filter);
            }
            static async select(...keys) {
                return super.select(...keys);
            }
            static async pluck(key) {
                return super.pluck(key);
            }
            static async all() {
                return (await super.all());
            }
            static async first() {
                return (await super.first());
            }
            static async count() {
                return await super.count();
            }
            static build(props) {
                return super.build(props);
            }
            static buildScoped(props) {
                return super.buildScoped(props);
            }
            static async create(props) {
                return (await super.create(props));
            }
            static async createScoped(props) {
                return (await super.createScoped(props));
            }
            attributes() {
                return {
                    ...this.persistentProps,
                    ...this.changedProps,
                    ...this.keys,
                };
            }
            assign(props) {
                for (const key in props) {
                    if (this.persistentProps[key] !== props[key]) {
                        this.changedProps[key] = props[key];
                    }
                    else {
                        delete this.changedProps[key];
                    }
                }
                return this;
            }
        },
        _a.tableName = props.tableName,
        _a.filter = props.filter,
        _a.limit = props.limit,
        _a.skip = props.skip,
        _a.order = order,
        _a.keys = keyDefinitions,
        _a.connector = connector,
        _a.init = props.init,
        _a;
}
export default Model;
