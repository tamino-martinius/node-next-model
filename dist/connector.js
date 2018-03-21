var globalStorage = {};
var uuid = 0;
var Connector = (function () {
    function Connector(storage) {
        if (storage === void 0) { storage = globalStorage; }
        this.storage = storage;
    }
    Connector.prototype.collection = function (model) {
        return this.storage[model.modelName] = this.storage[model.modelName] || [];
    };
    Connector.prototype.items = function (model) {
        return this.filter(this.collection(model), model.strictFilter);
    };
    Connector.prototype.propertyFilter = function (items, filter) {
        var counts = {};
        items.forEach(function (item) { return counts[item.id] = 0; });
        var _loop_1 = function (key) {
            items.forEach(function (item) {
                if (item[key] === filter[key]) {
                    counts[item.id] += 1;
                }
            });
        };
        for (var key in filter) {
            _loop_1(key);
        }
        var filterCount = Object.keys(filter).length;
        return items.filter(function (item) { return counts[item.id] === filterCount; });
    };
    Connector.prototype.andFilter = function (items, filters) {
        var _this = this;
        var counts = {};
        items.forEach(function (item) { return counts[item.id] = 0; });
        filters.map(function (filter) {
            _this.filter(items, filter).forEach(function (item) {
                counts[item.id] += 1;
            });
        });
        var filterCount = filters.length;
        return items.filter(function (item) { return counts[item.id] === filterCount; });
    };
    Connector.prototype.notFilter = function (items, filter) {
        var array = this.filter(items, filter);
        var exists = {};
        array.forEach(function (item) {
            exists[item.id] = exists[item.id] || true;
        });
        return items.filter(function (item) { return !exists[item.id]; });
    };
    Connector.prototype.orFilter = function (items, filters) {
        var _this = this;
        var arrays = filters.map(function (filter) { return _this.filter(items, filter); });
        var exists = {};
        arrays.forEach(function (array) { return array.forEach(function (item) {
            exists[item.id] = exists[item.id] || true;
        }); });
        return items.filter(function (item) { return exists[item.id]; });
    };
    Connector.prototype.inFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var _loop_2 = function (key) {
            return { value: items.filter(function (item) {
                    var values = filter[key];
                    for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
                        var value = values_1[_i];
                        if (item[key] === value)
                            return true;
                    }
                    return false;
                }) };
        };
        for (var key in filter) {
            var state_1 = _loop_2(key);
            if (typeof state_1 === "object")
                return state_1.value;
        }
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.notInFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var _loop_3 = function (key) {
            return { value: items.filter(function (item) {
                    var values = filter[key];
                    for (var _i = 0, values_2 = values; _i < values_2.length; _i++) {
                        var value = values_2[_i];
                        if (item[key] === value)
                            return false;
                    }
                    return true;
                }) };
        };
        for (var key in filter) {
            var state_2 = _loop_3(key);
            if (typeof state_2 === "object")
                return state_2.value;
        }
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.nullFilter = function (items, key) {
        return items.filter(function (item) { return item[key] === null || item[key] === undefined; });
    };
    Connector.prototype.notNullFilter = function (items, key) {
        return items.filter(function (item) { return item[key] !== null && item[key] !== undefined; });
    };
    Connector.prototype.betweenFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var _loop_4 = function (key) {
            return { value: items.filter(function (item) { return filter[key].to >= item[key] && item[key] >= filter[key].from; }) };
        };
        for (var key in filter) {
            var state_3 = _loop_4(key);
            if (typeof state_3 === "object")
                return state_3.value;
        }
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.notBetweenFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var _loop_5 = function (key) {
            return { value: items.filter(function (item) { return filter[key].to < item[key] || item[key] < filter[key].from; }) };
        };
        for (var key in filter) {
            var state_4 = _loop_5(key);
            if (typeof state_4 === "object")
                return state_4.value;
        }
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.gtFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var _loop_6 = function (key) {
            return { value: items.filter(function (item) { return item[key] > filter[key]; }) };
        };
        for (var key in filter) {
            var state_5 = _loop_6(key);
            if (typeof state_5 === "object")
                return state_5.value;
        }
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.gteFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var _loop_7 = function (key) {
            return { value: items.filter(function (item) { return item[key] >= filter[key]; }) };
        };
        for (var key in filter) {
            var state_6 = _loop_7(key);
            if (typeof state_6 === "object")
                return state_6.value;
        }
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.ltFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var _loop_8 = function (key) {
            return { value: items.filter(function (item) { return item[key] < filter[key]; }) };
        };
        for (var key in filter) {
            var state_7 = _loop_8(key);
            if (typeof state_7 === "object")
                return state_7.value;
        }
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.lteFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var _loop_9 = function (key) {
            return { value: items.filter(function (item) { return item[key] <= filter[key]; }) };
        };
        for (var key in filter) {
            var state_8 = _loop_9(key);
            if (typeof state_8 === "object")
                return state_8.value;
        }
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.rawFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        var fn = eval(filter.$query);
        var params = filter.$bindings;
        if (Array.isArray(params)) {
            return items.filter(function (item) { return fn.apply(void 0, [item].concat(params)); });
        }
        else {
            return items.filter(function (item) { return fn(item, params); });
        }
    };
    Connector.prototype.specialFilter = function (items, filter) {
        if (Object.keys(filter).length !== 1)
            throw '[TODO] Return proper error';
        if (filter.$and !== undefined)
            return this.andFilter(items, filter.$and);
        if (filter.$or !== undefined)
            return this.orFilter(items, filter.$or);
        if (filter.$not !== undefined)
            return this.notFilter(items, filter.$not);
        if (filter.$in !== undefined)
            return this.inFilter(items, filter.$in);
        if (filter.$notIn !== undefined)
            return this.notInFilter(items, filter.$notIn);
        if (filter.$null !== undefined)
            return this.nullFilter(items, filter.$null);
        if (filter.$notNull !== undefined)
            return this.notNullFilter(items, filter.$notNull);
        if (filter.$between !== undefined)
            return this.betweenFilter(items, filter.$between);
        if (filter.$notBetween !== undefined)
            return this.notBetweenFilter(items, filter.$notBetween);
        if (filter.$gt !== undefined)
            return this.gtFilter(items, filter.$gt);
        if (filter.$gte !== undefined)
            return this.gteFilter(items, filter.$gte);
        if (filter.$lt !== undefined)
            return this.ltFilter(items, filter.$lt);
        if (filter.$lte !== undefined)
            return this.lteFilter(items, filter.$lte);
        if (filter.$raw !== undefined)
            return this.rawFilter(items, filter.$raw);
        throw '[TODO] Should not reach error';
    };
    Connector.prototype.filter = function (items, filter) {
        for (var key in filter) {
            if (key.startsWith('$')) {
                return this.specialFilter(items, filter);
            }
        }
        return this.propertyFilter(items, filter);
    };
    Connector.prototype.query = function (model) {
        try {
            var items = this.items(model);
            return Promise.resolve(items.map(function (item) { return new model(item); }));
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
    Connector.prototype.count = function (model) {
        try {
            var items = this.items(model);
            return Promise.resolve(items.length);
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
    Connector.prototype.updateAll = function (model, attrs) {
        try {
            var items = this.items(model);
            items.forEach(function (item) {
                for (var key in attrs) {
                    if (key !== model.identifier) {
                        item[key] = attrs[key];
                    }
                }
            });
            return Promise.resolve(items.map(function (item) { return new model(item); }));
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
    Connector.prototype.deleteAll = function (model) {
        try {
            var items = this.items(model);
            var exists_1 = {};
            items.forEach(function (item) {
                exists_1[item.id] = exists_1[item.id] || true;
            });
            var collection = this.collection(model);
            for (var i = collection.length - 1; i >= 0; i--) {
                if (exists_1[collection[i].id]) {
                    collection.splice(i, 1);
                }
            }
            return Promise.resolve(items.map(function (item) {
                delete item.id;
                return new model(item);
            }));
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
    Connector.prototype.create = function (instance) {
        try {
            instance.id = ++uuid;
            this.collection(instance.model).push(instance.attributes);
            return Promise.resolve(instance);
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
    Connector.prototype.update = function (instance) {
        try {
            var model = instance.model;
            var collection = this.collection(model);
            for (var _i = 0, collection_1 = collection; _i < collection_1.length; _i++) {
                var item = collection_1[_i];
                if (item.id === instance.id) {
                    var attrs = instance.attributes;
                    for (var key in attrs) {
                        if (key !== model.identifier) {
                            item[key] = attrs[key];
                        }
                    }
                    return Promise.resolve(instance);
                }
            }
            return Promise.reject('[TODO] Cant find error');
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
    Connector.prototype.delete = function (instance) {
        try {
            var model = instance.model;
            var collection = this.collection(model);
            for (var i = 0; i < collection.length; i++) {
                if (collection[i].id === instance.id) {
                    collection.splice(i, 1);
                    instance.id = undefined;
                    return Promise.resolve(instance);
                }
            }
            return Promise.reject('[TODO] Cant find error');
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
    Connector.prototype.execute = function (_query, _bindings) {
        return Promise.reject('[TODO] Not yet implemented');
    };
    return Connector;
}());
export { Connector };
export default Connector;
//# sourceMappingURL=connector.js.map