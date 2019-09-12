import { KeyType } from './types';
import { MemoryConnector } from './MemoryConnector';
export function Model(props) {
    var _a;
    const connector = props.connector ? props.connector : new MemoryConnector();
    const order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
    const keys = props.keys || { id: KeyType.number };
    return _a = class ModelClass {
            constructor(props, keys) {
                this.changedProps = {};
                this.persistentProps = props;
                this.keys = keys;
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
                ///@ts-ignore
                let filter = andFilter;
                if (this.filter) {
                    for (const key in this.filter) {
                        if (this.filter[key] !== undefined && andFilter[key] !== undefined) {
                            ///@ts-ignore
                            filter = { $and: [filter, andFilter] };
                            break;
                        }
                        filter[key] = this.filter[key];
                    }
                }
                ///@ts-ignore
                if (Object.keys(andFilter).length === 0)
                    filter = this.filter;
                ///@ts-ignore
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
                ///@ts-ignore
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
                return new this(props.init(createProps));
            }
            static buildScoped(createProps) {
                ///@ts-ignore
                return new this(props.init({ ...props.filter, ...createProps }));
            }
            static create(props) {
                return this.build(props).save();
            }
            static createScoped(props) {
                return this.buildScoped(props).save();
            }
            static async all() {
                const items = (await connector.query(this.modelScope()));
                return items.map(item => {
                    const keys = {};
                    for (const key in keys) {
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
                const items = (await connector.select(this.modelScope(), ...keys));
                return items;
            }
            static async pluck(key) {
                const items = await this.select(key);
                return items.map(item => item[key]);
            }
            get isPersistent() {
                return this.keys !== undefined;
            }
            get isNew() {
                return this.keys === undefined;
            }
            get attributes() {
                ///@ts-ignore
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
            get itemScope() {
                return {
                    tableName: props.tableName,
                    filter: this.keys,
                    limit: 1,
                    skip: 0,
                    order: [],
                };
            }
            async save() {
                if (this.keys) {
                    const changedKeys = Object.keys(this.changedProps);
                    if (changedKeys.length > 0) {
                        const items = await connector.updateAll(this.itemScope, this.changedProps);
                        const item = items.pop();
                        if (item) {
                            for (const key in keys) {
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
                    const items = await connector.batchInsert(props.tableName, keys, [
                        ///@ts-ignore
                        { ...this.persistentProps, ...this.changedProps },
                    ]);
                    const item = items.pop();
                    if (item) {
                        this.keys = {};
                        for (const key in keys) {
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
        },
        _a.tableName = props.tableName,
        _a.filter = props.filter,
        _a.limit = props.limit,
        _a.skip = props.skip,
        _a.order = order,
        _a;
}
//# sourceMappingURL=Model.mjs.map