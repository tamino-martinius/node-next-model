import { NotFoundError, PersistenceError, ValidationError } from './errors';
import { KeyType, SortDirection, } from './types';
import { MemoryConnector } from './MemoryConnector';
import { singularize } from './util';
export class ModelClass {
    static { this.timestamps = true; }
    static { this.softDelete = false; }
    static { this.validators = []; }
    static { this.callbacks = {}; }
    static async transaction(fn) {
        return this.connector.transaction(fn);
    }
    static modelScope() {
        let filter = this.filter;
        if (this.softDelete === 'active') {
            filter = filter ? { $and: [{ $null: 'discardedAt' }, filter] } : { $null: 'discardedAt' };
        }
        else if (this.softDelete === 'only') {
            filter = filter
                ? { $and: [{ $notNull: 'discardedAt' }, filter] }
                : { $notNull: 'discardedAt' };
        }
        return {
            tableName: this.tableName,
            filter,
            limit: this.limit,
            skip: this.skip,
            order: this.order,
        };
    }
    static limitBy(amount) {
        return class extends this {
            static { this.limit = amount; }
        };
    }
    static unlimited() {
        return class extends this {
            static { this.limit = undefined; }
        };
    }
    static skipBy(amount) {
        return class extends this {
            static { this.skip = amount; }
        };
    }
    static unskipped() {
        return class extends this {
            static { this.skip = undefined; }
        };
    }
    static orderBy(order) {
        const newOrder = [...this.order, ...(Array.isArray(order) ? order : [order])];
        return class extends this {
            static { this.order = newOrder; }
        };
    }
    static unordered() {
        return class extends this {
            static { this.order = []; }
        };
    }
    static reorder(order) {
        return class extends this {
            static { this.order = Array.isArray(order) ? order : [order]; }
        };
    }
    static filterBy(andFilter) {
        const hasSpecial = (f) => Object.keys(f).some((k) => k.startsWith('$'));
        let filter = andFilter;
        if (this.filter) {
            if (hasSpecial(this.filter) || hasSpecial(andFilter)) {
                filter = { $and: [this.filter, andFilter] };
            }
            else {
                for (const key in this.filter) {
                    if (this.filter[key] !== undefined && andFilter[key] !== undefined) {
                        filter = { $and: [filter, andFilter] };
                        break;
                    }
                    filter[key] = this.filter[key];
                }
            }
        }
        if (Object.keys(andFilter).length === 0)
            filter = this.filter;
        return class extends this {
            static { this.filter = filter; }
        };
    }
    static orFilterBy(orFilter) {
        const filter = Object.keys(orFilter).length === 0
            ? this.filter
            : this.filter
                ? { $or: [this.filter, orFilter] }
                : orFilter;
        return class extends this {
            static { this.filter = filter; }
        };
    }
    static unfiltered() {
        return class extends this {
            static { this.filter = undefined; }
        };
    }
    static reverse() {
        const primaryKey = Object.keys(this.keys)[0] ?? 'id';
        const existing = this.order.length > 0 ? this.order : [{ key: primaryKey }];
        const flipped = existing.map((col) => ({
            key: col.key,
            dir: (col.dir ?? SortDirection.Asc) === SortDirection.Asc
                ? SortDirection.Desc
                : SortDirection.Asc,
        }));
        return class extends this {
            static { this.order = flipped; }
        };
    }
    static unscoped() {
        return class extends this {
            static { this.filter = undefined; }
            static { this.limit = undefined; }
            static { this.skip = undefined; }
            static { this.order = []; }
            static { this.softDelete = false; }
        };
    }
    static on(event, handler) {
        if (!this.callbacks[event])
            this.callbacks[event] = [];
        const list = this.callbacks[event];
        list.push(handler);
        return () => {
            const idx = list.indexOf(handler);
            if (idx >= 0)
                list.splice(idx, 1);
        };
    }
    static withDiscarded() {
        return class extends this {
            static { this.softDelete = false; }
        };
    }
    static onlyDiscarded() {
        return class extends this {
            static { this.softDelete = 'only'; }
        };
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
    static async createMany(propsList) {
        const now = new Date();
        const insertProps = propsList.map((p) => {
            const base = this.init(p);
            if (this.timestamps) {
                if (base.createdAt === undefined)
                    base.createdAt = now;
                if (base.updatedAt === undefined)
                    base.updatedAt = now;
            }
            return base;
        });
        const items = await this.connector.batchInsert(this.tableName, this.keys, insertProps);
        return items.map((item) => {
            const keys = {};
            for (const key in this.keys) {
                keys[key] = item[key];
                delete item[key];
            }
            return new this(item, keys);
        });
    }
    static async all() {
        const items = await this.connector.query(this.modelScope());
        return items.map((item) => {
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
    static async last() {
        return this.reverse().first();
    }
    static async *inBatchesOf(size) {
        const batchSize = Math.max(1, Math.floor(size));
        const primaryKey = Object.keys(this.keys)[0] ?? 'id';
        const ordered = this.order.length > 0 ? this : this.orderBy({ key: primaryKey });
        const baseSkip = this.skip ?? 0;
        const totalLimit = this.limit;
        let offset = 0;
        while (true) {
            const remaining = totalLimit === undefined ? batchSize : totalLimit - offset;
            if (remaining <= 0)
                return;
            const take = Math.min(batchSize, remaining);
            const batch = await ordered
                .unlimited()
                .unskipped()
                .skipBy(baseSkip + offset)
                .limitBy(take)
                .all();
            if (batch.length === 0)
                return;
            yield batch;
            if (batch.length < take)
                return;
            offset += batch.length;
        }
    }
    static async *findEach(size = 100) {
        for await (const batch of this.inBatchesOf(size)) {
            for (const item of batch)
                yield item;
        }
    }
    static async paginate(page, perPage = 25) {
        const safePage = Math.max(1, Math.floor(page));
        const safePerPage = Math.max(1, Math.floor(perPage));
        const skip = (safePage - 1) * safePerPage;
        const scoped = this.limitBy(safePerPage).skipBy(skip);
        const [items, total] = await Promise.all([
            scoped.all(),
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
    static async ids() {
        const primaryKey = Object.keys(this.keys)[0] ?? 'id';
        return this.pluck(primaryKey);
    }
    static async select(...keys) {
        const items = await this.connector.select(this.modelScope(), ...keys);
        return items;
    }
    static async pluck(key) {
        const items = await this.select(key);
        return items.map((item) => item[key]);
    }
    static async pluckUnique(key) {
        const values = await this.pluck(key);
        const seen = new Set();
        const result = [];
        for (const v of values) {
            if (!seen.has(v)) {
                seen.add(v);
                result.push(v);
            }
        }
        return result;
    }
    static async count() {
        return await this.connector.count(this.modelScope());
    }
    static async countBy(key) {
        const values = await this.pluck(key);
        const result = new Map();
        for (const value of values) {
            result.set(value, (result.get(value) ?? 0) + 1);
        }
        return result;
    }
    static async groupBy(key) {
        const items = await this.all();
        const result = new Map();
        for (const item of items) {
            const bucket = item.attributes()[key];
            const list = result.get(bucket);
            if (list) {
                list.push(item);
            }
            else {
                result.set(bucket, [item]);
            }
        }
        return result;
    }
    static async preloadBelongsTo(records, options) {
        const fk = options.foreignKey;
        const pk = options.primaryKey ?? Object.keys(this.keys)[0] ?? 'id';
        const ids = new Set();
        for (const record of records) {
            const attrs = typeof record?.attributes === 'function' ? record.attributes() : record;
            const value = attrs?.[fk];
            if (value !== undefined && value !== null)
                ids.add(value);
        }
        if (ids.size === 0)
            return new Map();
        const related = await this.filterBy({ $in: { [pk]: [...ids] } }).all();
        const result = new Map();
        for (const r of related) {
            const key = r.attributes()[pk];
            result.set(key, r);
        }
        return result;
    }
    static async preloadHasMany(records, options) {
        const fk = options.foreignKey;
        const pk = options.primaryKey ?? 'id';
        const ids = new Set();
        for (const record of records) {
            const attrs = typeof record?.attributes === 'function' ? record.attributes() : record;
            const value = attrs?.[pk];
            if (value !== undefined && value !== null)
                ids.add(value);
        }
        const result = new Map();
        for (const id of ids)
            result.set(id, []);
        if (ids.size === 0)
            return result;
        const related = await this.filterBy({ $in: { [fk]: [...ids] } }).all();
        for (const r of related) {
            const key = r.attributes()[fk];
            const list = result.get(key);
            if (list)
                list.push(r);
            else
                result.set(key, [r]);
        }
        return result;
    }
    static async aggregate(kind, key) {
        return await this.connector.aggregate(this.modelScope(), kind, key);
    }
    static async sum(key) {
        return (await this.aggregate('sum', key)) ?? 0;
    }
    static async min(key) {
        return this.aggregate('min', key);
    }
    static async max(key) {
        return this.aggregate('max', key);
    }
    static async avg(key) {
        return this.aggregate('avg', key);
    }
    static async deleteAll() {
        return await this.connector.deleteAll(this.modelScope());
    }
    static async updateAll(attrs) {
        const effectiveAttrs = { ...attrs };
        if (this.timestamps && effectiveAttrs.updatedAt === undefined) {
            effectiveAttrs.updatedAt = new Date();
        }
        return await this.connector.updateAll(this.modelScope(), effectiveAttrs);
    }
    static async findBy(filter) {
        return await this.filterBy(filter).first();
    }
    static async exists(filter) {
        const scoped = filter === undefined ? this : this.filterBy(filter);
        return (await scoped.count()) > 0;
    }
    static async find(id) {
        const primaryKey = Object.keys(this.keys)[0] ?? 'id';
        const record = await this.findBy({ [primaryKey]: id });
        if (!record) {
            throw new NotFoundError(`${this.name || 'Record'} with ${primaryKey}=${id} not found`);
        }
        return record;
    }
    static async findOrFail(filter) {
        const record = await this.findBy(filter);
        if (!record)
            throw new NotFoundError('Record not found');
        return record;
    }
    static async findOrBuild(filter, createProps) {
        const record = await this.findBy(filter);
        if (record)
            return record;
        return this.build({ ...filter, ...createProps });
    }
    static async firstOrCreate(filter, createProps = {}) {
        const record = await this.findBy(filter);
        if (record)
            return record;
        return this.create({ ...filter, ...createProps });
    }
    static async updateOrCreate(filter, attrs) {
        const record = await this.findBy(filter);
        if (record) {
            return record.update(attrs);
        }
        return this.create({ ...filter, ...attrs });
    }
    constructor(props, keys) {
        this.changedProps = {};
        this.lastSavedChanges = {};
        this.persistentProps = props;
        this.keys = keys;
        for (const key in this.persistentProps) {
            Object.defineProperty(this, key, {
                get: () => this.attributes()[key],
                set: (value) => this.assign({ [key]: value }),
            });
        }
        const model = this.constructor;
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
    attributes() {
        return { ...this.persistentProps, ...this.changedProps, ...this.keys };
    }
    toJSON() {
        return this.attributes();
    }
    pick(keys) {
        const attrs = this.attributes();
        const result = {};
        for (const key of keys) {
            if (key in attrs)
                result[key] = attrs[key];
        }
        return result;
    }
    omit(keys) {
        const attrs = this.attributes();
        const skip = new Set(keys);
        const result = {};
        for (const key in attrs) {
            if (!skip.has(key))
                result[key] = attrs[key];
        }
        return result;
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
    isChanged() {
        return Object.keys(this.changedProps).length > 0;
    }
    isChangedBy(key) {
        return key in this.changedProps;
    }
    changes() {
        const result = {};
        for (const key in this.changedProps) {
            result[key] = { from: this.persistentProps[key], to: this.changedProps[key] };
        }
        return result;
    }
    savedChanges() {
        return { ...this.lastSavedChanges };
    }
    savedChangeBy(key) {
        return this.lastSavedChanges[key];
    }
    wasChanged() {
        return Object.keys(this.lastSavedChanges).length > 0;
    }
    wasChangedBy(key) {
        return key in this.lastSavedChanges;
    }
    revertChange(key) {
        delete this.changedProps[key];
        return this;
    }
    revertChanges() {
        this.changedProps = {};
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
    belongsTo(Related, options = {}) {
        const poly = options.polymorphic;
        const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(Related.tableName)}Id`);
        const pk = options.primaryKey ?? Object.keys(Related.keys)[0] ?? 'id';
        const attrs = this.attributes();
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
        return Related.findBy({ [pk]: fkValue });
    }
    hasMany(Related, options = {}) {
        const selfModel = this.constructor;
        const poly = options.polymorphic;
        const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(selfModel.tableName)}Id`);
        const pk = options.primaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
        const pkValue = this[pk];
        const filter = { [fk]: pkValue };
        if (poly) {
            const typeKey = options.typeKey ?? `${poly}Type`;
            filter[typeKey] = options.typeValue ?? selfModel.tableName;
        }
        return Related.filterBy(filter);
    }
    hasOne(Related, options = {}) {
        const selfModel = this.constructor;
        const poly = options.polymorphic;
        const fk = options.foreignKey ?? (poly ? `${poly}Id` : `${singularize(selfModel.tableName)}Id`);
        const pk = options.primaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
        const pkValue = this[pk];
        if (pkValue === undefined || pkValue === null) {
            return Promise.resolve(undefined);
        }
        const filter = { [fk]: pkValue };
        if (poly) {
            const typeKey = options.typeKey ?? `${poly}Type`;
            filter[typeKey] = options.typeValue ?? selfModel.tableName;
        }
        return Related.findBy(filter);
    }
    hasManyThrough(Target, Through, options = {}) {
        const selfModel = this.constructor;
        const throughFk = options.throughForeignKey ?? `${singularize(selfModel.tableName)}Id`;
        const targetFk = options.targetForeignKey ?? `${singularize(Target.tableName)}Id`;
        const selfPk = options.selfPrimaryKey ?? Object.keys(selfModel.keys)[0] ?? 'id';
        const targetPk = options.targetPrimaryKey ?? Object.keys(Target.keys)[0] ?? 'id';
        const selfPkValue = this[selfPk];
        const asyncPending = (async () => {
            const ids = await Through.filterBy({ [throughFk]: selfPkValue }).pluck(targetFk);
            return { $in: { [targetPk]: ids } };
        })();
        return Target.filterBy({ $async: asyncPending });
    }
    async increment(key, by = 1) {
        if (!this.keys) {
            throw new PersistenceError('Cannot increment a record that has not been saved');
        }
        const current = Number(this.attributes()[key] ?? 0);
        return this.update({ [key]: current + by });
    }
    async decrement(key, by = 1) {
        return this.increment(key, -by);
    }
    async isValid() {
        const model = this.constructor;
        for (const validator of model.validators) {
            if (!(await validator(this)))
                return false;
        }
        return true;
    }
    async runCallbacks(kind) {
        const model = this.constructor;
        const callbacks = model.callbacks[kind];
        if (!callbacks)
            return;
        for (const callback of callbacks) {
            await callback(this);
        }
    }
    async save() {
        const model = this.constructor;
        if (!(await this.isValid())) {
            throw new ValidationError('Validation failed');
        }
        const now = new Date();
        const isInsert = !this.keys;
        await this.runCallbacks('beforeSave');
        await this.runCallbacks(isInsert ? 'beforeCreate' : 'beforeUpdate');
        const snapshot = {};
        if (this.keys) {
            const changedKeys = Object.keys(this.changedProps);
            if (changedKeys.length > 0) {
                if (model.timestamps) {
                    this.changedProps.updatedAt = now;
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
                }
                else {
                    throw new NotFoundError('Item not found');
                }
            }
        }
        else {
            const insertProps = { ...this.persistentProps, ...this.changedProps };
            if (model.timestamps) {
                if (insertProps.createdAt === undefined)
                    insertProps.createdAt = now;
                if (insertProps.updatedAt === undefined)
                    insertProps.updatedAt = now;
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
            }
            else {
                throw new PersistenceError('Failed to insert item');
            }
        }
        this.lastSavedChanges = snapshot;
        await this.runCallbacks(isInsert ? 'afterCreate' : 'afterUpdate');
        await this.runCallbacks('afterSave');
        return this;
    }
    async update(attrs) {
        this.assign(attrs);
        return this.save();
    }
    async touch() {
        if (!this.keys) {
            throw new PersistenceError('Cannot touch a record that has not been saved');
        }
        const model = this.constructor;
        const now = new Date();
        const items = await model.connector.updateAll(this.itemScope(), { updatedAt: now });
        const item = items.pop();
        if (!item)
            throw new NotFoundError('Item not found');
        for (const key in model.keys)
            delete item[key];
        this.persistentProps = item;
        this.changedProps = {};
        return this;
    }
    async reload() {
        if (!this.keys) {
            throw new PersistenceError('Cannot reload a record that has not been saved');
        }
        const model = this.constructor;
        const items = await model.connector.query(this.itemScope());
        const item = items.pop();
        if (!item)
            throw new NotFoundError('Item not found');
        for (const key in model.keys)
            delete item[key];
        this.persistentProps = item;
        this.changedProps = {};
        return this;
    }
    async delete() {
        if (!this.keys) {
            throw new PersistenceError('Cannot delete a record that has not been saved');
        }
        const model = this.constructor;
        await this.runCallbacks('beforeDelete');
        const items = await model.connector.deleteAll(this.itemScope());
        if (items.length === 0) {
            throw new NotFoundError('Item not found');
        }
        this.persistentProps = { ...this.persistentProps, ...this.changedProps, ...this.keys };
        this.changedProps = {};
        this.keys = undefined;
        await this.runCallbacks('afterDelete');
        return this;
    }
    isDiscarded() {
        const value = this.attributes().discardedAt;
        return value !== null && value !== undefined;
    }
    async discard() {
        if (!this.keys) {
            throw new PersistenceError('Cannot discard a record that has not been saved');
        }
        this.assign({ discardedAt: new Date() });
        return this.save();
    }
    async restore() {
        if (!this.keys) {
            throw new PersistenceError('Cannot restore a record that has not been saved');
        }
        this.assign({ discardedAt: null });
        return this.save();
    }
}
export function Model(props) {
    const connector = props.connector ? props.connector : new MemoryConnector();
    const order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
    const keyDefinitions = props.keys || { id: KeyType.number };
    const timestamps = props.timestamps ?? true;
    const softDelete = props.softDelete ? 'active' : false;
    const validators = props.validators || [];
    const callbacks = props.callbacks || {};
    const scopeDefs = props.scopes || {};
    const ModelSubclass = class Model extends ModelClass {
        static { this.tableName = props.tableName; }
        static { this.filter = props.filter; }
        static { this.limit = props.limit; }
        static { this.skip = props.skip; }
        static { this.order = order; }
        static { this.keys = keyDefinitions; }
        static { this.connector = connector; }
        static { this.init = props.init; }
        static { this.timestamps = timestamps; }
        static { this.softDelete = softDelete; }
        static { this.validators = validators; }
        static { this.callbacks = callbacks; }
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
        static on(event, handler) {
            return super.on(event, handler);
        }
        static async select(...keys) {
            return super.select(...keys);
        }
        static async pluck(key) {
            return super.pluck(key);
        }
        static async pluckUnique(key) {
            return super.pluckUnique(key);
        }
        static async ids() {
            return super.ids();
        }
        static async all() {
            return (await super.all());
        }
        static async first() {
            return (await super.first());
        }
        static async last() {
            return (await super.last());
        }
        static async *inBatchesOf(size) {
            for await (const batch of super.inBatchesOf(size)) {
                yield batch;
            }
        }
        static async *findEach(size) {
            for await (const item of super.findEach(size)) {
                yield item;
            }
        }
        static async paginate(page, perPage) {
            const result = await super.paginate(page, perPage);
            return result;
        }
        static async count() {
            return await super.count();
        }
        static async countBy(key) {
            return super.countBy(key);
        }
        static async groupBy(key) {
            const result = await super.groupBy(key);
            return result;
        }
        static async preloadBelongsTo(records, options) {
            const result = await super.preloadBelongsTo(records, options);
            return result;
        }
        static async preloadHasMany(records, options) {
            const result = await super.preloadHasMany(records, options);
            return result;
        }
        static async sum(key) {
            return super.sum(key);
        }
        static async min(key) {
            return super.min(key);
        }
        static async max(key) {
            return super.max(key);
        }
        static async avg(key) {
            return super.avg(key);
        }
        static async deleteAll() {
            return (await super.deleteAll());
        }
        static async updateAll(attrs) {
            return (await super.updateAll(attrs));
        }
        static async findBy(filter) {
            return (await super.findBy(filter));
        }
        static async exists(filter) {
            return await super.exists(filter);
        }
        static async find(id) {
            return (await super.find(id));
        }
        static async findOrFail(filter) {
            return (await super.findOrFail(filter));
        }
        static async findOrBuild(filter, createProps) {
            return (await super.findOrBuild(filter, createProps));
        }
        static async firstOrCreate(filter, createProps = {}) {
            return (await super.firstOrCreate(filter, createProps));
        }
        static async updateOrCreate(filter, attrs) {
            return (await super.updateOrCreate(filter, attrs));
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
        static async createMany(propsList) {
            return (await super.createMany(propsList));
        }
        // biome-ignore lint/complexity/noUselessConstructor: narrows parent's Dict<any> params to PersistentProps/Keys
        constructor(props, keys) {
            super(props, keys);
            this.changedProps = {};
        }
        attributes() {
            return {
                ...this.persistentProps,
                ...this.changedProps,
                ...this.keys,
            };
        }
        toJSON() {
            return this.attributes();
        }
        pick(keys) {
            return super.pick(keys);
        }
        omit(keys) {
            return super.omit(keys);
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
        isChangedBy(key) {
            return super.isChangedBy(key);
        }
        revertChange(key) {
            return super.revertChange(key);
        }
        update(attrs) {
            return super.update(attrs);
        }
    };
    for (const name in scopeDefs) {
        ModelSubclass[name] = function (...args) {
            return scopeDefs[name](this, ...args);
        };
    }
    return ModelSubclass;
}
export default Model;
//# sourceMappingURL=Model.js.map