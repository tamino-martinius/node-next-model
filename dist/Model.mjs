import { KeyType, } from './types';
import { MemoryConnector } from './MemoryConnector';
export function Model({ tableName, init, filter, limit, skip, order = [], connector, keys = { id: KeyType.number }, }) {
    const conn = connector ? connector : new MemoryConnector();
    const params = {
        tableName,
        init,
        filter,
        limit,
        skip,
        order,
        connector,
        keys,
    };
    const orderColumns = order
        ? Array.isArray(order)
            ? order
            : [order]
        : [];
    const modelScope = {
        tableName,
        filter,
        limit,
        skip,
        order: orderColumns,
    };
    ///@ts-ignore
    return class M {
        constructor(props, keys) {
            this.changedProps = {};
            this.persistentProps = props;
            this.keys = keys;
        }
        static limitBy(amount) {
            return Model({ ...params, limit: amount });
        }
        static get unlimited() {
            return Model({ ...params, limit: undefined });
        }
        static skipBy(amount) {
            return Model({ ...params, skip: amount });
        }
        static get unskipped() {
            return Model({ ...params, skip: undefined });
        }
        static orderBy(order) {
            return Model({
                ...params,
                order: [...orderColumns, ...(Array.isArray(order) ? order : [order])],
            });
        }
        static get unordered() {
            return Model({ ...params, order: undefined });
        }
        static reorder(order) {
            return Model({
                ...params,
                order: [...orderColumns, ...(Array.isArray(order) ? order : [order])],
            });
        }
        static filterBy(andFilter) {
            if (Object.keys(andFilter).length === 0) {
                return Model(params); // Short circuit if no new filters are passed
            }
            if (filter) {
                ///@ts-ignore
                const flatFilter = { ...filter };
                for (const key in andFilter) {
                    if (flatFilter[key] !== undefined && andFilter[key] !== undefined) {
                        ///@ts-ignore
                        return Model({ ...params, filter: { $and: [filter, andFilter] } });
                    }
                    flatFilter[key] = andFilter[key];
                }
                ///@ts-ignore
                return Model({ ...params, filter: flatFilter });
            }
            ///@ts-ignore
            return Model({ ...params, filter: andFilter });
        }
        static orFilterBy(orFilter) {
            if (Object.keys(orFilter).length === 0) {
                ///@ts-ignore
                return Model(params); // Short circuit if no new filters are passed
            }
            ///@ts-ignore
            return Model({ ...params, filter: filter ? { $or: [filter, orFilter] } : orFilter });
        }
        static get unfiltered() {
            return Model({ ...params, filter: undefined });
        }
        static build(props) {
            return new M(init(props));
        }
        static buildScoped(props) {
            ///@ts-ignore
            return new M(init({ ...filter, ...props }));
        }
        static create(props) {
            return this.build(props).save();
        }
        static createScoped(props) {
            return this.buildScoped(props).save();
        }
        static async all() {
            const items = (await conn.query(modelScope));
            return items.map(item => {
                const keys = {};
                for (const key in keys) {
                    keys[key] = item[key];
                    delete item[key];
                }
                return new M(item, keys);
            });
        }
        static async first() {
            const items = await this.limitBy(1).all();
            return items.pop();
        }
        static async select(...keys) {
            const items = (await conn.select(modelScope, ...keys));
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
                tableName: tableName,
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
                    const items = await conn.updateAll(this.itemScope, this.changedProps);
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
                const items = await conn.batchInsert(tableName, keys, [
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
    };
}
// [TODO] Remove example below
class User extends Model({
    tableName: 'users',
    init: (props) => props,
}) {
    static get males() {
        return this.filterBy({ gender: 'male' });
    }
    static get females() {
        return this.filterBy({ gender: 'female' });
    }
    static withFirstName(firstName) {
        return this.filterBy({ firstName });
    }
    get addresses() {
        return Address.filterBy({ id: this.attributes.id });
    }
    get name() {
        return `${this.attributes.firstName} ${this.attributes.lastName}`;
    }
}
class Address extends Model({
    tableName: 'addresses',
    init: (props) => props,
}) {
    get user() {
        return User.filterBy({ id: this.attributes.userId }).first;
    }
}
//# sourceMappingURL=Model.mjs.map