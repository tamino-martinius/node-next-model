"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
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
        return __awaiter(this, void 0, void 0, function () {
            var items;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.filter(this.collection(model), model.strictFilter)];
                    case 1:
                        items = _a.sent();
                        if (model.skip > 0 && model.limit < Number.MAX_SAFE_INTEGER) {
                            items = items.slice(model.skip, model.skip + model.limit);
                        }
                        else if (model.skip > 0) {
                            items = items.slice(model.skip);
                        }
                        else if (model.limit < Number.MAX_SAFE_INTEGER) {
                            items = items.slice(0, model.limit);
                        }
                        return [2, items];
                }
            });
        });
    };
    Connector.prototype.propertyFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var counts, _loop_1, key, filterCount;
            return __generator(this, function (_a) {
                counts = {};
                items.forEach(function (item) { return counts[item.id] = 0; });
                _loop_1 = function (key) {
                    items.forEach(function (item) {
                        if (item[key] === filter[key]) {
                            counts[item.id] += 1;
                        }
                    });
                };
                for (key in filter) {
                    _loop_1(key);
                }
                filterCount = Object.keys(filter).length;
                return [2, items.filter(function (item) { return counts[item.id] === filterCount; })];
            });
        });
    };
    Connector.prototype.andFilter = function (items, filters) {
        return __awaiter(this, void 0, void 0, function () {
            var counts, filterCount;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        counts = items.reduce(function (obj, item) {
                            obj[item.id] = 0;
                            return obj;
                        }, {});
                        return [4, Promise.all(filters.map(function (filter) { return __awaiter(_this, void 0, void 0, function () {
                                var filterItems;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4, this.filter(items, filter)];
                                        case 1:
                                            filterItems = _a.sent();
                                            filterItems.forEach(function (item) {
                                                counts[item.id] += 1;
                                            });
                                            return [2];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        filterCount = filters.length;
                        return [2, items.filter(function (item) { return counts[item.id] === filterCount; })];
                }
            });
        });
    };
    Connector.prototype.notFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var array, exists;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.filter(items, filter)];
                    case 1:
                        array = _a.sent();
                        exists = {};
                        array.forEach(function (item) {
                            exists[item.id] = exists[item.id] || true;
                        });
                        return [4, items.filter(function (item) { return !exists[item.id]; })];
                    case 2: return [2, _a.sent()];
                }
            });
        });
    };
    Connector.prototype.orFilter = function (items, filters) {
        return __awaiter(this, void 0, void 0, function () {
            var arrays, exists;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, Promise.all(filters.map(function (filter) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4, this.filter(items, filter)];
                                case 1: return [2, _a.sent()];
                            }
                        }); }); }))];
                    case 1:
                        arrays = _a.sent();
                        exists = {};
                        arrays.forEach(function (array) { return array.forEach(function (item) {
                            exists[item.id] = exists[item.id] || true;
                        }); });
                        return [2, items.filter(function (item) { return exists[item.id]; })];
                }
            });
        });
    };
    Connector.prototype.inFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_2, key, state_1;
            return __generator(this, function (_a) {
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_2 = function (key) {
                    return { value: items.filter(function (item) {
                            var values = filter[key];
                            if (Array.isArray(values)) {
                                for (var _i = 0, values_1 = values; _i < values_1.length; _i++) {
                                    var value = values_1[_i];
                                    if (item[key] === value)
                                        return true;
                                }
                            }
                            return false;
                        }) };
                };
                for (key in filter) {
                    state_1 = _loop_2(key);
                    if (typeof state_1 === "object")
                        return [2, state_1.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    Connector.prototype.notInFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_3, key, state_2;
            return __generator(this, function (_a) {
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_3 = function (key) {
                    return { value: items.filter(function (item) {
                            var values = filter[key];
                            if (Array.isArray(values)) {
                                for (var _i = 0, values_2 = values; _i < values_2.length; _i++) {
                                    var value = values_2[_i];
                                    if (item[key] === value)
                                        return false;
                                }
                            }
                            return true;
                        }) };
                };
                for (key in filter) {
                    state_2 = _loop_3(key);
                    if (typeof state_2 === "object")
                        return [2, state_2.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    Connector.prototype.nullFilter = function (items, key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, items.filter(function (item) { return item[key] === null || item[key] === undefined; })];
            });
        });
    };
    Connector.prototype.notNullFilter = function (items, key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, items.filter(function (item) { return item[key] !== null && item[key] !== undefined; })];
            });
        });
    };
    Connector.prototype.betweenFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_4, key, state_3;
            return __generator(this, function (_a) {
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_4 = function (key) {
                    var filterBetween = filter[key];
                    if (filterBetween !== undefined) {
                        return { value: items.filter(function (item) { return filterBetween.to >= item[key] && item[key] >= filterBetween.from; }) };
                    }
                };
                for (key in filter) {
                    state_3 = _loop_4(key);
                    if (typeof state_3 === "object")
                        return [2, state_3.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    Connector.prototype.notBetweenFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_5, key, state_4;
            return __generator(this, function (_a) {
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_5 = function (key) {
                    var filterBetween = filter[key];
                    if (filterBetween !== undefined) {
                        return { value: items.filter(function (item) { return filterBetween.to < item[key] || item[key] < filterBetween.from; }) };
                    }
                };
                for (key in filter) {
                    state_4 = _loop_5(key);
                    if (typeof state_4 === "object")
                        return [2, state_4.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    Connector.prototype.gtFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_6, key, state_5;
            return __generator(this, function (_a) {
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_6 = function (key) {
                    return { value: items.filter(function (item) { return item[key] > filter[key]; }) };
                };
                for (key in filter) {
                    state_5 = _loop_6(key);
                    if (typeof state_5 === "object")
                        return [2, state_5.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    Connector.prototype.gteFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_7, key, state_6;
            return __generator(this, function (_a) {
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_7 = function (key) {
                    return { value: items.filter(function (item) { return item[key] >= filter[key]; }) };
                };
                for (key in filter) {
                    state_6 = _loop_7(key);
                    if (typeof state_6 === "object")
                        return [2, state_6.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    Connector.prototype.ltFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_8, key, state_7;
            return __generator(this, function (_a) {
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_8 = function (key) {
                    return { value: items.filter(function (item) { return item[key] < filter[key]; }) };
                };
                for (key in filter) {
                    state_7 = _loop_8(key);
                    if (typeof state_7 === "object")
                        return [2, state_7.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    Connector.prototype.lteFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_9, key, state_8;
            return __generator(this, function (_a) {
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_9 = function (key) {
                    return { value: items.filter(function (item) { return item[key] <= filter[key]; }) };
                };
                for (key in filter) {
                    state_8 = _loop_9(key);
                    if (typeof state_8 === "object")
                        return [2, state_8.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    Connector.prototype.rawFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var fn, params;
            return __generator(this, function (_a) {
                fn = eval(filter.$query);
                params = filter.$bindings;
                if (Array.isArray(params)) {
                    return [2, items.filter(function (item) { return fn.apply(void 0, [item].concat(params)); })];
                }
                else {
                    return [2, items.filter(function (item) { return fn(item, params); })];
                }
                return [2];
            });
        });
    };
    Connector.prototype.asyncFilter = function (items, asyncFilter) {
        return __awaiter(this, void 0, void 0, function () {
            var filter;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, asyncFilter];
                    case 1:
                        filter = _a.sent();
                        if (filter && Object.keys(filter).length > 0) {
                            return [2, this.filter(items, filter)];
                        }
                        else {
                            return [2, items];
                        }
                        return [2];
                }
            });
        });
    };
    Connector.prototype.specialFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (Object.keys(filter).length !== 1)
                            throw '[TODO] Return proper error';
                        if (!(filter.$and !== undefined)) return [3, 2];
                        return [4, this.andFilter(items, filter.$and)];
                    case 1: return [2, _a.sent()];
                    case 2:
                        if (!(filter.$or !== undefined)) return [3, 4];
                        return [4, this.orFilter(items, filter.$or)];
                    case 3: return [2, _a.sent()];
                    case 4:
                        if (!(filter.$not !== undefined)) return [3, 6];
                        return [4, this.notFilter(items, filter.$not)];
                    case 5: return [2, _a.sent()];
                    case 6:
                        if (!(filter.$in !== undefined)) return [3, 8];
                        return [4, this.inFilter(items, filter.$in)];
                    case 7: return [2, _a.sent()];
                    case 8:
                        if (!(filter.$notIn !== undefined)) return [3, 10];
                        return [4, this.notInFilter(items, filter.$notIn)];
                    case 9: return [2, _a.sent()];
                    case 10:
                        if (!(filter.$null !== undefined)) return [3, 12];
                        return [4, this.nullFilter(items, filter.$null)];
                    case 11: return [2, _a.sent()];
                    case 12:
                        if (!(filter.$notNull !== undefined)) return [3, 14];
                        return [4, this.notNullFilter(items, filter.$notNull)];
                    case 13: return [2, _a.sent()];
                    case 14:
                        if (!(filter.$between !== undefined)) return [3, 16];
                        return [4, this.betweenFilter(items, filter.$between)];
                    case 15: return [2, _a.sent()];
                    case 16:
                        if (!(filter.$notBetween !== undefined)) return [3, 18];
                        return [4, this.notBetweenFilter(items, filter.$notBetween)];
                    case 17: return [2, _a.sent()];
                    case 18:
                        if (!(filter.$gt !== undefined)) return [3, 20];
                        return [4, this.gtFilter(items, filter.$gt)];
                    case 19: return [2, _a.sent()];
                    case 20:
                        if (!(filter.$gte !== undefined)) return [3, 22];
                        return [4, this.gteFilter(items, filter.$gte)];
                    case 21: return [2, _a.sent()];
                    case 22:
                        if (!(filter.$lt !== undefined)) return [3, 24];
                        return [4, this.ltFilter(items, filter.$lt)];
                    case 23: return [2, _a.sent()];
                    case 24:
                        if (!(filter.$lte !== undefined)) return [3, 26];
                        return [4, this.lteFilter(items, filter.$lte)];
                    case 25: return [2, _a.sent()];
                    case 26:
                        if (!(filter.$raw !== undefined)) return [3, 28];
                        return [4, this.rawFilter(items, filter.$raw)];
                    case 27: return [2, _a.sent()];
                    case 28:
                        if (!(filter.$async !== undefined)) return [3, 30];
                        return [4, this.asyncFilter(items, filter.$async)];
                    case 29: return [2, _a.sent()];
                    case 30: throw '[TODO] Should not reach error';
                }
            });
        });
    };
    Connector.prototype.filter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _i, key;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = [];
                        for (_b in filter)
                            _a.push(_b);
                        _i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3, 4];
                        key = _a[_i];
                        if (!key.startsWith('$')) return [3, 3];
                        return [4, this.specialFilter(items, filter)];
                    case 2: return [2, _c.sent()];
                    case 3:
                        _i++;
                        return [3, 1];
                    case 4: return [4, this.propertyFilter(items, filter)];
                    case 5: return [2, _c.sent()];
                }
            });
        });
    };
    Connector.prototype.query = function (model) {
        return __awaiter(this, void 0, void 0, function () {
            var items, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.items(model)];
                    case 1:
                        items = _a.sent();
                        return [2, items.map(function (item) { return new model(item); })];
                    case 2:
                        e_1 = _a.sent();
                        return [2, Promise.reject(e_1)];
                    case 3: return [2];
                }
            });
        });
    };
    Connector.prototype.count = function (model) {
        return __awaiter(this, void 0, void 0, function () {
            var items, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.items(model)];
                    case 1:
                        items = _a.sent();
                        return [2, items.length];
                    case 2:
                        e_2 = _a.sent();
                        return [2, Promise.reject(e_2)];
                    case 3: return [2];
                }
            });
        });
    };
    Connector.prototype.select = function (model) {
        var keys = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            keys[_i - 1] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var items, result_1, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.items(model)];
                    case 1:
                        items = _a.sent();
                        result_1 = [];
                        items.forEach(function (item) {
                            var arr = [];
                            for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
                                var key = keys_1[_i];
                                arr.push(item[key]);
                            }
                            result_1.push(arr);
                        });
                        return [2, Promise.resolve(result_1)];
                    case 2:
                        e_3 = _a.sent();
                        return [2, Promise.reject(e_3)];
                    case 3: return [2];
                }
            });
        });
    };
    Connector.prototype.updateAll = function (model, attrs) {
        return __awaiter(this, void 0, void 0, function () {
            var items, e_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.items(model)];
                    case 1:
                        items = _a.sent();
                        items.forEach(function (item) {
                            for (var key in attrs) {
                                if (key !== model.identifier) {
                                    item[key] = attrs[key];
                                }
                            }
                        });
                        return [2, Promise.resolve(items.length)];
                    case 2:
                        e_4 = _a.sent();
                        return [2, Promise.reject(e_4)];
                    case 3: return [2];
                }
            });
        });
    };
    Connector.prototype.deleteAll = function (model) {
        return __awaiter(this, void 0, void 0, function () {
            var items, count, exists_1, collection, i, e_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4, this.items(model)];
                    case 1:
                        items = _a.sent();
                        count = items.length;
                        exists_1 = {};
                        items.forEach(function (item) {
                            exists_1[item.id] = exists_1[item.id] || true;
                        });
                        collection = this.collection(model);
                        for (i = collection.length - 1; i >= 0; i--) {
                            if (exists_1[collection[i].id]) {
                                collection.splice(i, 1);
                            }
                        }
                        return [2, count];
                    case 2:
                        e_5 = _a.sent();
                        return [2, Promise.reject(e_5)];
                    case 3: return [2];
                }
            });
        });
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
    Connector.prototype.execute = function (query, bindings) {
        var fn = eval(query);
        if (Array.isArray(bindings)) {
            return fn.apply(void 0, [this.storage].concat(bindings));
        }
        else {
            return fn(this.storage, bindings);
        }
    };
    return Connector;
}());
exports.Connector = Connector;
exports.default = Connector;
//# sourceMappingURL=connector.js.map