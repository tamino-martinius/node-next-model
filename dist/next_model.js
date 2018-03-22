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
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
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
var connector_1 = require("./connector");
var util_1 = require("./util");
var pluralize_1 = require("pluralize");
var PropertyNotDefinedError = (function () {
    function PropertyNotDefinedError(name, isStatic, isReadonly) {
        if (isStatic === void 0) { isStatic = true; }
        if (isReadonly === void 0) { isReadonly = true; }
        this.name = 'PropertyNotDefinedError';
        this.message = 'Please define ';
        if (isStatic)
            this.message += 'static ';
        if (isReadonly)
            this.message += 'readonly ';
        this.message += "property '" + name + "' on your model";
    }
    return PropertyNotDefinedError;
}());
exports.PropertyNotDefinedError = PropertyNotDefinedError;
;
var LowerBoundsError = (function () {
    function LowerBoundsError(name, lowerBound) {
        this.name = 'LowerBoundsError';
        this.message = "\n      Property '" + name + "' is expected to be greater or equal to '" + lowerBound + "'\n    ";
    }
    return LowerBoundsError;
}());
exports.LowerBoundsError = LowerBoundsError;
;
var MinLengthError = (function () {
    function MinLengthError(name, minLength) {
        this.name = 'MinLengthError';
        this.message = "\n      Property '" + name + "' length is expected to be longer or equal to '" + minLength + "'\n    ";
    }
    return MinLengthError;
}());
exports.MinLengthError = MinLengthError;
;
var TypeError = (function () {
    function TypeError(name, type) {
        this.name = 'TypeError';
        this.message = "\n      Property '" + name + "' is expected to an '" + type + "'\n    ";
    }
    return TypeError;
}());
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
        Object.defineProperty(Model, "belongsTo", {
            get: function () {
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "hasOne", {
            get: function () {
                return {};
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "hasMany", {
            get: function () {
                return {};
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
        Object.defineProperty(Model, "strictBelongsTo", {
            get: function () {
                var belongsTo = {};
                for (var name_1 in this.belongsTo) {
                    var relation = this.belongsTo[name_1];
                    var model = relation.model;
                    var foreignKey = relation.foreignKey || model.lowerModelName + 'Id';
                    belongsTo[name_1] = {
                        foreignKey: foreignKey,
                        model: relation.model,
                    };
                }
                return belongsTo;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "strictHasOne", {
            get: function () {
                var hasOne = {};
                for (var name_2 in this.hasOne) {
                    var relation = this.hasOne[name_2];
                    var foreignKey = relation.foreignKey || this.lowerModelName + 'Id';
                    hasOne[name_2] = {
                        foreignKey: foreignKey,
                        model: relation.model,
                    };
                }
                return hasOne;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Model, "strictHasMany", {
            get: function () {
                var hasMany = {};
                for (var name_3 in this.hasMany) {
                    var relation = this.hasMany[name_3];
                    var foreignKey = relation.foreignKey || this.lowerModelName + 'Id';
                    hasMany[name_3] = {
                        foreignKey: foreignKey,
                        model: relation.model,
                    };
                }
                return hasMany;
            },
            enumerable: true,
            configurable: true
        });
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
            if (this.filter !== undefined) {
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
                        var filter = Array.isArray(value) ? (_a = {}, _a[key] = value, _a) : { $in: (_b = {}, _b[key] = value, _b) };
                        return _this.query(filter);
                        var _a, _b;
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
                var instances;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.connector.updateAll(this, attrs)];
                        case 1:
                            instances = _a.sent();
                            instances.forEach(function (instance) { return instance.setPersistentAttributes(); });
                            return [2, instances];
                    }
                });
            });
        };
        Model.deleteAll = function () {
            return __awaiter(this, void 0, void 0, function () {
                var instances;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.connector.deleteAll(this)];
                        case 1:
                            instances = _a.sent();
                            instances.forEach(function (instance) { return instance.setPersistentAttributes(); });
                            return [2, instances];
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
                                    limit = batchIndex !== batchCount - 1 ? amount : batchCount * amount - count;
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
                        var filter = Array.isArray(value) ? (_a = {}, _a[key] = value, _a) : { $in: (_b = {}, _b[key] = value, _b) };
                        return _this.find(filter);
                        var _a, _b;
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
                var instance;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
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
                    }
                });
            });
        };
        Model.prototype.delete = function () {
            return __awaiter(this, void 0, void 0, function () {
                var instance;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, this.model.connector.delete(this)];
                        case 1:
                            instance = _a.sent();
                            instance.setPersistentAttributes();
                            return [2, instance];
                    }
                });
            });
        };
        Model.prototype.reload = function () {
            return this.model.limitBy(1).onlyQuery((_a = {}, _a[this.model.identifier] = this.id, _a)).first;
            var _a;
        };
        Model.DEFAULT_LIMIT = Number.MAX_SAFE_INTEGER;
        Model.DEFAULT_SKIP = 0;
        Model = Model_1 = __decorate([
            util_1.staticImplements()
        ], Model);
        return Model;
        var Model_1;
    }());
    ;
    return Model;
}
exports.NextModel = NextModel;
;
exports.default = NextModel;
//# sourceMappingURL=next_model.js.map