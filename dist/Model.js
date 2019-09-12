"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var MemoryConnector_1 = require("./MemoryConnector");
function Model(_a) {
    var tableName = _a.tableName, init = _a.init, filter = _a.filter, limit = _a.limit, skip = _a.skip, _b = _a.order, order = _b === void 0 ? [] : _b, connector = _a.connector, _c = _a.keys, keys = _c === void 0 ? { id: types_1.KeyType.number } : _c;
    var conn = connector ? connector : new MemoryConnector_1.MemoryConnector();
    var params = {
        tableName: tableName,
        init: init,
        filter: filter,
        limit: limit,
        skip: skip,
        order: order,
        connector: connector,
        keys: keys,
    };
    var orderColumns = order
        ? Array.isArray(order)
            ? order
            : [order]
        : [];
    var modelScope = {
        tableName: tableName,
        filter: filter,
        limit: limit,
        skip: skip,
        order: orderColumns,
    };
    return /** @class */ (function () {
        function M(props, keys) {
            this.changedProps = {};
            this.persistentProps = props;
            this.keys = keys;
        }
        M.limitBy = function (amount) {
            return Model(__assign(__assign({}, params), { limit: amount }));
        };
        Object.defineProperty(M, "unlimited", {
            get: function () {
                return Model(__assign(__assign({}, params), { limit: undefined }));
            },
            enumerable: true,
            configurable: true
        });
        M.skipBy = function (amount) {
            return Model(__assign(__assign({}, params), { skip: amount }));
        };
        Object.defineProperty(M, "unskipped", {
            get: function () {
                return Model(__assign(__assign({}, params), { skip: undefined }));
            },
            enumerable: true,
            configurable: true
        });
        M.orderBy = function (order) {
            return Model(__assign(__assign({}, params), { order: __spreadArrays(orderColumns, (Array.isArray(order) ? order : [order])) }));
        };
        Object.defineProperty(M, "unordered", {
            get: function () {
                return Model(__assign(__assign({}, params), { order: undefined }));
            },
            enumerable: true,
            configurable: true
        });
        M.reorder = function (order) {
            return Model(__assign(__assign({}, params), { order: __spreadArrays(orderColumns, (Array.isArray(order) ? order : [order])) }));
        };
        M.filterBy = function (andFilter) {
            if (Object.keys(andFilter).length === 0) {
                return Model(params); // Short circuit if no new filters are passed
            }
            if (filter) {
                ///@ts-ignore
                var flatFilter = __assign({}, filter);
                for (var key in andFilter) {
                    if (flatFilter[key] !== undefined && andFilter[key] !== undefined) {
                        ///@ts-ignore
                        return Model(__assign(__assign({}, params), { filter: { $and: [filter, andFilter] } }));
                    }
                    flatFilter[key] = andFilter[key];
                }
                ///@ts-ignore
                return Model(__assign(__assign({}, params), { filter: flatFilter }));
            }
            ///@ts-ignore
            return Model(__assign(__assign({}, params), { filter: andFilter }));
        };
        M.orFilterBy = function (orFilter) {
            if (Object.keys(orFilter).length === 0) {
                ///@ts-ignore
                return Model(params); // Short circuit if no new filters are passed
            }
            ///@ts-ignore
            return Model(__assign(__assign({}, params), { filter: filter ? { $or: [filter, orFilter] } : orFilter }));
        };
        Object.defineProperty(M, "unfiltered", {
            get: function () {
                return Model(__assign(__assign({}, params), { filter: undefined }));
            },
            enumerable: true,
            configurable: true
        });
        M.build = function (props) {
            return new M(init(props));
        };
        M.buildScoped = function (props) {
            ///@ts-ignore
            return new M(init(__assign(__assign({}, filter), props)));
        };
        M.create = function (props) {
            return this.build(props).save();
        };
        M.createScoped = function (props) {
            return this.buildScoped(props).save();
        };
        M.all = function () {
            return __awaiter(this, void 0, void 0, function () {
                var items;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, conn.query(modelScope)];
                        case 1:
                            items = (_a.sent());
                            return [2 /*return*/, items.map(function (item) {
                                    var keys = {};
                                    for (var key in keys) {
                                        keys[key] = item[key];
                                        delete item[key];
                                    }
                                    return new M(item, keys);
                                })];
                    }
                });
            });
        };
        M.first = function () {
            return __awaiter(this, void 0, void 0, function () {
                var items;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.limitBy(1).all()];
                        case 1:
                            items = _a.sent();
                            return [2 /*return*/, items.pop()];
                    }
                });
            });
        };
        M.select = function () {
            var keys = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                keys[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var items;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, conn.select.apply(conn, __spreadArrays([modelScope], keys))];
                        case 1:
                            items = (_a.sent());
                            return [2 /*return*/, items];
                    }
                });
            });
        };
        M.pluck = function (key) {
            return __awaiter(this, void 0, void 0, function () {
                var items;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.select(key)];
                        case 1:
                            items = _a.sent();
                            return [2 /*return*/, items.map(function (item) { return item[key]; })];
                    }
                });
            });
        };
        Object.defineProperty(M.prototype, "isPersistent", {
            get: function () {
                return this.keys !== undefined;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(M.prototype, "isNew", {
            get: function () {
                return this.keys === undefined;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(M.prototype, "attributes", {
            get: function () {
                ///@ts-ignore
                return __assign(__assign(__assign({}, this.persistentProps), this.changedProps), this.keys);
            },
            enumerable: true,
            configurable: true
        });
        M.prototype.assign = function (props) {
            for (var key in props) {
                if (this.persistentProps[key] !== props[key]) {
                    this.changedProps[key] = props[key];
                }
                else {
                    delete this.changedProps[key];
                }
            }
        };
        Object.defineProperty(M.prototype, "itemScope", {
            get: function () {
                return {
                    tableName: tableName,
                    filter: this.keys,
                    limit: 1,
                    skip: 0,
                    order: [],
                };
            },
            enumerable: true,
            configurable: true
        });
        M.prototype.save = function () {
            return __awaiter(this, void 0, void 0, function () {
                var changedKeys, items, item, key, items, item, key;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!this.keys) return [3 /*break*/, 3];
                            changedKeys = Object.keys(this.changedProps);
                            if (!(changedKeys.length > 0)) return [3 /*break*/, 2];
                            return [4 /*yield*/, conn.updateAll(this.itemScope, this.changedProps)];
                        case 1:
                            items = _a.sent();
                            item = items.pop();
                            if (item) {
                                for (key in keys) {
                                    this.keys[key] = item[key];
                                    delete item[key];
                                }
                                this.persistentProps = item;
                                this.changedProps = {};
                            }
                            else {
                                throw 'Item not found';
                            }
                            _a.label = 2;
                        case 2: return [3 /*break*/, 5];
                        case 3: return [4 /*yield*/, conn.batchInsert(tableName, keys, [
                                __assign(__assign({}, this.persistentProps), this.changedProps),
                            ])];
                        case 4:
                            items = _a.sent();
                            item = items.pop();
                            if (item) {
                                this.keys = {};
                                for (key in keys) {
                                    this.keys[key] = item[key];
                                    delete item[key];
                                }
                                this.persistentProps = item;
                                this.changedProps = {};
                            }
                            else {
                                throw 'Failed to insert item';
                            }
                            _a.label = 5;
                        case 5: return [2 /*return*/, this];
                    }
                });
            });
        };
        return M;
    }());
}
exports.Model = Model;
// [TODO] Remove example below
var User = /** @class */ (function (_super) {
    __extends(User, _super);
    function User() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(User, "males", {
        get: function () {
            return this.filterBy({ gender: 'male' });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(User, "females", {
        get: function () {
            return this.filterBy({ gender: 'female' });
        },
        enumerable: true,
        configurable: true
    });
    User.withFirstName = function (firstName) {
        return this.filterBy({ firstName: firstName });
    };
    Object.defineProperty(User.prototype, "addresses", {
        get: function () {
            return Address.filterBy({ id: this.attributes.id });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(User.prototype, "name", {
        get: function () {
            return this.attributes.firstName + " " + this.attributes.lastName;
        },
        enumerable: true,
        configurable: true
    });
    return User;
}(Model({
    tableName: 'users',
    init: function (props) { return props; },
})));
var Address = /** @class */ (function (_super) {
    __extends(Address, _super);
    function Address() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(Address.prototype, "user", {
        get: function () {
            return User.filterBy({ id: this.attributes.userId }).first;
        },
        enumerable: true,
        configurable: true
    });
    return Address;
}(Model({
    tableName: 'addresses',
    init: function (props) { return props; },
})));
