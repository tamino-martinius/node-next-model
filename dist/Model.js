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
function Model(props) {
    var _a;
    var connector = props.connector ? props.connector : new MemoryConnector_1.MemoryConnector();
    var order = props.order ? (Array.isArray(props.order) ? props.order : [props.order]) : [];
    var keys = props.keys || { id: types_1.KeyType.number };
    return _a = /** @class */ (function () {
            function ModelClass(props, keys) {
                this.changedProps = {};
                this.persistentProps = props;
                this.keys = keys;
            }
            ModelClass.modelScope = function () {
                return {
                    tableName: this.tableName,
                    filter: this.filter,
                    limit: this.limit,
                    skip: this.skip,
                    order: this.order,
                };
            };
            ModelClass.limitBy = function (amount) {
                var _a;
                return _a = /** @class */ (function (_super) {
                        __extends(class_1, _super);
                        function class_1() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_1;
                    }(this)),
                    _a.limit = amount,
                    _a;
            };
            ModelClass.unlimited = function () {
                var _a;
                return _a = /** @class */ (function (_super) {
                        __extends(class_2, _super);
                        function class_2() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_2;
                    }(this)),
                    _a.limit = undefined,
                    _a;
            };
            ModelClass.skipBy = function (amount) {
                var _a;
                return _a = /** @class */ (function (_super) {
                        __extends(class_3, _super);
                        function class_3() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_3;
                    }(this)),
                    _a.skip = amount,
                    _a;
            };
            ModelClass.unskipped = function () {
                var _a;
                return _a = /** @class */ (function (_super) {
                        __extends(class_4, _super);
                        function class_4() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_4;
                    }(this)),
                    _a.skip = undefined,
                    _a;
            };
            ModelClass.orderBy = function (order) {
                var _a;
                var newOrder = __spreadArrays(this.order, (Array.isArray(order) ? order : [order]));
                return _a = /** @class */ (function (_super) {
                        __extends(class_5, _super);
                        function class_5() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_5;
                    }(this)),
                    _a.order = newOrder,
                    _a;
            };
            ModelClass.unordered = function () {
                var _a;
                return _a = /** @class */ (function (_super) {
                        __extends(class_6, _super);
                        function class_6() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_6;
                    }(this)),
                    _a.order = [],
                    _a;
            };
            ModelClass.reorder = function (order) {
                var _a;
                return _a = /** @class */ (function (_super) {
                        __extends(class_7, _super);
                        function class_7() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_7;
                    }(this)),
                    _a.order = Array.isArray(order) ? order : [order],
                    _a;
            };
            ModelClass.filterBy = function (andFilter) {
                var _a;
                ///@ts-ignore
                var filter = andFilter;
                if (this.filter) {
                    for (var key in this.filter) {
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
                return _a = /** @class */ (function (_super) {
                        __extends(class_8, _super);
                        function class_8() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_8;
                    }(this)),
                    _a.filter = filter,
                    _a;
            };
            ModelClass.orFilterBy = function (orFilter) {
                var _a;
                var filter = Object.keys(orFilter).length === 0
                    ? this.filter
                    : this.filter
                        ? { $or: [this.filter, orFilter] }
                        : orFilter;
                ///@ts-ignore
                return _a = /** @class */ (function (_super) {
                        __extends(class_9, _super);
                        function class_9() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_9;
                    }(this)),
                    _a.filter = filter,
                    _a;
            };
            ModelClass.unfiltered = function () {
                var _a;
                return _a = /** @class */ (function (_super) {
                        __extends(class_10, _super);
                        function class_10() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        return class_10;
                    }(this)),
                    _a.filter = undefined,
                    _a;
            };
            ModelClass.build = function (createProps) {
                return new this(props.init(createProps));
            };
            ModelClass.buildScoped = function (createProps) {
                ///@ts-ignore
                return new this(props.init(__assign(__assign({}, props.filter), createProps)));
            };
            ModelClass.create = function (props) {
                return this.build(props).save();
            };
            ModelClass.createScoped = function (props) {
                return this.buildScoped(props).save();
            };
            ModelClass.all = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var items;
                    var _this = this;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, connector.query(this.modelScope())];
                            case 1:
                                items = (_a.sent());
                                return [2 /*return*/, items.map(function (item) {
                                        var keys = {};
                                        for (var key in keys) {
                                            keys[key] = item[key];
                                            delete item[key];
                                        }
                                        return new _this(item, keys);
                                    })];
                        }
                    });
                });
            };
            ModelClass.first = function () {
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
            ModelClass.select = function () {
                var keys = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    keys[_i] = arguments[_i];
                }
                return __awaiter(this, void 0, void 0, function () {
                    var items;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, connector.select.apply(connector, __spreadArrays([this.modelScope()], keys))];
                            case 1:
                                items = (_a.sent());
                                return [2 /*return*/, items];
                        }
                    });
                });
            };
            ModelClass.pluck = function (key) {
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
            Object.defineProperty(ModelClass.prototype, "isPersistent", {
                get: function () {
                    return this.keys !== undefined;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(ModelClass.prototype, "isNew", {
                get: function () {
                    return this.keys === undefined;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(ModelClass.prototype, "attributes", {
                get: function () {
                    ///@ts-ignore
                    return __assign(__assign(__assign({}, this.persistentProps), this.changedProps), this.keys);
                },
                enumerable: true,
                configurable: true
            });
            ModelClass.prototype.assign = function (props) {
                for (var key in props) {
                    if (this.persistentProps[key] !== props[key]) {
                        this.changedProps[key] = props[key];
                    }
                    else {
                        delete this.changedProps[key];
                    }
                }
                return this;
            };
            Object.defineProperty(ModelClass.prototype, "itemScope", {
                get: function () {
                    return {
                        tableName: props.tableName,
                        filter: this.keys,
                        limit: 1,
                        skip: 0,
                        order: [],
                    };
                },
                enumerable: true,
                configurable: true
            });
            ModelClass.prototype.save = function () {
                return __awaiter(this, void 0, void 0, function () {
                    var changedKeys, items, item, key, items, item, key;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!this.keys) return [3 /*break*/, 3];
                                changedKeys = Object.keys(this.changedProps);
                                if (!(changedKeys.length > 0)) return [3 /*break*/, 2];
                                return [4 /*yield*/, connector.updateAll(this.itemScope, this.changedProps)];
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
                            case 3: return [4 /*yield*/, connector.batchInsert(props.tableName, keys, [
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
            return ModelClass;
        }()),
        _a.tableName = props.tableName,
        _a.filter = props.filter,
        _a.limit = props.limit,
        _a.skip = props.skip,
        _a.order = order,
        _a;
}
exports.Model = Model;
exports.default = Model;
