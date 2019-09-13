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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var __1 = require("..");
var types_1 = require("../types");
var _1 = require(".");
var storage = {};
var validId = _1.randomInteger(1, 3);
var invalidId = _1.randomInteger(4, Number.MAX_SAFE_INTEGER);
var tableName = 'foo';
var withEmptySeed = function () {
    var _a;
    return (storage = (_a = {}, _a[tableName] = [], _a));
};
var withSingleSeed = function () {
    var _a;
    return (storage = (_a = {}, _a[tableName] = [{ id: validId }], _a));
};
var withMultiSeed = function () {
    var _a;
    return (storage = (_a = {}, _a[tableName] = [{ id: 1, foo: 'bar' }, { id: 2, foo: null }, { id: 3, foo: 'bar' }], _a));
};
var idsOf = function (items) { return items.map(function (item) { return item.id; }); };
var items = function () { return storage[tableName]; };
var connector = function () { return new __1.MemoryConnector({ storage: storage }); };
var filterSpecGroups = {
    none: [
        { filter: undefined, results: [1, 2, 3] },
        { filter: {}, results: [1, 2, 3] },
    ],
    property: [
        { filter: { id: validId }, results: [validId] },
        { filter: { id: 1, foo: 'bar' }, results: [1] },
        { filter: { id: 1, foo: 'baz' }, results: [] },
        { filter: { foo: 'bar' }, results: [1, 3] },
        { filter: { id: invalidId }, results: [] },
    ],
    $and: [
        { filter: { $and: [] }, results: [1, 2, 3] },
        { filter: { $and: [{ id: validId }] }, results: [validId] },
        { filter: { $and: [{ id: 2 }, { id: 3 }] }, results: [] },
        { filter: { $and: [{ id: 2 }, { id: 2 }] }, results: [2] },
    ],
    $not: [
        { filter: { $not: {} }, results: [] },
        { filter: { $not: { id: 2 } }, results: [1, 3] },
        { filter: { $not: { id: invalidId } }, results: [1, 2, 3] },
    ],
    $or: [
        { filter: { $or: [] }, results: [] },
        { filter: { $or: [{ id: validId }] }, results: [validId] },
        { filter: { $or: [{ id: 2 }, { id: 3 }] }, results: [2, 3] },
        { filter: { $or: [{ id: 2 }, { id: 2 }] }, results: [2] },
    ],
    $in: [
        { filter: { $in: {} }, results: '[TODO] Return proper error' },
        { filter: { $in: { id: [validId] } }, results: [validId] },
        { filter: { $in: { id: [2, 3] } }, results: [2, 3] },
        { filter: { $in: { id: [2, 2] } }, results: [2] },
        { filter: { $in: { id: [1], foo: ['bar'] } }, results: '[TODO] Return proper error' },
    ],
    $notIn: [
        { filter: { $notIn: {} }, results: '[TODO] Return proper error' },
        { filter: { $notIn: { id: [2] } }, results: [1, 3] },
        { filter: { $notIn: { id: [2, 3] } }, results: [1] },
        { filter: { $notIn: { id: [2, 2] } }, results: [1, 3] },
        { filter: { $notIn: { id: [1], foo: ['bar'] } }, results: '[TODO] Return proper error' },
    ],
    $null: [
        { filter: { $null: 'foo' }, results: [2] },
        { filter: { $null: 'id' }, results: [] },
        { filter: { $null: 'bar' }, results: [1, 2, 3] },
    ],
    $notNull: [
        { filter: { $notNull: 'foo' }, results: [1, 3] },
        { filter: { $notNull: 'id' }, results: [1, 2, 3] },
        { filter: { $notNull: 'bar' }, results: [] },
    ],
    $between: [
        { filter: { $between: {} }, results: '[TODO] Return proper error' },
        { filter: { $between: { id: { from: 1, to: 2 } } }, results: [1, 2] },
        { filter: { $between: { foo: { from: 'a', to: 'z' } } }, results: [1, 3] },
        { filter: { $between: { id: { from: 0, to: 1 } } }, results: [1] },
        { filter: { $between: { id: { from: 3, to: 4 } } }, results: [3] },
        { filter: { $between: { id: { from: validId, to: validId } } }, results: [validId] },
        { filter: { $between: { id: { from: 4, to: 5 } } }, results: [] },
        { filter: { $between: { id: { from: 3, to: 1 } } }, results: [] },
        {
            filter: { $between: { id: { from: 1, to: 3 }, foo: { from: 'a', to: 'z' } } },
            results: '[TODO] Return proper error',
        },
    ],
    $notBetween: [
        { filter: { $notBetween: {} }, results: '[TODO] Return proper error' },
        { filter: { $notBetween: { id: { from: 1, to: 2 } } }, results: [3] },
        { filter: { $notBetween: { foo: { from: 'a', to: 'z' } } }, results: [] },
        { filter: { $notBetween: { id: { from: 0, to: 1 } } }, results: [2, 3] },
        { filter: { $notBetween: { id: { from: 3, to: 4 } } }, results: [1, 2] },
        {
            filter: { $notBetween: { id: { from: validId, to: validId } } },
            results: [1, 2, 3].filter(function (id) { return id !== validId; }),
        },
        { filter: { $notBetween: { id: { from: 4, to: 5 } } }, results: [1, 2, 3] },
        { filter: { $notBetween: { id: { from: 3, to: 1 } } }, results: [1, 2, 3] },
        {
            filter: { $notBetween: { id: { from: 1, to: 3 }, foo: { from: 'a', to: 'z' } } },
            results: '[TODO] Return proper error',
        },
    ],
    $gt: [
        { filter: { $gt: {} }, results: '[TODO] Return proper error' },
        { filter: { $gt: { id: 2 } }, results: [3] },
        { filter: { $gt: { foo: 'bar' } }, results: [] },
        { filter: { $gt: { foo: 'a' } }, results: [1, 3] },
        { filter: { $gt: { id: 0 } }, results: [1, 2, 3] },
        { filter: { $gt: { id: invalidId } }, results: [] },
        { filter: { $gt: { id: 1, foo: 'a' } }, results: '[TODO] Return proper error' },
    ],
    $gte: [
        { filter: { $gte: {} }, results: '[TODO] Return proper error' },
        { filter: { $gte: { id: 2 } }, results: [2, 3] },
        { filter: { $gte: { foo: 'z' } }, results: [] },
        { filter: { $gte: { foo: 'bar' } }, results: [1, 3] },
        { filter: { $gte: { foo: 'a' } }, results: [1, 3] },
        { filter: { $gte: { id: 0 } }, results: [1, 2, 3] },
        { filter: { $gte: { id: invalidId } }, results: [] },
        { filter: { $gte: { id: 1, foo: 'a' } }, results: '[TODO] Return proper error' },
    ],
    $lt: [
        { filter: { $lt: {} }, results: '[TODO] Return proper error' },
        { filter: { $lt: { id: 2 } }, results: [1] },
        { filter: { $lt: { foo: 'bar' } }, results: [] },
        { filter: { $lt: { foo: 'z' } }, results: [1, 3] },
        { filter: { $lt: { id: 4 } }, results: [1, 2, 3] },
        { filter: { $lt: { id: 0 } }, results: [] },
        { filter: { $lt: { id: 1, foo: 'a' } }, results: '[TODO] Return proper error' },
    ],
    $lte: [
        { filter: { $lte: {} }, results: '[TODO] Return proper error' },
        { filter: { $lte: { id: 2 } }, results: [1, 2] },
        { filter: { $lte: { foo: 'a' } }, results: [] },
        { filter: { $lte: { foo: 'bar' } }, results: [1, 3] },
        { filter: { $lte: { foo: 'z' } }, results: [1, 3] },
        { filter: { $lte: { id: 4 } }, results: [1, 2, 3] },
        { filter: { $lte: { id: 0 } }, results: [] },
        { filter: { $lte: { id: 1, foo: 'a' } }, results: '[TODO] Return proper error' },
    ],
};
for (var key in filterSpecGroups) {
    var groupName = '$async -> ' + key;
    filterSpecGroups[groupName] = [];
    (_a = filterSpecGroups[groupName]).push.apply(_a, filterSpecGroups[key].map(function (spec) { return ({
        filter: {
            $async: Promise.resolve(spec.filter),
        },
        results: spec.results,
    }); }));
}
describe('Connector', function () {
    describe('#query(scope)', function () {
        var skip;
        var limit;
        var filter;
        var order;
        var scope = function () { return ({ tableName: tableName, skip: skip, limit: limit, filter: filter, order: order }); };
        var subject = function () { return connector().query(scope()); };
        _1.context('with empty prefilled storage', {
            definitions: withEmptySeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        });
        _1.context('with single item prefilled storage', {
            definitions: withSingleSeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return matching items', function () { return __awaiter(_this, void 0, void 0, function () {
                    var items;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                items = _a.sent();
                                expect(items.length).toEqual(1);
                                expect(items[0]).toEqual({ id: validId });
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        });
        _1.context('with multiple items prefilled storage', {
            definitions: withMultiSeed,
            tests: function () {
                _1.context('single ascending order', {
                    definitions: function () { return (order = [{ key: 'id', dir: types_1.SortDirection.Asc }]); },
                    reset: function () { return (order = undefined); },
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return matching items in defined order', function () { return __awaiter(_this, void 0, void 0, function () {
                            var items;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        items = _a.sent();
                                        expect(items.length).toEqual(3);
                                        expect(idsOf(items)).toEqual([1, 2, 3]);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                _1.context('single descending order', {
                    definitions: function () { return (order = [{ key: 'id', dir: types_1.SortDirection.Desc }]); },
                    reset: function () { return (order = undefined); },
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return matching items in defined order', function () { return __awaiter(_this, void 0, void 0, function () {
                            var items;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        items = _a.sent();
                                        expect(items.length).toEqual(3);
                                        expect(idsOf(items)).toEqual([3, 2, 1]);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                _1.context('single ascending order on nullable field', {
                    definitions: function () { return (order = [{ key: 'foo', dir: types_1.SortDirection.Asc }]); },
                    reset: function () { return (order = undefined); },
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return matching items in defined order with nulls last', function () { return __awaiter(_this, void 0, void 0, function () {
                            var items;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        items = _a.sent();
                                        expect(items.length).toEqual(3);
                                        expect(idsOf(items)).toEqual([1, 3, 2]);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                _1.context('single descending order on nullable field', {
                    definitions: function () { return (order = [{ key: 'foo', dir: types_1.SortDirection.Desc }]); },
                    reset: function () { return (order = undefined); },
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return matching items in defined order with nulls first', function () { return __awaiter(_this, void 0, void 0, function () {
                            var items;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        items = _a.sent();
                                        expect(items.length).toEqual(3);
                                        expect(idsOf(items)).toEqual([2, 1, 3]);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                _1.context('multiple ascending order on nullable field', {
                    definitions: function () {
                        return (order = [
                            { key: 'foo', dir: types_1.SortDirection.Asc },
                            { key: 'id', dir: types_1.SortDirection.Asc },
                        ]);
                    },
                    reset: function () { return (order = undefined); },
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return matching items in defined order with nulls last', function () { return __awaiter(_this, void 0, void 0, function () {
                            var items;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        items = _a.sent();
                                        expect(items.length).toEqual(3);
                                        expect(idsOf(items)).toEqual([1, 3, 2]);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                _1.context('multiple descending order on nullable field', {
                    definitions: function () {
                        return (order = [
                            { key: 'foo', dir: types_1.SortDirection.Desc },
                            { key: 'id', dir: types_1.SortDirection.Desc },
                        ]);
                    },
                    reset: function () { return (order = undefined); },
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return matching items in defined order with nulls last', function () { return __awaiter(_this, void 0, void 0, function () {
                            var items;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        items = _a.sent();
                                        expect(items.length).toEqual(3);
                                        expect(idsOf(items)).toEqual([2, 3, 1]);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                var _loop_1 = function (groupName) {
                    describe(groupName + ' filter', function () {
                        filterSpecGroups[groupName].forEach(function (filterSpec) {
                            _1.context("with filter '" + JSON.stringify(filterSpec.filter) + "'", {
                                definitions: function () { return (filter = filterSpec.filter); },
                                reset: function () { return (filter = undefined); },
                                tests: function () {
                                    var _this = this;
                                    var results = filterSpec.results;
                                    if (Array.isArray(results)) {
                                        if (results.length === 0) {
                                            _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                                                        case 1:
                                                            _a.sent();
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); });
                                        }
                                        else if (results.length === 3) {
                                            _1.it('promisesto return all items', function () { return __awaiter(_this, void 0, void 0, function () {
                                                var items;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, subject()];
                                                        case 1:
                                                            items = _a.sent();
                                                            expect(items.length).toEqual(results.length);
                                                            expect(idsOf(items)).toEqual(results);
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); });
                                        }
                                        else {
                                            _1.it('promises to return all matching items', function () { return __awaiter(_this, void 0, void 0, function () {
                                                var items;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, subject()];
                                                        case 1:
                                                            items = _a.sent();
                                                            expect(items.length).toEqual(results.length);
                                                            expect(idsOf(items)).toEqual(results);
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); });
                                        }
                                        _1.context('when skip is present', {
                                            definitions: function () { return (skip = 1); },
                                            reset: function () { return (skip = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return all matching items', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var items;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, subject()];
                                                            case 1:
                                                                items = _a.sent();
                                                                expect(items.length).toEqual(Math.max(0, results.length - 1));
                                                                expect(idsOf(items)).toEqual(results.slice(1));
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                        _1.context('when limit is present', {
                                            definitions: function () { return (limit = 1); },
                                            reset: function () { return (limit = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return all matching items', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var items;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, subject()];
                                                            case 1:
                                                                items = _a.sent();
                                                                expect(items.length).toEqual(results.length > 0 ? 1 : 0);
                                                                expect(idsOf(items)).toEqual(results.slice(0, 1));
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                        _1.context('when skip and limit is present', {
                                            definitions: function () { return (skip = limit = 1); },
                                            reset: function () { return (skip = limit = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return all matching items', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var items;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, subject()];
                                                            case 1:
                                                                items = _a.sent();
                                                                expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
                                                                expect(idsOf(items)).toEqual(results.slice(1, 2));
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                    }
                                    else {
                                        _1.it('rejects filter and returns error', function () {
                                            return expect(subject()).rejects.toEqual(results);
                                        });
                                    }
                                },
                            });
                        });
                    });
                };
                for (var groupName in filterSpecGroups) {
                    _loop_1(groupName);
                }
            },
        });
    });
    describe('#select(scope, ...keys)', function () {
        var skip;
        var limit;
        var filter = undefined;
        var keys = [];
        var scope = function () { return ({ tableName: tableName, skip: skip, limit: limit, filter: filter }); };
        var subject = function () {
            var _a;
            return (_a = connector()).select.apply(_a, __spreadArrays([scope()], keys));
        };
        _1.context('with empty prefilled storage', {
            definitions: withEmptySeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        });
        _1.context('with single item prefilled storage', {
            definitions: withSingleSeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return all items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                    var items;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                items = _a.sent();
                                expect(items.length).toEqual(1);
                                expect(Object.keys(items[0]).length).toEqual(0);
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        });
        _1.context('with multiple items prefilled storage', {
            definitions: withMultiSeed,
            tests: function () {
                var _loop_2 = function (groupName) {
                    describe(groupName + ' filter', function () {
                        filterSpecGroups[groupName].forEach(function (filterSpec) {
                            _1.context("with filter '" + JSON.stringify(filterSpec.filter) + "'", {
                                definitions: function () { return (filter = filterSpec.filter); },
                                reset: function () { return (filter = undefined); },
                                tests: function () {
                                    var _this = this;
                                    var results = filterSpec.results;
                                    if (Array.isArray(results)) {
                                        if (results.length === 0) {
                                            _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                                                        case 1:
                                                            _a.sent();
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); });
                                        }
                                        else if (results.length === 3) {
                                            _1.it('promises to return all items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                var items;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, subject()];
                                                        case 1:
                                                            items = _a.sent();
                                                            expect(items.length).toEqual(results.length);
                                                            expect(Object.keys(items[0]).length).toEqual(0);
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); });
                                        }
                                        else {
                                            _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                var items;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, subject()];
                                                        case 1:
                                                            items = _a.sent();
                                                            expect(items.length).toEqual(results.length);
                                                            expect(Object.keys(items[0]).length).toEqual(0);
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); });
                                        }
                                        _1.context('when skip is present', {
                                            definitions: function () { return (skip = 1); },
                                            reset: function () { return (skip = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var items;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, subject()];
                                                            case 1:
                                                                items = _a.sent();
                                                                expect(items.length).toEqual(Math.max(0, results.length - 1));
                                                                if (results.length > 1) {
                                                                    expect(Object.keys(items[0]).length).toEqual(0);
                                                                }
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                        _1.context('when limit is present', {
                                            definitions: function () { return (limit = 1); },
                                            reset: function () { return (limit = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var items;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, subject()];
                                                            case 1:
                                                                items = _a.sent();
                                                                expect(items.length).toEqual(results.length > 0 ? 1 : 0);
                                                                if (results.length > 0) {
                                                                    expect(Object.keys(items[0]).length).toEqual(0);
                                                                }
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                        _1.context('when skip and limit is present', {
                                            definitions: function () { return (skip = limit = 1); },
                                            reset: function () { return (skip = limit = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var items;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, subject()];
                                                            case 1:
                                                                items = _a.sent();
                                                                expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
                                                                if (results.length > 1) {
                                                                    expect(Object.keys(items[0]).length).toEqual(0);
                                                                }
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                    }
                                    else {
                                        _1.it('rejects filter and returns error', function () {
                                            return expect(subject()).rejects.toEqual(results);
                                        });
                                    }
                                },
                            });
                        });
                    });
                };
                for (var groupName in filterSpecGroups) {
                    _loop_2(groupName);
                }
            },
        });
        _1.context('when keys contain single item', {
            definitions: function () {
                keys = ['id'];
            },
            tests: function () {
                _1.context('with single item prefilled storage', {
                    definitions: withSingleSeed,
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return all items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                            var items;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        items = _a.sent();
                                        expect(items.length).toEqual(1);
                                        expect(Object.keys(items[0]).length).toEqual(1);
                                        expect(items[0]).toEqual({ id: validId });
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                _1.context('with multiple items prefilled storage', {
                    definitions: withMultiSeed,
                    tests: function () {
                        var _loop_3 = function (groupName) {
                            describe(groupName + ' filter', function () {
                                filterSpecGroups[groupName].forEach(function (filterSpec) {
                                    _1.context("with filter '" + JSON.stringify(filterSpec.filter) + "'", {
                                        definitions: function () { return (filter = filterSpec.filter); },
                                        reset: function () { return (filter = undefined); },
                                        tests: function () {
                                            var _this = this;
                                            var results = filterSpec.results;
                                            if (Array.isArray(results)) {
                                                if (results.length === 0) {
                                                    _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                                                        return __generator(this, function (_a) {
                                                            switch (_a.label) {
                                                                case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                                                                case 1:
                                                                    _a.sent();
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    }); });
                                                }
                                                else if (results.length === 3) {
                                                    _1.it('promises to return all items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                        var items;
                                                        return __generator(this, function (_a) {
                                                            switch (_a.label) {
                                                                case 0: return [4 /*yield*/, subject()];
                                                                case 1:
                                                                    items = _a.sent();
                                                                    expect(items.length).toEqual(results.length);
                                                                    expect(Object.keys(items[0]).length).toEqual(1);
                                                                    expect(idsOf(items)).toEqual(results);
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    }); });
                                                }
                                                else {
                                                    _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                        var items;
                                                        return __generator(this, function (_a) {
                                                            switch (_a.label) {
                                                                case 0: return [4 /*yield*/, subject()];
                                                                case 1:
                                                                    items = _a.sent();
                                                                    expect(items.length).toEqual(results.length);
                                                                    expect(Object.keys(items[0]).length).toEqual(1);
                                                                    expect(idsOf(items)).toEqual(results);
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    }); });
                                                }
                                                _1.context('when skip is present', {
                                                    definitions: function () { return (skip = 1); },
                                                    reset: function () { return (skip = undefined); },
                                                    tests: function () {
                                                        var _this = this;
                                                        _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                            var items;
                                                            return __generator(this, function (_a) {
                                                                switch (_a.label) {
                                                                    case 0: return [4 /*yield*/, subject()];
                                                                    case 1:
                                                                        items = _a.sent();
                                                                        expect(items.length).toEqual(Math.max(0, results.length - 1));
                                                                        if (results.length > 1) {
                                                                            expect(Object.keys(items[0]).length).toEqual(1);
                                                                        }
                                                                        expect(idsOf(items)).toEqual(results.slice(1));
                                                                        return [2 /*return*/];
                                                                }
                                                            });
                                                        }); });
                                                    },
                                                });
                                                _1.context('when limit is present', {
                                                    definitions: function () { return (limit = 1); },
                                                    reset: function () { return (limit = undefined); },
                                                    tests: function () {
                                                        var _this = this;
                                                        _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                            var items;
                                                            return __generator(this, function (_a) {
                                                                switch (_a.label) {
                                                                    case 0: return [4 /*yield*/, subject()];
                                                                    case 1:
                                                                        items = _a.sent();
                                                                        expect(items.length).toEqual(results.length > 0 ? 1 : 0);
                                                                        if (results.length > 0) {
                                                                            expect(Object.keys(items[0]).length).toEqual(1);
                                                                        }
                                                                        expect(idsOf(items)).toEqual(results.slice(0, 1));
                                                                        return [2 /*return*/];
                                                                }
                                                            });
                                                        }); });
                                                    },
                                                });
                                                _1.context('when skip and limit is present', {
                                                    definitions: function () { return (skip = limit = 1); },
                                                    reset: function () { return (skip = limit = undefined); },
                                                    tests: function () {
                                                        var _this = this;
                                                        _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                            var items;
                                                            return __generator(this, function (_a) {
                                                                switch (_a.label) {
                                                                    case 0: return [4 /*yield*/, subject()];
                                                                    case 1:
                                                                        items = _a.sent();
                                                                        expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
                                                                        if (results.length > 1) {
                                                                            expect(Object.keys(items[0]).length).toEqual(1);
                                                                        }
                                                                        expect(idsOf(items)).toEqual(results.slice(1, 2));
                                                                        return [2 /*return*/];
                                                                }
                                                            });
                                                        }); });
                                                    },
                                                });
                                            }
                                            else {
                                                _1.it('rejects filter and returns error', function () {
                                                    return expect(subject()).rejects.toEqual(results);
                                                });
                                            }
                                        },
                                    });
                                });
                            });
                        };
                        for (var groupName in filterSpecGroups) {
                            _loop_3(groupName);
                        }
                    },
                });
            },
        });
        _1.context('when keys contain multiple items', {
            definitions: function () {
                keys = ['id', 'foo'];
            },
            tests: function () {
                _1.context('with single item prefilled storage', {
                    definitions: withSingleSeed,
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return all items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                            var items;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        items = _a.sent();
                                        expect(items.length).toEqual(1);
                                        expect(Object.keys(items[0]).length).toEqual(2);
                                        expect(items[0]).toEqual({ id: validId, foo: undefined });
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                _1.context('with multiple items prefilled storage', {
                    definitions: withMultiSeed,
                    tests: function () {
                        var _loop_4 = function (groupName) {
                            describe(groupName + ' filter', function () {
                                filterSpecGroups[groupName].forEach(function (filterSpec) {
                                    _1.context("with filter '" + JSON.stringify(filterSpec.filter) + "'", {
                                        definitions: function () { return (filter = filterSpec.filter); },
                                        reset: function () { return (filter = undefined); },
                                        tests: function () {
                                            var _this = this;
                                            var results = filterSpec.results;
                                            if (Array.isArray(results)) {
                                                if (results.length === 0) {
                                                    _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                                                        return __generator(this, function (_a) {
                                                            switch (_a.label) {
                                                                case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                                                                case 1:
                                                                    _a.sent();
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    }); });
                                                }
                                                else if (results.length === 3) {
                                                    _1.it('promises to return all items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                        var items;
                                                        return __generator(this, function (_a) {
                                                            switch (_a.label) {
                                                                case 0: return [4 /*yield*/, subject()];
                                                                case 1:
                                                                    items = _a.sent();
                                                                    expect(items.length).toEqual(results.length);
                                                                    expect(Object.keys(items[0]).length).toEqual(2);
                                                                    expect(idsOf(items)).toEqual(results);
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    }); });
                                                }
                                                else {
                                                    _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                        var items;
                                                        return __generator(this, function (_a) {
                                                            switch (_a.label) {
                                                                case 0: return [4 /*yield*/, subject()];
                                                                case 1:
                                                                    items = _a.sent();
                                                                    expect(items.length).toEqual(results.length);
                                                                    expect(Object.keys(items[0]).length).toEqual(2);
                                                                    expect(idsOf(items)).toEqual(results);
                                                                    return [2 /*return*/];
                                                            }
                                                        });
                                                    }); });
                                                }
                                                _1.context('when skip is present', {
                                                    definitions: function () { return (skip = 1); },
                                                    reset: function () { return (skip = undefined); },
                                                    tests: function () {
                                                        var _this = this;
                                                        _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                            var items;
                                                            return __generator(this, function (_a) {
                                                                switch (_a.label) {
                                                                    case 0: return [4 /*yield*/, subject()];
                                                                    case 1:
                                                                        items = _a.sent();
                                                                        expect(items.length).toEqual(Math.max(0, results.length - 1));
                                                                        if (results.length > 1) {
                                                                            expect(Object.keys(items[0]).length).toEqual(2);
                                                                        }
                                                                        expect(idsOf(items)).toEqual(results.slice(1));
                                                                        return [2 /*return*/];
                                                                }
                                                            });
                                                        }); });
                                                    },
                                                });
                                                _1.context('when limit is present', {
                                                    definitions: function () { return (limit = 1); },
                                                    reset: function () { return (limit = undefined); },
                                                    tests: function () {
                                                        var _this = this;
                                                        _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                            var items;
                                                            return __generator(this, function (_a) {
                                                                switch (_a.label) {
                                                                    case 0: return [4 /*yield*/, subject()];
                                                                    case 1:
                                                                        items = _a.sent();
                                                                        expect(items.length).toEqual(results.length > 0 ? 1 : 0);
                                                                        if (results.length > 0) {
                                                                            expect(Object.keys(items[0]).length).toEqual(2);
                                                                        }
                                                                        expect(idsOf(items)).toEqual(results.slice(0, 1));
                                                                        return [2 /*return*/];
                                                                }
                                                            });
                                                        }); });
                                                    },
                                                });
                                                _1.context('when skip and limit is present', {
                                                    definitions: function () { return (skip = limit = 1); },
                                                    reset: function () { return (skip = limit = undefined); },
                                                    tests: function () {
                                                        var _this = this;
                                                        _1.it('promises to return all matching items with selected attributes', function () { return __awaiter(_this, void 0, void 0, function () {
                                                            var items;
                                                            return __generator(this, function (_a) {
                                                                switch (_a.label) {
                                                                    case 0: return [4 /*yield*/, subject()];
                                                                    case 1:
                                                                        items = _a.sent();
                                                                        expect(items.length).toEqual(results.length - 1 > 0 ? 1 : 0);
                                                                        if (results.length > 1) {
                                                                            expect(Object.keys(items[0]).length).toEqual(2);
                                                                        }
                                                                        expect(idsOf(items)).toEqual(results.slice(1, 2));
                                                                        return [2 /*return*/];
                                                                }
                                                            });
                                                        }); });
                                                    },
                                                });
                                            }
                                            else {
                                                _1.it('rejects filter and returns error', function () {
                                                    return expect(subject()).rejects.toEqual(results);
                                                });
                                            }
                                        },
                                    });
                                });
                            });
                        };
                        for (var groupName in filterSpecGroups) {
                            _loop_4(groupName);
                        }
                    },
                });
            },
        });
    });
    describe('#count(scope)', function () {
        var skip;
        var limit;
        var filter = undefined;
        var scope = function () { return ({ tableName: tableName, skip: skip, limit: limit, filter: filter }); };
        var subject = function () { return connector().count(scope()); };
        _1.context('with empty prefilled storage', {
            definitions: withEmptySeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return a count of 0', function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual(0)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        });
        _1.context('with single item prefilled storage', {
            definitions: withSingleSeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return a count of 1', function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual(1)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        });
        _1.context('with multiple items prefilled storage', {
            definitions: withMultiSeed,
            tests: function () {
                var _loop_5 = function (groupName) {
                    describe(groupName + ' filter', function () {
                        filterSpecGroups[groupName].forEach(function (filterSpec) {
                            _1.context("with filter '" + JSON.stringify(filterSpec.filter) + "'", {
                                definitions: function () { return (filter = filterSpec.filter); },
                                reset: function () { return (filter = undefined); },
                                tests: function () {
                                    var _this = this;
                                    var results = filterSpec.results;
                                    if (Array.isArray(results)) {
                                        _1.it('promises to return a count of ' + results.length, function () { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual(results.length)];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); });
                                        _1.context('when skip is present', {
                                            definitions: function () { return (skip = 1); },
                                            reset: function () { return (skip = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return the count of all matching items', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual(Math.max(0, results.length - 1))];
                                                            case 1:
                                                                _a.sent();
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                        _1.context('when limit is present', {
                                            definitions: function () { return (limit = 1); },
                                            reset: function () { return (limit = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return the count of all matching items', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual(results.length > 0 ? 1 : 0)];
                                                            case 1:
                                                                _a.sent();
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                        _1.context('when skip and limit is present', {
                                            definitions: function () { return (skip = limit = 1); },
                                            reset: function () { return (skip = limit = undefined); },
                                            tests: function () {
                                                var _this = this;
                                                _1.it('promises to return the count of all matching items', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual(results.length - 1 > 0 ? 1 : 0)];
                                                            case 1:
                                                                _a.sent();
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            },
                                        });
                                    }
                                    else {
                                        _1.it('rejects filter and returns error', function () {
                                            return expect(subject()).rejects.toEqual(results);
                                        });
                                    }
                                },
                            });
                        });
                    });
                };
                for (var groupName in filterSpecGroups) {
                    _loop_5(groupName);
                }
            },
        });
    });
    describe('#updateAll(scope, attrs)', function () {
        var attrs = {
            foo: 'baz',
        };
        var skip;
        var limit;
        var filter = undefined;
        var scope = function () { return ({ tableName: tableName, skip: skip, limit: limit, filter: filter }); };
        var subject = function () { return connector().updateAll(scope(), attrs); };
        _1.context('with empty prefilled storage', {
            definitions: withEmptySeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.it('does not change items in storage', function () { return __awaiter(_this, void 0, void 0, function () {
                    var storageBeforeUpdate, storageAfterUpdate;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                storageBeforeUpdate = __1.clone(items());
                                return [4 /*yield*/, subject()];
                            case 1:
                                _a.sent();
                                storageAfterUpdate = items();
                                expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        });
        _1.context('with single item prefilled storage', {
            definitions: withSingleSeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return updated items', function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([__assign({ id: validId }, attrs)])];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.it('changes items in storage', function () { return __awaiter(_this, void 0, void 0, function () {
                    var storageBeforeUpdate, storageAfterUpdate;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                storageBeforeUpdate = __1.clone(items());
                                return [4 /*yield*/, subject()];
                            case 1:
                                _a.sent();
                                storageAfterUpdate = items();
                                expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                                expect(storageAfterUpdate).toEqual([__assign({ id: validId }, attrs)]);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('when filter does not match any item', {
                    definitions: function () { return (filter = { id: invalidId }); },
                    reset: function () { return (filter = undefined); },
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        _1.it('does not change items in storage', function () { return __awaiter(_this, void 0, void 0, function () {
                            var storageBeforeUpdate, storageAfterUpdate;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        storageBeforeUpdate = __1.clone(items());
                                        return [4 /*yield*/, subject()];
                                    case 1:
                                        _a.sent();
                                        storageAfterUpdate = items();
                                        expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
            },
        });
        _1.context('with multiple items prefilled storage', {
            definitions: withMultiSeed,
            tests: function () {
                var _loop_6 = function (groupName) {
                    describe(groupName + ' filter', function () {
                        filterSpecGroups[groupName].forEach(function (filterSpec) {
                            _1.context("with filter '" + JSON.stringify(filterSpec.filter) + "'", {
                                definitions: function () { return (filter = filterSpec.filter); },
                                tests: function () {
                                    var _this = this;
                                    var results = filterSpec.results;
                                    if (Array.isArray(results)) {
                                        var itUpdatesMatchingItems_1 = function (results) {
                                            _1.it('promises to return updated records', function () { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual(results.map(function (id) { return (__assign({ id: id }, attrs)); }))];
                                                        case 1:
                                                            _a.sent();
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); });
                                            if (results.length === 0) {
                                                _1.it('does not change storage when scope has no matches', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var storageBeforeUpdate, storageAfterUpdate;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0:
                                                                storageBeforeUpdate = __1.clone(items());
                                                                return [4 /*yield*/, subject()];
                                                            case 1:
                                                                _a.sent();
                                                                storageAfterUpdate = items();
                                                                expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            }
                                            else {
                                                _1.it('changes matching items in storage', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var storageBeforeUpdate, changedStorage, storageAfterUpdate;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0:
                                                                storageBeforeUpdate = __1.clone(items());
                                                                changedStorage = items().map(function (item) {
                                                                    return results.includes(item.id) ? __assign(__assign({}, item), attrs) : item;
                                                                });
                                                                return [4 /*yield*/, subject()];
                                                            case 1:
                                                                _a.sent();
                                                                storageAfterUpdate = items();
                                                                expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                                                                expect(storageAfterUpdate).toEqual(changedStorage);
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            }
                                        };
                                        itUpdatesMatchingItems_1(results);
                                        _1.context('when skip is present', {
                                            definitions: function () { return (skip = 1); },
                                            reset: function () { return (skip = undefined); },
                                            tests: function () {
                                                itUpdatesMatchingItems_1(results.slice(1));
                                            },
                                        });
                                        _1.context('when limit is present', {
                                            definitions: function () { return (limit = 1); },
                                            reset: function () { return (limit = undefined); },
                                            tests: function () {
                                                itUpdatesMatchingItems_1(results.slice(0, 1));
                                            },
                                        });
                                        _1.context('when skip and limit is present', {
                                            definitions: function () { return (skip = limit = 1); },
                                            reset: function () { return (skip = limit = undefined); },
                                            tests: function () {
                                                itUpdatesMatchingItems_1(results.slice(1, 2));
                                            },
                                        });
                                    }
                                    else {
                                        _1.it('rejects filter and returns error', function () {
                                            return expect(subject()).rejects.toEqual(results);
                                        });
                                    }
                                },
                            });
                        });
                    });
                };
                for (var groupName in filterSpecGroups) {
                    _loop_6(groupName);
                }
            },
        });
    });
    describe('#deleteAll(scope)', function () {
        var skip;
        var limit;
        var filter = undefined;
        var scope = function () { return ({ tableName: tableName, skip: skip, limit: limit, filter: filter }); };
        var subject = function () { return connector().deleteAll(scope()); };
        _1.context('with empty prefilled storage', {
            definitions: withEmptySeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.it('does not change items in storage', function () { return __awaiter(_this, void 0, void 0, function () {
                    var storageBeforeUpdate, storageAfterUpdate;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                storageBeforeUpdate = __1.clone(items());
                                return [4 /*yield*/, subject()];
                            case 1:
                                _a.sent();
                                storageAfterUpdate = items();
                                expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        });
        _1.context('with single item prefilled storage', {
            definitions: withSingleSeed,
            tests: function () {
                var _this = this;
                _1.it('promises to return deleted items', function () { return __awaiter(_this, void 0, void 0, function () {
                    var storageBeforeUpdate;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                storageBeforeUpdate = __1.clone(items());
                                return [4 /*yield*/, expect(subject()).resolves.toEqual(storageBeforeUpdate)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.it('deletes items in storage', function () { return __awaiter(_this, void 0, void 0, function () {
                    var storageBeforeUpdate, storageAfterUpdate;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                storageBeforeUpdate = __1.clone(items());
                                return [4 /*yield*/, subject()];
                            case 1:
                                _a.sent();
                                storageAfterUpdate = items();
                                expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                                expect(storageAfterUpdate).toEqual([]);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('when filter does not match any item', {
                    definitions: function () { return (filter = { id: invalidId }); },
                    reset: function () { return (filter = undefined); },
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return empty array', function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        _1.it('does not delete items in storage', function () { return __awaiter(_this, void 0, void 0, function () {
                            var storageBeforeUpdate, storageAfterUpdate;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        storageBeforeUpdate = __1.clone(items());
                                        return [4 /*yield*/, subject()];
                                    case 1:
                                        _a.sent();
                                        storageAfterUpdate = items();
                                        expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
            },
        });
        _1.context('with multiple items prefilled storage', {
            definitions: withMultiSeed,
            tests: function () {
                var _loop_7 = function (groupName) {
                    describe(groupName + ' filter', function () {
                        filterSpecGroups[groupName].forEach(function (filterSpec) {
                            _1.context("with filter '" + JSON.stringify(filterSpec.filter) + "'", {
                                definitions: function () { return (filter = filterSpec.filter); },
                                reset: function () { return (filter = undefined); },
                                tests: function () {
                                    var _this = this;
                                    var results = filterSpec.results;
                                    if (Array.isArray(results)) {
                                        var itDeletesMatchingItems_1 = function (results) {
                                            _1.it('promises to return deleted records', function () { return __awaiter(_this, void 0, void 0, function () {
                                                var deletedItems;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            deletedItems = items().filter(function (item) { return results.includes(item.id); });
                                                            return [4 /*yield*/, expect(subject()).resolves.toEqual(deletedItems)];
                                                        case 1:
                                                            _a.sent();
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); });
                                            if (results.length === 0) {
                                                _1.it('does not change storage when scope has no matches', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var storageBeforeUpdate, storageAfterUpdate;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0:
                                                                storageBeforeUpdate = __1.clone(items());
                                                                return [4 /*yield*/, subject()];
                                                            case 1:
                                                                _a.sent();
                                                                storageAfterUpdate = items();
                                                                expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            }
                                            else {
                                                _1.it('deletes matching items in storage', function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var storageBeforeUpdate, changedStorage, storageAfterUpdate;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0:
                                                                storageBeforeUpdate = __1.clone(items());
                                                                changedStorage = items().filter(function (item) { return !results.includes(item.id); });
                                                                return [4 /*yield*/, subject()];
                                                            case 1:
                                                                _a.sent();
                                                                storageAfterUpdate = items();
                                                                expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                                                                expect(storageAfterUpdate).toEqual(changedStorage);
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); });
                                            }
                                        };
                                        itDeletesMatchingItems_1(results);
                                        _1.context('when skip is present', {
                                            definitions: function () { return (skip = 1); },
                                            reset: function () { return (skip = undefined); },
                                            tests: function () {
                                                itDeletesMatchingItems_1(results.slice(1));
                                            },
                                        });
                                        _1.context('when limit is present', {
                                            definitions: function () { return (limit = 1); },
                                            reset: function () { return (limit = undefined); },
                                            tests: function () {
                                                itDeletesMatchingItems_1(results.slice(0, 1));
                                            },
                                        });
                                        _1.context('when skip and limit is present', {
                                            definitions: function () { return (skip = limit = 1); },
                                            reset: function () { return (skip = limit = undefined); },
                                            tests: function () {
                                                itDeletesMatchingItems_1(results.slice(1, 2));
                                            },
                                        });
                                    }
                                    else {
                                        _1.it('rejects filter and returns error', function () {
                                            return expect(subject()).rejects.toEqual(results);
                                        });
                                    }
                                },
                            });
                        });
                    });
                };
                for (var groupName in filterSpecGroups) {
                    _loop_7(groupName);
                }
            },
        });
    });
    describe('#batchInsert(tableName, keys, items)', function () {
        var defaultKeys = { id: types_1.KeyType.number };
        var keys = defaultKeys;
        var itemsToInsert = [];
        var subject = function () { return connector().batchInsert(tableName, keys, itemsToInsert); };
        var itInsertsItemsToStorage = function (seeds) {
            for (var description in seeds) {
                var definitions = seeds[description];
                _1.context(description, {
                    definitions: definitions,
                    tests: function () {
                        var _this = this;
                        _1.it('promises to return empty', function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, expect(subject()).resolves.toEqual([])];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        _1.it('does not change storage', function () { return __awaiter(_this, void 0, void 0, function () {
                            var storageBeforeUpdate, storageAfterUpdate;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        storageBeforeUpdate = __1.clone(items());
                                        return [4 /*yield*/, subject()];
                                    case 1:
                                        _a.sent();
                                        storageAfterUpdate = items();
                                        expect(storageBeforeUpdate).toEqual(storageAfterUpdate);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        _1.context('with single item to insert', {
                            definitions: function () { return (itemsToInsert = [{ foo: 'bar' }]); },
                            reset: function () { return (itemsToInsert = []); },
                            tests: function () {
                                var _this = this;
                                _1.it('promises to return single item', function () { return __awaiter(_this, void 0, void 0, function () {
                                    var items, createdItems, _i, items_1, item;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, subject()];
                                            case 1:
                                                items = _a.sent();
                                                createdItems = items.map(function (item, index) { return (__assign({ id: item.id }, itemsToInsert[index])); });
                                                expect(items.length).toEqual(itemsToInsert.length);
                                                for (_i = 0, items_1 = items; _i < items_1.length; _i++) {
                                                    item = items_1[_i];
                                                    expect(typeof item.id).toEqual('number');
                                                }
                                                expect(items).toEqual(createdItems);
                                                return [2 /*return*/];
                                        }
                                    });
                                }); });
                                _1.it('adds items to storage', function () { return __awaiter(_this, void 0, void 0, function () {
                                    var storageBeforeUpdate, createdItems, storageAfterUpdate;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                storageBeforeUpdate = __1.clone(items());
                                                return [4 /*yield*/, subject()];
                                            case 1:
                                                createdItems = _a.sent();
                                                storageAfterUpdate = items();
                                                expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                                                expect(storageAfterUpdate).toEqual(__spreadArrays(storageBeforeUpdate, createdItems));
                                                return [2 /*return*/];
                                        }
                                    });
                                }); });
                                _1.context('with uuid id', {
                                    definitions: function () { return (keys = { id: types_1.KeyType.number, uuid: types_1.KeyType.uuid }); },
                                    reset: function () { return (keys = defaultKeys); },
                                    tests: function () {
                                        var _this = this;
                                        _1.it('promises to return single item with multiple keys', function () { return __awaiter(_this, void 0, void 0, function () {
                                            var items, createdItems, _i, items_2, item;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, subject()];
                                                    case 1:
                                                        items = _a.sent();
                                                        createdItems = items.map(function (item, index) { return (__assign({ id: item.id, uuid: item.uuid }, itemsToInsert[index])); });
                                                        expect(items.length).toEqual(itemsToInsert.length);
                                                        for (_i = 0, items_2 = items; _i < items_2.length; _i++) {
                                                            item = items_2[_i];
                                                            expect(item.id).toBeGreaterThan(0);
                                                            expect(typeof item.uuid).toEqual('string');
                                                        }
                                                        expect(items).toEqual(createdItems);
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); });
                                        _1.it('adds items to storage', function () { return __awaiter(_this, void 0, void 0, function () {
                                            var storageBeforeUpdate, createdItems, storageAfterUpdate;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        storageBeforeUpdate = __1.clone(items());
                                                        return [4 /*yield*/, subject()];
                                                    case 1:
                                                        createdItems = _a.sent();
                                                        storageAfterUpdate = items();
                                                        expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                                                        expect(storageAfterUpdate).toEqual(__spreadArrays(storageBeforeUpdate, createdItems));
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); });
                                    },
                                });
                            },
                        });
                        _1.context('with multiple items to insert', {
                            definitions: function () {
                                return (itemsToInsert = [{ foo: 'bar' }, { foo: null }, { foo: undefined }]);
                            },
                            reset: function () { return (itemsToInsert = []); },
                            tests: function () {
                                var _this = this;
                                _1.it('promises to return created items', function () { return __awaiter(_this, void 0, void 0, function () {
                                    var items, createdItems, prevItem, _i, items_3, item;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, subject()];
                                            case 1:
                                                items = _a.sent();
                                                createdItems = items.map(function (item, index) { return (__assign({ id: item.id }, itemsToInsert[index])); });
                                                expect(items.length).toEqual(itemsToInsert.length);
                                                prevItem = items[items.length - 1];
                                                for (_i = 0, items_3 = items; _i < items_3.length; _i++) {
                                                    item = items_3[_i];
                                                    expect(typeof item.id).toEqual('number');
                                                    expect(item.id).not.toEqual(prevItem.id);
                                                    prevItem = item;
                                                }
                                                expect(items).toEqual(createdItems);
                                                return [2 /*return*/];
                                        }
                                    });
                                }); });
                                _1.it('adds items to storage', function () { return __awaiter(_this, void 0, void 0, function () {
                                    var storageBeforeUpdate, createdItems, storageAfterUpdate;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                storageBeforeUpdate = __1.clone(items());
                                                return [4 /*yield*/, subject()];
                                            case 1:
                                                createdItems = _a.sent();
                                                storageAfterUpdate = items();
                                                expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                                                expect(storageAfterUpdate).toEqual(__spreadArrays(storageBeforeUpdate, createdItems));
                                                return [2 /*return*/];
                                        }
                                    });
                                }); });
                                _1.context('with uuid id', {
                                    definitions: function () { return (keys = { id: types_1.KeyType.number, uuid: types_1.KeyType.uuid }); },
                                    reset: function () { return (keys = defaultKeys); },
                                    tests: function () {
                                        var _this = this;
                                        _1.it('promises to return created items', function () { return __awaiter(_this, void 0, void 0, function () {
                                            var items, createdItems, prevItem, _i, items_4, item;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, subject()];
                                                    case 1:
                                                        items = _a.sent();
                                                        createdItems = items.map(function (item, index) { return (__assign({ id: item.id, uuid: item.uuid }, itemsToInsert[index])); });
                                                        expect(items.length).toEqual(itemsToInsert.length);
                                                        prevItem = items[items.length - 1];
                                                        for (_i = 0, items_4 = items; _i < items_4.length; _i++) {
                                                            item = items_4[_i];
                                                            expect(typeof item.id).toEqual('number');
                                                            expect(typeof item.uuid).toEqual('string');
                                                            expect(item.id).not.toEqual(prevItem.id);
                                                            expect(item.uuid).not.toEqual(prevItem.uuid);
                                                            prevItem = item;
                                                        }
                                                        expect(items).toEqual(createdItems);
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); });
                                        _1.it('adds items to storage', function () { return __awaiter(_this, void 0, void 0, function () {
                                            var storageBeforeUpdate, createdItems, storageAfterUpdate;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        storageBeforeUpdate = __1.clone(items());
                                                        return [4 /*yield*/, subject()];
                                                    case 1:
                                                        createdItems = _a.sent();
                                                        storageAfterUpdate = items();
                                                        expect(storageBeforeUpdate).not.toEqual(storageAfterUpdate);
                                                        expect(storageAfterUpdate).toEqual(__spreadArrays(storageBeforeUpdate, createdItems));
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); });
                                    },
                                });
                            },
                        });
                    },
                });
            }
        };
        itInsertsItemsToStorage({
            'with empty prefilled storage': withEmptySeed,
            'with single item prefilled storage': withSingleSeed,
            'with multiple items prefilled storage': withMultiSeed,
        });
    });
});
