"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var types_1 = require("./types");
var util_1 = require("./util");
var globalStorage = {};
var globalLastIds = {};
var MemoryConnector = /** @class */ (function () {
    function MemoryConnector(props) {
        this.storage = (props && props.storage) || globalStorage;
        this.lastIds = (props && props.lastIds) || globalLastIds;
    }
    MemoryConnector.prototype.collection = function (tableName) {
        return (this.storage[tableName] = this.storage[tableName] || []);
    };
    MemoryConnector.prototype.nextId = function (tableName) {
        this.lastIds[tableName] = this.lastIds[tableName] || 0;
        return ++this.lastIds[tableName];
    };
    MemoryConnector.prototype.items = function (_a) {
        var tableName = _a.tableName, _b = _a.filter, filter = _b === void 0 ? {} : _b, limit = _a.limit, skip = _a.skip, _c = _a.order, order = _c === void 0 ? [] : _c;
        return __awaiter(this, void 0, void 0, function () {
            var items, _loop_1, orderIndex;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, this.filter(this.collection(tableName), filter)];
                    case 1:
                        items = _d.sent();
                        if (skip && limit) {
                            items = items.slice(skip, skip + limit);
                        }
                        else if (skip) {
                            items = items.slice(skip);
                        }
                        else if (limit) {
                            items = items.slice(0, limit);
                        }
                        _loop_1 = function (orderIndex) {
                            var key = order[orderIndex].key;
                            var dir = order[orderIndex].dir || types_1.SortDirection.Asc;
                            items = items.sort(function (a, b) {
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
                        };
                        for (orderIndex = order.length - 1; orderIndex >= 0; orderIndex -= 1) {
                            _loop_1(orderIndex);
                        }
                        return [2 /*return*/, items];
                }
            });
        });
    };
    MemoryConnector.prototype.propertyFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var counts, _loop_2, key, filterCount;
            return __generator(this, function (_a) {
                counts = {};
                items.forEach(function (item) { return (counts[item.id] = 0); });
                _loop_2 = function (key) {
                    items.forEach(function (item) {
                        if (item[key] === filter[key]) {
                            counts[item.id] += 1;
                        }
                    });
                };
                for (key in filter) {
                    _loop_2(key);
                }
                filterCount = Object.keys(filter).length;
                return [2 /*return*/, items.filter(function (item) { return counts[item.id] === filterCount; })];
            });
        });
    };
    MemoryConnector.prototype.andFilter = function (items, filters) {
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
                        return [4 /*yield*/, Promise.all(filters.map(function (filter) { return __awaiter(_this, void 0, void 0, function () {
                                var filterItems;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.filter(items, filter)];
                                        case 1:
                                            filterItems = _a.sent();
                                            filterItems.forEach(function (item) {
                                                counts[item.id] += 1;
                                            });
                                            return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 1:
                        _a.sent();
                        filterCount = filters.length;
                        return [2 /*return*/, items.filter(function (item) { return counts[item.id] === filterCount; })];
                }
            });
        });
    };
    MemoryConnector.prototype.notFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var array, exists;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.filter(items, filter)];
                    case 1:
                        array = _a.sent();
                        exists = {};
                        array.forEach(function (item) {
                            exists[item.id] = exists[item.id] || true;
                        });
                        return [4 /*yield*/, items.filter(function (item) { return !exists[item.id]; })];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemoryConnector.prototype.orFilter = function (items, filters) {
        return __awaiter(this, void 0, void 0, function () {
            var arrays, exists;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(filters.map(function (filter) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, this.filter(items, filter)];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        }); }); }))];
                    case 1:
                        arrays = _a.sent();
                        exists = {};
                        arrays.forEach(function (array) {
                            return array.forEach(function (item) {
                                exists[item.id] = exists[item.id] || true;
                            });
                        });
                        return [2 /*return*/, items.filter(function (item) { return exists[item.id]; })];
                }
            });
        });
    };
    MemoryConnector.prototype.inFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_3, key, state_1;
            return __generator(this, function (_a) {
                // Cost: (1, n, m) => O(n, m) = n * m;
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_3 = function (key) {
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
                    state_1 = _loop_3(key);
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    MemoryConnector.prototype.notInFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_4, key, state_2;
            return __generator(this, function (_a) {
                // Cost: (1, n, m) => O(n, m) = n * m;
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_4 = function (key) {
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
                    state_2 = _loop_4(key);
                    if (typeof state_2 === "object")
                        return [2 /*return*/, state_2.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    MemoryConnector.prototype.nullFilter = function (items, key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Cost: (1, n, 1) => O(n) = n;
                return [2 /*return*/, items.filter(function (item) { return item[key] === null || item[key] === undefined; })];
            });
        });
    };
    MemoryConnector.prototype.notNullFilter = function (items, key) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Cost: (1, n, 1) => O(n) = n;
                return [2 /*return*/, items.filter(function (item) { return item[key] !== null && item[key] !== undefined; })];
            });
        });
    };
    MemoryConnector.prototype.betweenFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_5, key, state_3;
            return __generator(this, function (_a) {
                // Cost: (1, n, 1) => O(n) = n;
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_5 = function (key) {
                    var filterBetween = filter[key];
                    if (filterBetween !== undefined) {
                        return { value: items.filter(function (item) { return filterBetween.to >= item[key] && item[key] >= filterBetween.from; }) };
                    }
                };
                for (key in filter) {
                    state_3 = _loop_5(key);
                    if (typeof state_3 === "object")
                        return [2 /*return*/, state_3.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    MemoryConnector.prototype.notBetweenFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_6, key, state_4;
            return __generator(this, function (_a) {
                // Cost: (1, n, 1) => O(n) = n;
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_6 = function (key) {
                    var filterBetween = filter[key];
                    if (filterBetween !== undefined) {
                        return { value: items.filter(function (item) { return filterBetween.to < item[key] || item[key] < filterBetween.from; }) };
                    }
                };
                for (key in filter) {
                    state_4 = _loop_6(key);
                    if (typeof state_4 === "object")
                        return [2 /*return*/, state_4.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    MemoryConnector.prototype.gtFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_7, key, state_5;
            return __generator(this, function (_a) {
                // Cost: (1, n, 1) => O(n) = n;
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_7 = function (key) {
                    return { value: items.filter(function (item) { return item[key] > filter[key]; }) };
                };
                for (key in filter) {
                    state_5 = _loop_7(key);
                    if (typeof state_5 === "object")
                        return [2 /*return*/, state_5.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    MemoryConnector.prototype.gteFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_8, key, state_6;
            return __generator(this, function (_a) {
                // Cost: (1, n, 1) => O(n) = n;
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_8 = function (key) {
                    return { value: items.filter(function (item) { return item[key] >= filter[key]; }) };
                };
                for (key in filter) {
                    state_6 = _loop_8(key);
                    if (typeof state_6 === "object")
                        return [2 /*return*/, state_6.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    MemoryConnector.prototype.ltFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_9, key, state_7;
            return __generator(this, function (_a) {
                // Cost: (1, n, 1) => O(n) = n;
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_9 = function (key) {
                    return { value: items.filter(function (item) { return item[key] < filter[key]; }) };
                };
                for (key in filter) {
                    state_7 = _loop_9(key);
                    if (typeof state_7 === "object")
                        return [2 /*return*/, state_7.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    MemoryConnector.prototype.lteFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var _loop_10, key, state_8;
            return __generator(this, function (_a) {
                // Cost: (1, n, 1) => O(n) = n;
                if (Object.keys(filter).length !== 1)
                    throw '[TODO] Return proper error';
                _loop_10 = function (key) {
                    return { value: items.filter(function (item) { return item[key] <= filter[key]; }) };
                };
                for (key in filter) {
                    state_8 = _loop_10(key);
                    if (typeof state_8 === "object")
                        return [2 /*return*/, state_8.value];
                }
                throw '[TODO] Should not reach error';
            });
        });
    };
    MemoryConnector.prototype.rawFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            var fn, params;
            return __generator(this, function (_a) {
                fn = eval(filter.$query);
                params = filter.$bindings;
                if (Array.isArray(params)) {
                    return [2 /*return*/, items.filter(function (item) { return fn.apply(void 0, __spreadArrays([item], params)); })];
                }
                else {
                    return [2 /*return*/, items.filter(function (item) { return fn(item, params); })];
                }
                return [2 /*return*/];
            });
        });
    };
    MemoryConnector.prototype.asyncFilter = function (items, asyncFilter) {
        return __awaiter(this, void 0, void 0, function () {
            var filter;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, asyncFilter];
                    case 1:
                        filter = _a.sent();
                        if (filter && Object.keys(filter).length > 0) {
                            return [2 /*return*/, this.filter(items, filter)];
                        }
                        else {
                            return [2 /*return*/, items];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    MemoryConnector.prototype.specialFilter = function (items, filter) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (Object.keys(filter).length !== 1)
                            throw '[TODO] Return proper error';
                        if (!(filter.$and !== undefined)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.andFilter(items, filter.$and)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        if (!(filter.$or !== undefined)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.orFilter(items, filter.$or)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        if (!(filter.$not !== undefined)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.notFilter(items, filter.$not)];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6:
                        if (!(filter.$in !== undefined)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.inFilter(items, filter.$in)];
                    case 7: return [2 /*return*/, _a.sent()];
                    case 8:
                        if (!(filter.$notIn !== undefined)) return [3 /*break*/, 10];
                        return [4 /*yield*/, this.notInFilter(items, filter.$notIn)];
                    case 9: return [2 /*return*/, _a.sent()];
                    case 10:
                        if (!(filter.$null !== undefined)) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.nullFilter(items, filter.$null)];
                    case 11: return [2 /*return*/, _a.sent()];
                    case 12:
                        if (!(filter.$notNull !== undefined)) return [3 /*break*/, 14];
                        return [4 /*yield*/, this.notNullFilter(items, filter.$notNull)];
                    case 13: return [2 /*return*/, _a.sent()];
                    case 14:
                        if (!(filter.$between !== undefined)) return [3 /*break*/, 16];
                        return [4 /*yield*/, this.betweenFilter(items, filter.$between)];
                    case 15: return [2 /*return*/, _a.sent()];
                    case 16:
                        if (!(filter.$notBetween !== undefined)) return [3 /*break*/, 18];
                        return [4 /*yield*/, this.notBetweenFilter(items, filter.$notBetween)];
                    case 17: return [2 /*return*/, _a.sent()];
                    case 18:
                        if (!(filter.$gt !== undefined)) return [3 /*break*/, 20];
                        return [4 /*yield*/, this.gtFilter(items, filter.$gt)];
                    case 19: return [2 /*return*/, _a.sent()];
                    case 20:
                        if (!(filter.$gte !== undefined)) return [3 /*break*/, 22];
                        return [4 /*yield*/, this.gteFilter(items, filter.$gte)];
                    case 21: return [2 /*return*/, _a.sent()];
                    case 22:
                        if (!(filter.$lt !== undefined)) return [3 /*break*/, 24];
                        return [4 /*yield*/, this.ltFilter(items, filter.$lt)];
                    case 23: return [2 /*return*/, _a.sent()];
                    case 24:
                        if (!(filter.$lte !== undefined)) return [3 /*break*/, 26];
                        return [4 /*yield*/, this.lteFilter(items, filter.$lte)];
                    case 25: return [2 /*return*/, _a.sent()];
                    case 26:
                        if (!(filter.$raw !== undefined)) return [3 /*break*/, 28];
                        return [4 /*yield*/, this.rawFilter(items, filter.$raw)];
                    case 27: return [2 /*return*/, _a.sent()];
                    case 28:
                        if (!(filter.$async !== undefined)) return [3 /*break*/, 30];
                        return [4 /*yield*/, this.asyncFilter(items, filter.$async)];
                    case 29: return [2 /*return*/, _a.sent()];
                    case 30: throw '[TODO] Should not reach error';
                }
            });
        });
    };
    MemoryConnector.prototype.filter = function (items, filter) {
        if (filter === void 0) { filter = {}; }
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
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        key = _a[_i];
                        if (!key.startsWith('$')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.specialFilter(items, filter)];
                    case 2: return [2 /*return*/, _c.sent()];
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [4 /*yield*/, this.propertyFilter(items, filter)];
                    case 5: return [2 /*return*/, _c.sent()];
                }
            });
        });
    };
    MemoryConnector.prototype.query = function (scope) {
        return __awaiter(this, void 0, void 0, function () {
            var items;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.items(scope)];
                    case 1:
                        items = _a.sent();
                        return [2 /*return*/, util_1.clone(items)];
                }
            });
        });
    };
    MemoryConnector.prototype.count = function (scope) {
        return __awaiter(this, void 0, void 0, function () {
            var items, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.items(scope)];
                    case 1:
                        items = _a.sent();
                        return [2 /*return*/, items.length];
                    case 2:
                        e_1 = _a.sent();
                        return [2 /*return*/, Promise.reject(e_1)];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MemoryConnector.prototype.select = function (scope) {
        var keys = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            keys[_i - 1] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var items, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.items(scope)];
                    case 1:
                        items = _a.sent();
                        return [2 /*return*/, items.map(function (item) {
                                var obj = {};
                                for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
                                    var key = keys_1[_i];
                                    obj[key] = item[key];
                                }
                                return obj;
                            })];
                    case 2:
                        e_2 = _a.sent();
                        return [2 /*return*/, Promise.reject(e_2)];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MemoryConnector.prototype.updateAll = function (scope, attrs) {
        return __awaiter(this, void 0, void 0, function () {
            var items, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.items(scope)];
                    case 1:
                        items = _a.sent();
                        items.forEach(function (item) {
                            for (var key in attrs) {
                                item[key] = attrs[key];
                            }
                        });
                        return [2 /*return*/, Promise.resolve(util_1.clone(items))];
                    case 2:
                        e_3 = _a.sent();
                        return [2 /*return*/, Promise.reject(e_3)];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MemoryConnector.prototype.deleteAll = function (scope) {
        return __awaiter(this, void 0, void 0, function () {
            var items, result, collection, index, e_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.items(scope)];
                    case 1:
                        items = _a.sent();
                        result = util_1.clone(items);
                        collection = this.collection(scope.tableName);
                        index = 0;
                        while (index < collection.length) {
                            if (items.includes(collection[index])) {
                                collection.splice(index, 1);
                            }
                            else {
                                index += 1;
                            }
                        }
                        return [2 /*return*/, result];
                    case 2:
                        e_4 = _a.sent();
                        return [2 /*return*/, Promise.reject(e_4)];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MemoryConnector.prototype.batchInsert = function (tableName, keys, items) {
        return __awaiter(this, void 0, void 0, function () {
            var result, _i, items_1, item, keyValues, key, attributes;
            return __generator(this, function (_a) {
                try {
                    result = [];
                    for (_i = 0, items_1 = items; _i < items_1.length; _i++) {
                        item = items_1[_i];
                        keyValues = {};
                        for (key in keys) {
                            switch (keys[key]) {
                                case types_1.KeyType.uuid:
                                    keyValues[key] = util_1.uuid();
                                    break;
                                case types_1.KeyType.number:
                                    keyValues[key] = this.nextId(tableName);
                                    break;
                            }
                        }
                        attributes = __assign(__assign({}, item), keyValues);
                        this.collection(tableName).push(attributes);
                        result.push(util_1.clone(attributes));
                    }
                    return [2 /*return*/, Promise.resolve(result)];
                }
                catch (e) {
                    return [2 /*return*/, Promise.reject(e)];
                }
                return [2 /*return*/];
            });
        });
    };
    MemoryConnector.prototype.execute = function (query, bindings) {
        return __awaiter(this, void 0, void 0, function () {
            var fn;
            return __generator(this, function (_a) {
                fn = eval(query);
                if (Array.isArray(bindings)) {
                    return [2 /*return*/, fn.apply(void 0, __spreadArrays([this.storage], bindings))];
                }
                else {
                    return [2 /*return*/, fn(this.storage, bindings)];
                }
                return [2 /*return*/];
            });
        });
    };
    return MemoryConnector;
}());
exports.MemoryConnector = MemoryConnector;
exports.default = MemoryConnector;
