"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var types_1 = require("./types");
var connector_1 = require("./connector");
var pluralize_1 = require("pluralize");
var _1 = require(".");
var PropertyNotDefinedError = (function (_super) {
    __extends(PropertyNotDefinedError, _super);
    function PropertyNotDefinedError(name, isStatic, isReadonly) {
        if (isStatic === void 0) { isStatic = true; }
        if (isReadonly === void 0) { isReadonly = true; }
        var _this = _super.call(this, "Please define " + (isStatic ? 'static ' : '') + " " + (isReadonly ? 'readonly ' : '') + "property '" + name + "' on your model") || this;
        _this.name = 'PropertyNotDefinedError';
        return _this;
    }
    return PropertyNotDefinedError;
}(Error));
exports.PropertyNotDefinedError = PropertyNotDefinedError;
;
var LowerBoundsError = (function (_super) {
    __extends(LowerBoundsError, _super);
    function LowerBoundsError(name, lowerBound) {
        var _this = _super.call(this, "Property '" + name + "' is expected to be greater or equal to '" + lowerBound + "'") || this;
        _this.name = 'LowerBoundsError';
        return _this;
    }
    return LowerBoundsError;
}(Error));
exports.LowerBoundsError = LowerBoundsError;
;
var MinLengthError = (function (_super) {
    __extends(MinLengthError, _super);
    function MinLengthError(name, minLength) {
        var _this = _super.call(this, "Property '" + name + "' length is expected to be longer or equal to '" + minLength + "'") || this;
        _this.name = 'MinLengthError';
        return _this;
    }
    return MinLengthError;
}(Error));
exports.MinLengthError = MinLengthError;
;
var TypeError = (function (_super) {
    __extends(TypeError, _super);
    function TypeError(name, type) {
        var _this = _super.call(this, "\n      Property '" + name + "' is expected to an '" + type + "'\n    ") || this;
        _this.name = 'TypeError';
        return _this;
    }
    return TypeError;
}(Error));
exports.TypeError = TypeError;
;
function NextModel() {
    var Model = (function () {
        function Model(attrs) {
            this.cachedPersistentAttributes = {};
            if (attrs !== undefined) {
                for (var key in attrs) {
                    this[key] = attrs[key];
                }
            }
        }
        Model_1 = Model;
        Object.defineProperty(Model, "identifier", {
            get: function () {
                return 'id';
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "modelName", {
            get: function () {
                throw new PropertyNotDefinedError('modelName');
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "lowerModelName", {
            get: function () {
                var name = this.modelName;
                return name.substr(0, 1).toLowerCase() + name.substr(1);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "underscoreModelName", {
            get: function () {
                var lowerName = this.lowerModelName;
                return lowerName.replace(/([A-Z])/g, function (_x, y) { return '_' + y.toLowerCase(); });
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "pluralModelName", {
            get: function () {
                return pluralize_1.plural(this.underscoreModelName);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "collectionName", {
            get: function () {
                return undefined;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "connector", {
            get: function () {
                return new connector_1.Connector();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "schema", {
            get: function () {
                throw new PropertyNotDefinedError('schema');
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "filter", {
            get: function () {
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "limit", {
            get: function () {
                return this.DEFAULT_LIMIT;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "skip", {
            get: function () {
                return this.DEFAULT_SKIP;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "order", {
            get: function () {
                return [];
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "keys", {
            get: function () {
                var keys = [];
                for (var key in this.strictSchema) {
                    keys.push(key);
                }
                return keys;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "validators", {
            get: function () {
                return [];
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "strictSchema", {
            get: function () {
                var schema = this.schema;
                for (var key in schema) {
                    if (!('defaultValue' in schema[key])) {
                        schema[key].defaultValue = undefined;
                    }
                }
                return schema;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "strictFilter", {
            get: function () {
                return this.filter || {};
            },
            enumerable: true,
            configurable: true
        });
        Model.getTyped = function () {
            return new NextModelStatic(this);
        };
        Model.limitBy = function (amount) {
            return (function (_super) {
                __extends(class_1, _super);
                function class_1() {
                    return _super !== null && _super.apply(this, arguments) || this;
                }
                Object.defineProperty(class_1, "limit", {
                    get: function () {
                        return amount;
                    },
                    enumerable: true,
                    configurable: true
                });
                return class_1;
            }(this));
        };
        Object.defineProperty(Model, "unlimited", {
            get: function () {
                return (function (_super) {
                    __extends(class_2, _super);
                    function class_2() {
                        return _super !== null && _super.apply(this, arguments) || this;
                    }
                    Object.defineProperty(class_2, "limit", {
                        get: function () {
                            return this.DEFAULT_LIMIT;
                        },
                        enumerable: true,
                        configurable: true
                    });
                    return class_2;
                }(this));
            },
            enumerable: true,
            configurable: true
        });
        Model.skipBy = function (amount) {
            return (function (_super) {
                __extends(class_3, _super);
                function class_3() {
                    return _super !== null && _super.apply(this, arguments) || this;
                }
                Object.defineProperty(class_3, "skip", {
                    get: function () {
                        return amount;
                    },
                    enumerable: true,
                    configurable: true
                });
                return class_3;
            }(this));
        };
        Object.defineProperty(Model, "unskipped", {
            get: function () {
                return (function (_super) {
                    __extends(class_4, _super);
                    function class_4() {
                        return _super !== null && _super.apply(this, arguments) || this;
                    }
                    Object.defineProperty(class_4, "skip", {
                        get: function () {
                            return this.DEFAULT_SKIP;
                        },
                        enumerable: true,
                        configurable: true
                    });
                    return class_4;
                }(this));
            },
            enumerable: true,
            configurable: true
        });
        Model.orderBy = function (order) {
            var newOrder = [];
            newOrder.push.apply(newOrder, this.order.concat([order]));
            return (function (_super) {
                __extends(class_5, _super);
                function class_5() {
                    return _super !== null && _super.apply(this, arguments) || this;
                }
                Object.defineProperty(class_5, "order", {
                    get: function () {
                        return newOrder;
                    },
                    enumerable: true,
                    configurable: true
                });
                return class_5;
            }(this));
        };
        Model.reorder = function (order) {
            return (function (_super) {
                __extends(class_6, _super);
                function class_6() {
                    return _super !== null && _super.apply(this, arguments) || this;
                }
                Object.defineProperty(class_6, "order", {
                    get: function () {
                        return [order];
                    },
                    enumerable: true,
                    configurable: true
                });
                return class_6;
            }(this));
        };
        Object.defineProperty(Model, "unordered", {
            get: function () {
                return (function (_super) {
                    __extends(class_7, _super);
                    function class_7() {
                        return _super !== null && _super.apply(this, arguments) || this;
                    }
                    Object.defineProperty(class_7, "order", {
                        get: function () {
                            return [];
                        },
                        enumerable: true,
                        configurable: true
                    });
                    return class_7;
                }(this));
            },
            enumerable: true,
            configurable: true
        });
        Model.query = function (filterBy) {
            var filter = filterBy;
            if (this.filter !== undefined && Object.keys(this.filter).length > 0) {
                filter = {
                    $and: [filterBy, this.filter],
                };
            }
            return (function (_super) {
                __extends(class_8, _super);
                function class_8() {
                    return _super !== null && _super.apply(this, arguments) || this;
                }
                Object.defineProperty(class_8, "filter", {
                    get: function () {
                        return filter;
                    },
                    enumerable: true,
                    configurable: true
                });
                return class_8;
            }(this));
        };
        Model.onlyQuery = function (filter) {
            return (function (_super) {
                __extends(class_9, _super);
                function class_9() {
                    return _super !== null && _super.apply(this, arguments) || this;
                }
                Object.defineProperty(class_9, "filter", {
                    get: function () {
                        return filter;
                    },
                    enumerable: true,
                    configurable: true
                });
                return class_9;
            }(this));
        };
        Object.defineProperty(Model, "queryBy", {
            get: function () {
                var _this = this;
                var queryBy = {};
                var _loop_1 = function (key) {
                    queryBy[key] = function (value) {
                        var _a, _b;
                        return _this.query(Array.isArray(value)
                            ? { $in: (_a = {}, _a[key] = value, _a) }
                            : (_b = {}, _b[key] = value, _b));
                    };
                };
                for (var key in this.strictSchema) {
                    _loop_1(key);
                }
                ;
                return queryBy;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "unfiltered", {
            get: function () {
                return (function (_super) {
                    __extends(class_10, _super);
                    function class_10() {
                        return _super !== null && _super.apply(this, arguments) || this;
                    }
                    Object.defineProperty(class_10, "filter", {
                        get: function () {
                            return {};
                        },
                        enumerable: true,
                        configurable: true
                    });
                    return class_10;
                }(this));
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "all", {
            get: function () {
                return this.connector.query(this).then(function (instances) {
                    instances.forEach(function (instance) { return instance.setPersistentAttributes(); });
                    return instances;
                });
            },
            enumerable: true,
            configurable: true
        });
        Model.updateAll = function (attrs) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.connector.updateAll(this, attrs)];
                        case 1:
                            _a.sent();
                            return [2, this];
                    }
                });
            });
        };
        Model.deleteAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.connector.deleteAll(this)];
                        case 1:
                            _a.sent();
                            return [2, this];
                    }
                });
            });
        };
        Model.inBatchesOf = function (amount) {
            return __awaiter(this, void 0, void 0, function () {
                var count, batchCount, subqueries, batchIndex, skip, limit;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.count];
                        case 1:
                            count = _a.sent();
                            batchCount = Math.ceil(count / amount);
                            if (batchCount > 0 && batchCount < Number.MAX_SAFE_INTEGER) {
                                subqueries = [];
                                for (batchIndex = 0; batchIndex < batchCount; batchIndex++) {
                                    skip = this.skip + batchIndex * amount;
                                    limit = batchIndex !== batchCount - 1 ? amount : count - (batchCount - 1) * amount;
                                    subqueries.push(this.skipBy(skip).limitBy(limit).all);
                                }
                                return [2, subqueries];
                            }
                            else {
                                return [2, []];
                            }
                            return [2];
                    }
                });
            });
        };
        Object.defineProperty(Model, "first", {
            get: function () {
                return this.limitBy(1).all.then(function (instances) { return instances[0]; });
            },
            enumerable: true,
            configurable: true
        });
        Model.find = function (filterBy) {
            return this.query(filterBy).first;
        };
        Object.defineProperty(Model, "findBy", {
            get: function () {
                var _this = this;
                var findBy = {};
                var _loop_2 = function (key) {
                    findBy[key] = function (value) {
                        var _a, _b;
                        return _this.find(Array.isArray(value)
                            ? { $in: (_a = {}, _a[key] = value, _a) }
                            : (_b = {}, _b[key] = value, _b));
                    };
                };
                for (var key in this.strictSchema) {
                    _loop_2(key);
                }
                ;
                return findBy;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "count", {
            get: function () {
                return this.connector.count(this);
            },
            enumerable: true,
            configurable: true
        });
        Model.pluck = function (key) {
            return __awaiter(this, void 0, void 0, function () {
                var arr;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.connector.select(this, key)];
                        case 1:
                            arr = _a.sent();
                            return [2, arr.map(function (items) { return items[0]; })];
                    }
                });
            });
        };
        Model.select = function (key) {
            return this.connector.select(this, key);
        };
        Model.build = function (attrs) {
            return new this(attrs);
        };
        Model.create = function (attrs) {
            return new this(attrs).save();
        };
        Object.defineProperty(Model.prototype, "model", {
            get: function () {
                return this.constructor;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model.prototype, "attributes", {
            get: function () {
                var self = this;
                var attrs = {};
                for (var key in this.model.schema) {
                    attrs[key] = self[key];
                }
                return attrs;
            },
            enumerable: true,
            configurable: true
        });
        Model.prototype.setPersistentAttributes = function () {
            this.cachedPersistentAttributes = this.attributes;
        };
        Object.defineProperty(Model.prototype, "persistentAttributes", {
            get: function () {
                return this.cachedPersistentAttributes;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model.prototype, "isNew", {
            get: function () {
                return this.id === undefined || this.id === null;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model.prototype, "isPersistent", {
            get: function () {
                return !this.isNew;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model.prototype, "isChanged", {
            get: function () {
                return Object.keys(this.changes).length > 0;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model.prototype, "isValid", {
            get: function () {
                var _this = this;
                var promises = this.model.validators.map(function (validator) { return validator(_this); });
                return Promise.all(promises).then(function (validations) {
                    for (var _i = 0, validations_1 = validations; _i < validations_1.length; _i++) {
                        var isValid = validations_1[_i];
                        if (!isValid)
                            return false;
                    }
                    return true;
                });
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model.prototype, "changes", {
            get: function () {
                var self = this;
                var changes = {};
                for (var _i = 0, _a = this.model.keys; _i < _a.length; _i++) {
                    var key = _a[_i];
                    if (self[key] !== this.persistentAttributes[key]) {
                        changes[key] = { from: this.persistentAttributes[key], to: self[key] };
                    }
                }
                return changes;
            },
            enumerable: true,
            configurable: true
        });
        Model.prototype.belongsTo = function (model, options) {
            var _this = this;
            var _a;
            var relOptions = options || {};
            var foreignKey = relOptions.foreignKey || model.lowerModelName + "Id}";
            var identifier = model.identifier;
            var through = relOptions.through;
            var filter;
            if (through) {
                filter = {
                    $async: function () { return __awaiter(_this, void 0, void 0, function () {
                        var _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _a = {};
                                    _b = identifier;
                                    return [4, through.pluck(foreignKey)];
                                case 1: return [2, (_a[_b] = _c.sent(),
                                        _a)];
                            }
                        });
                    }); }
                };
            }
            else {
                filter = (_a = {},
                    _a[identifier] = this[foreignKey],
                    _a);
            }
            return model.query(filter).limitBy(1).unskipped;
        };
        Model.prototype.hasMany = function (model, options) {
            var _this = this;
            var _a;
            var relOptions = options || {};
            var through = relOptions.through;
            var filter;
            if (through) {
                var foreignKey_1 = relOptions.foreignKey || through.lowerModelName + "Id";
                filter = {
                    $async: function () { return __awaiter(_this, void 0, void 0, function () {
                        var _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _a = {};
                                    _b = foreignKey_1;
                                    return [4, through.pluck(through.identifier)];
                                case 1: return [2, (_a[_b] = _c.sent(),
                                        _a)];
                            }
                        });
                    }); }
                };
            }
            else {
                var foreignKey = relOptions.foreignKey || this.model.lowerModelName + "Id";
                filter = (_a = {},
                    _a[foreignKey] = this.id,
                    _a);
            }
            return model.query(filter).unlimited.unskipped;
        };
        Model.prototype.hasOne = function (model, options) {
            var _this = this;
            var _a;
            var relOptions = options || {};
            var through = relOptions.through;
            var filter;
            if (through) {
                var foreignKey_2 = relOptions.foreignKey || through.lowerModelName + "Id";
                filter = {
                    $async: function () { return __awaiter(_this, void 0, void 0, function () {
                        var _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _a = {};
                                    _b = foreignKey_2;
                                    return [4, through.pluck(through.identifier)];
                                case 1: return [2, (_a[_b] = _c.sent(),
                                        _a)];
                            }
                        });
                    }); }
                };
            }
            else {
                var foreignKey = relOptions.foreignKey || this.model.lowerModelName + "Id";
                filter = (_a = {},
                    _a[foreignKey] = this.id,
                    _a);
            }
            return model.query(filter).limitBy(1).unskipped;
        };
        Model.prototype.getTyped = function () {
            return new NextModelConstructor(this);
        };
        Model.prototype.assign = function (attrs) {
            for (var key in attrs) {
                this[key] = attrs[key];
            }
            return this;
        };
        Model.prototype.revertChange = function (key) {
            this[key] = this.persistentAttributes[key];
            return this;
        };
        Model.prototype.revertChanges = function () {
            for (var _i = 0, _a = this.model.keys; _i < _a.length; _i++) {
                var key = _a[_i];
                this.revertChange(key);
            }
            return this;
        };
        Model.prototype.save = function () {
            return __awaiter(this, void 0, void 0, function () {
                var instance, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            instance = void 0;
                            if (!this.isNew) return [3, 2];
                            return [4, this.model.connector.create(this)];
                        case 1:
                            instance = _a.sent();
                            return [3, 4];
                        case 2: return [4, this.model.connector.update(this)];
                        case 3:
                            instance = _a.sent();
                            _a.label = 4;
                        case 4:
                            instance.setPersistentAttributes();
                            return [2, instance];
                        case 5:
                            error_1 = _a.sent();
                            throw error_1;
                        case 6: return [2];
                    }
                });
            });
        };
        Model.prototype.delete = function () {
            return __awaiter(this, void 0, void 0, function () {
                var instance, error_2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4, this.model.connector.delete(this)];
                        case 1:
                            instance = _a.sent();
                            instance.setPersistentAttributes();
                            return [2, instance];
                        case 2:
                            error_2 = _a.sent();
                            throw error_2;
                        case 3: return [2];
                    }
                });
            });
        };
        Model.prototype.reload = function () {
            var _a;
            return this.model.limitBy(1).onlyQuery((_a = {}, _a[this.model.identifier] = this.id, _a)).first;
        };
        var Model_1;
        Model.DEFAULT_LIMIT = Number.MAX_SAFE_INTEGER;
        Model.DEFAULT_SKIP = 0;
        Model = Model_1 = __decorate([
            _1.staticImplements()
        ], Model);
        return Model;
    }());
    ;
    return Model;
}
exports.NextModel = NextModel;
;
var NextModelStatic = (function (_super) {
    __extends(NextModelStatic, _super);
    function NextModelStatic(model) {
        var _this = _super.call(this) || this;
        _this.model = model;
        return _this;
    }
    NextModelStatic.prototype.limitBy = function (amount) {
        return this.model.limitBy(amount);
    };
    Object.defineProperty(NextModelStatic.prototype, "unlimited", {
        get: function () {
            return this.model.unlimited;
        },
        enumerable: true,
        configurable: true
    });
    NextModelStatic.prototype.skipBy = function (amount) {
        return this.model.skipBy(amount);
    };
    Object.defineProperty(NextModelStatic.prototype, "unskipped", {
        get: function () {
            return this.model.unskipped;
        },
        enumerable: true,
        configurable: true
    });
    NextModelStatic.prototype.orderBy = function (order) {
        return this.model.orderBy(order);
    };
    NextModelStatic.prototype.reorder = function (order) {
        return this.model.reorder(order);
    };
    Object.defineProperty(NextModelStatic.prototype, "unordered", {
        get: function () {
            return this.model.unordered;
        },
        enumerable: true,
        configurable: true
    });
    NextModelStatic.prototype.query = function (query) {
        return this.model.query(query);
    };
    NextModelStatic.prototype.onlyQuery = function (query) {
        return this.model.onlyQuery(query);
    };
    ;
    Object.defineProperty(NextModelStatic.prototype, "queryBy", {
        get: function () {
            return this.model.queryBy;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NextModelStatic.prototype, "unfiltered", {
        get: function () {
            return this.model.unfiltered;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NextModelStatic.prototype, "all", {
        get: function () {
            return this.model.all;
        },
        enumerable: true,
        configurable: true
    });
    NextModelStatic.prototype.pluck = function (key) {
        return this.model.pluck(key);
    };
    NextModelStatic.prototype.select = function () {
        var keys = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            keys[_i] = arguments[_i];
        }
        var _a;
        return (_a = this.model).select.apply(_a, keys);
    };
    NextModelStatic.prototype.updateAll = function (attrs) {
        return this.model.updateAll(attrs);
    };
    NextModelStatic.prototype.deleteAll = function () {
        return this.model.deleteAll();
    };
    NextModelStatic.prototype.inBatchesOf = function (amount) {
        return this.model.inBatchesOf(amount);
    };
    Object.defineProperty(NextModelStatic.prototype, "first", {
        get: function () {
            return this.model.first;
        },
        enumerable: true,
        configurable: true
    });
    NextModelStatic.prototype.find = function (query) {
        return this.model.find(query);
    };
    Object.defineProperty(NextModelStatic.prototype, "findBy", {
        get: function () {
            return this.model.findBy;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(NextModelStatic.prototype, "count", {
        get: function () {
            return this.model.count;
        },
        enumerable: true,
        configurable: true
    });
    NextModelStatic.prototype.build = function (attrs) {
        return this.model.build(attrs);
    };
    NextModelStatic.prototype.create = function (attrs) {
        return this.model.create(attrs);
    };
    return NextModelStatic;
}(types_1.ModelStaticClass));
exports.NextModelStatic = NextModelStatic;
;
var NextModelConstructor = (function (_super) {
    __extends(NextModelConstructor, _super);
    function NextModelConstructor(instance) {
        var _this = _super.call(this) || this;
        _this.instance = instance;
        return _this;
    }
    Object.defineProperty(NextModelConstructor.prototype, "model", {
        get: function () {
            return this.instance.model;
        },
        enumerable: true,
        configurable: true
    });
    NextModelConstructor.prototype.belongsTo = function (model, options) {
        return this.belongsTo(model, options);
    };
    NextModelConstructor.prototype.hasMany = function (model, options) {
        return this.hasMany(model, options);
    };
    NextModelConstructor.prototype.hasOne = function (model, options) {
        return this.hasOne(model, options);
    };
    NextModelConstructor.prototype.assign = function (attrs) {
        return this.instance.assign(attrs);
    };
    NextModelConstructor.prototype.revertChange = function (key) {
        return this.instance.revertChange(key);
    };
    NextModelConstructor.prototype.revertChanges = function () {
        return this.instance.revertChanges();
    };
    NextModelConstructor.prototype.save = function () {
        return this.instance.save();
    };
    NextModelConstructor.prototype.delete = function () {
        return this.instance.delete();
    };
    NextModelConstructor.prototype.reload = function () {
        return this.instance.reload();
    };
    return NextModelConstructor;
}(types_1.ModelConstructorClass));
exports.NextModelConstructor = NextModelConstructor;
;
exports.default = NextModel;
//# sourceMappingURL=next_model.js.map