"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var __1 = require("..");
var _1 = require(".");
describe('Model', function () {
    var storage = {};
    var tableName = 'foo';
    var init = function () { return ({}); };
    var skip;
    var limit;
    var filter;
    var order;
    var connector = function () { return new __1.MemoryConnector({ storage: storage }); };
    var keys;
    var seed = [
        { id: 1, foo: 'bar', bar: 'baz' },
        { id: 2, foo: null, bar: 'baz' },
        { id: 3, foo: 'bar', bar: null },
    ];
    function withSeededData(tests) {
        _1.context('with seeded data', {
            definitions: function () {
                var _a;
                return (storage = (_a = {},
                    _a[tableName] = seed,
                    _a));
            },
            reset: function () { return (storage = {}); },
            tests: tests,
        });
    }
    function itReturnsClass(subject) {
        _1.it('returns class', function () {
            var Model = subject();
            expect(typeof Model).toEqual('function');
            expect(typeof Model.prototype).toEqual('object');
        });
    }
    var attributesOf = function (items) { return items.map(function (item) { return item.attributes; }); };
    var CreateModel = function () {
        ///@ts-ignore
        return __1.Model({
            tableName: tableName,
            init: init,
            skip: skip,
            limit: limit,
            filter: filter,
            order: order,
            connector: connector(),
            keys: keys,
        });
    };
    var subject = CreateModel;
    itReturnsClass(subject);
    describe('filter parameter', function () {
        withSeededData(function () {
            describe('when testing query results', function () {
                var subject = function () { return CreateModel().all(); };
                _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var instances;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                instances = _a.sent();
                                expect(attributesOf(instances)).toEqual(seed);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('without filter', {
                    definitions: function () { return (filter = undefined); },
                    reset: function () { return (filter = undefined); },
                    tests: function () {
                        _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expect(attributesOf(instances)).toEqual(seed);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
                _1.context('with filter', {
                    definitions: function () { return (filter = { foo: 'bar' }); },
                    reset: function () { return (filter = undefined); },
                    tests: function () {
                        _1.it('uses filter', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances, expectedItems;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expectedItems = seed.filter(function (item) { return item.foo === 'bar'; });
                                        expect(attributesOf(instances)).toEqual(expectedItems);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        describe('when additional filter is present', function () {
                            var subject = function () {
                                return CreateModel()
                                    .filterBy({ bar: 'baz' })
                                    .all();
                            };
                            _1.it('uses intersection of both filters', function () { return __awaiter(void 0, void 0, void 0, function () {
                                var instances, expectedItems;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, subject()];
                                        case 1:
                                            instances = _a.sent();
                                            expectedItems = seed.filter(function (item) { return item.foo === 'bar' && item.bar === 'baz'; });
                                            expect(attributesOf(instances)).toEqual(expectedItems);
                                            return [2 /*return*/];
                                    }
                                });
                            }); });
                        });
                    },
                });
            });
        });
    });
    describe('.filterBy', function () {
        var filter = {};
        var subject = function () { return CreateModel().filterBy(filter); };
        itReturnsClass(subject);
        withSeededData(function () {
            describe('when testing query results', function () {
                var subject = function () {
                    return CreateModel()
                        .filterBy(filter)
                        .all();
                };
                _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var instances;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                instances = _a.sent();
                                expect(attributesOf(instances)).toEqual(seed);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('with filter', {
                    definitions: function () { return (filter = { foo: 'bar' }); },
                    reset: function () { return (filter = {}); },
                    tests: function () {
                        _1.it('uses filter', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances, expectedItems;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expectedItems = seed.filter(function (item) { return item.foo === 'bar'; });
                                        expect(attributesOf(instances)).toEqual(expectedItems);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        describe('when additional filter is present', function () {
                            var subject = function () {
                                return CreateModel()
                                    .filterBy(filter)
                                    .filterBy({ bar: 'baz' })
                                    .all();
                            };
                            _1.it('uses intersection of both filters', function () { return __awaiter(void 0, void 0, void 0, function () {
                                var instances, expectedItems;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, subject()];
                                        case 1:
                                            instances = _a.sent();
                                            expectedItems = seed.filter(function (item) { return item.foo === 'bar' && item.bar === 'baz'; });
                                            expect(attributesOf(instances)).toEqual(expectedItems);
                                            return [2 /*return*/];
                                    }
                                });
                            }); });
                        });
                    },
                });
            });
        });
    });
    describe('.orFilterBy', function () {
        var filter = {};
        var subject = function () { return CreateModel().orFilterBy(filter); };
        itReturnsClass(subject);
        withSeededData(function () {
            describe('when testing query results', function () {
                var subject = function () {
                    return CreateModel()
                        .orFilterBy(filter)
                        .all();
                };
                _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var instances;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                instances = _a.sent();
                                expect(attributesOf(instances)).toEqual(seed);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('with filter', {
                    definitions: function () { return (filter = { id: 1 }); },
                    reset: function () { return (filter = {}); },
                    tests: function () {
                        _1.it('uses filter', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances, expectedItems;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expectedItems = seed.filter(function (item) { return item.id === 1; });
                                        expect(attributesOf(instances)).toEqual(expectedItems);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        describe('when additional filter is present', function () {
                            var subject = function () {
                                return CreateModel()
                                    .orFilterBy(filter)
                                    .orFilterBy({ id: 2 })
                                    .all();
                            };
                            _1.it('uses union of both filters', function () { return __awaiter(void 0, void 0, void 0, function () {
                                var instances, expectedItems;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, subject()];
                                        case 1:
                                            instances = _a.sent();
                                            expectedItems = seed.filter(function (item) { return item.id === 1 || item.id === 2; });
                                            expect(attributesOf(instances)).toEqual(expectedItems);
                                            return [2 /*return*/];
                                    }
                                });
                            }); });
                        });
                    },
                });
            });
        });
    });
    describe('.unfiltered', function () {
        var subject = function () { return CreateModel().unfiltered(); };
        itReturnsClass(subject);
        withSeededData(function () {
            describe('when testing query results', function () {
                var subject = function () {
                    return CreateModel()
                        .unfiltered()
                        .all();
                };
                _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var instances;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                instances = _a.sent();
                                expect(attributesOf(instances)).toEqual(seed);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('with filter', {
                    definitions: function () { return (filter = { id: 1 }); },
                    reset: function () { return (filter = {}); },
                    tests: function () {
                        _1.it('resets filter', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expect(attributesOf(instances)).toEqual(seed);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
            });
        });
    });
    describe('.limitBy', function () {
        var limit = Number.MAX_SAFE_INTEGER;
        var subject = function () { return CreateModel().limitBy(limit); };
        itReturnsClass(subject);
        withSeededData(function () {
            describe('when testing query results', function () {
                var subject = function () {
                    return CreateModel()
                        .limitBy(limit)
                        .all();
                };
                _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var instances;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                instances = _a.sent();
                                expect(attributesOf(instances)).toEqual(seed);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('with filter', {
                    definitions: function () { return (filter = { foo: 'bar' }); },
                    reset: function () { return (filter = {}); },
                    tests: function () {
                        _1.it('uses filter', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances, expectedItems;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expectedItems = seed.filter(function (item) { return item.foo === 'bar'; });
                                        expect(attributesOf(instances)).toEqual(expectedItems);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        _1.context('limit lower then expected count', {
                            definitions: function () { return (limit = 1); },
                            reset: function () { return (limit = Number.MAX_SAFE_INTEGER); },
                            tests: function () {
                                _1.it('limits returned results', function () { return __awaiter(void 0, void 0, void 0, function () {
                                    var instances, expectedItems;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, subject()];
                                            case 1:
                                                instances = _a.sent();
                                                expectedItems = seed.filter(function (item) { return item.foo === 'bar'; }).splice(0, 1);
                                                expect(attributesOf(instances)).toEqual(expectedItems);
                                                return [2 /*return*/];
                                        }
                                    });
                                }); });
                            },
                        });
                    },
                });
            });
        });
    });
    describe('.unlimited', function () {
        var subject = function () { return CreateModel().unlimited(); };
        itReturnsClass(subject);
        withSeededData(function () {
            describe('when testing query results', function () {
                var subject = function () {
                    return CreateModel()
                        .unlimited()
                        .all();
                };
                _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var instances;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                instances = _a.sent();
                                expect(attributesOf(instances)).toEqual(seed);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('with limit', {
                    definitions: function () { return (limit = 1); },
                    reset: function () { return (limit = undefined); },
                    tests: function () {
                        _1.it('resets limit', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expect(attributesOf(instances)).toEqual(seed);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
            });
        });
    });
    describe('.skipBy', function () {
        var skip = 0;
        var subject = function () { return CreateModel().skipBy(skip); };
        itReturnsClass(subject);
        withSeededData(function () {
            describe('when testing query results', function () {
                var subject = function () {
                    return CreateModel()
                        .skipBy(skip)
                        .all();
                };
                _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var instances;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                instances = _a.sent();
                                expect(attributesOf(instances)).toEqual(seed);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('with filter', {
                    definitions: function () { return (filter = { foo: 'bar' }); },
                    reset: function () { return (filter = {}); },
                    tests: function () {
                        _1.it('uses filter', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances, expectedItems;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expectedItems = seed.filter(function (item) { return item.foo === 'bar'; });
                                        expect(attributesOf(instances)).toEqual(expectedItems);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        _1.context('skip lower then expected count', {
                            definitions: function () { return (skip = 1); },
                            reset: function () { return (skip = 1); },
                            tests: function () {
                                _1.it('skips returned results', function () { return __awaiter(void 0, void 0, void 0, function () {
                                    var instances, expectedItems;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, subject()];
                                            case 1:
                                                instances = _a.sent();
                                                expectedItems = seed.filter(function (item) { return item.foo === 'bar'; }).splice(1, 1);
                                                expect(attributesOf(instances)).toEqual(expectedItems);
                                                return [2 /*return*/];
                                        }
                                    });
                                }); });
                            },
                        });
                    },
                });
            });
        });
    });
    describe('.unskipped', function () {
        var subject = function () { return CreateModel().unskipped(); };
        itReturnsClass(subject);
        withSeededData(function () {
            describe('when testing query results', function () {
                var subject = function () {
                    return CreateModel()
                        .unskipped()
                        .all();
                };
                _1.it('promises to return all matching items as model instances', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var instances;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, subject()];
                            case 1:
                                instances = _a.sent();
                                expect(attributesOf(instances)).toEqual(seed);
                                return [2 /*return*/];
                        }
                    });
                }); });
                _1.context('with skip', {
                    definitions: function () { return (skip = 1); },
                    reset: function () { return (skip = undefined); },
                    tests: function () {
                        _1.it('resets skip', function () { return __awaiter(void 0, void 0, void 0, function () {
                            var instances;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, subject()];
                                    case 1:
                                        instances = _a.sent();
                                        expect(attributesOf(instances)).toEqual(seed);
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                    },
                });
            });
        });
    });
    // describe('.order', () => {
    //   let Klass: typeof Model;
    //   let order: Partial<Order<any>>[] = Faker.order;
    //   const subject = () => Klass.order;
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array by default', () => {
    //         expect(subject()).toEqual([]);
    //       });
    //       context('when order is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get order(): Partial<Order<any>>[] {
    //               return order;
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('returns the name of the model', () => {
    //             expect(subject()).toEqual(order);
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.keys', () => {
    //   let Klass: typeof Model;
    //   let schema: Schema<any> = Faker.schema;
    //   const subject = () => Klass.keys;
    //   context('schema is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('throws Error', () => {
    //         expect(subject).toThrow(Error); // TODO: Check for PropertyNotDefinedError
    //       });
    //       context('when schema is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get schema(): Schema<any> {
    //               return schema;
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('returns the schema keys of the model', () => {
    //             expect(subject()).toEqual(Object.keys(schema));
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // //#endregion
    // //#region Relations
    // pending('.relations');
    // describe('.validators', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let validators: Validator<any>[] = Faker.validators;
    //   const subject = () => Klass.validators;
    //   it('returns empty validators', () => {
    //     expect(subject()).toEqual([]);
    //   });
    //   context('when validators is present', {
    //     definitions() {
    //       class NewKlass extends Klass {
    //         static get validators(): Validator<any>[] {
    //           return validators;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns the validators of the model', () => {
    //         expect(subject()).toEqual(validators);
    //       });
    //     },
    //   });
    // });
    // //#endregion
    // //#region Strict
    // describe('.strictSchema', () => {
    //   let Klass: typeof Model;
    //   let schema: Schema<any> = Faker.schema;
    //   const subject = () => Klass.strictSchema;
    //   context('schema is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('throws Error', () => {
    //         expect(subject).toThrow(Error); // TODO: Check for PropertyNotDefinedError
    //       });
    //       context('when schema is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get schema(): Schema<any> {
    //               return schema;
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('returns the schema with filled properties', () => {
    //             expect(subject()).toEqual(schema);
    //             for (const key in schema) {
    //               expect('defaultValue' in subject()[key]).toBeTruthy();
    //             }
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // pending('.strictRelations');
    // describe('.strictFilter', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let filter: Filter<any> = Faker.filter;
    //   const subject = () => Klass.strictFilter;
    //   it('returns empty filter', () => {
    //     expect(subject()).toEqual({});
    //   });
    //   context('when filter is present', {
    //     definitions() {
    //       class NewKlass extends Klass {
    //         static get filter(): Filter<any> {
    //           return filter;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns the strict filter of the model', () => {
    //         expect(subject()).toEqual(filter);
    //       });
    //     },
    //   });
    // });
    // //#endregion
    // //#region Queries
    // describe('.limitBy(amount)', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let limit: number = Faker.limit;
    //   const subject = () => Klass.limitBy(limit);
    //   it('changes limit for new scope and keeps old scope unchanged', () => {
    //     expect(subject().limit).toEqual(limit);
    //     expect(Klass.limit).toEqual(Number.MAX_SAFE_INTEGER);
    //   });
    // });
    // describe('.unlimited', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let limit: number = Faker.limit;
    //   const subject = () => Klass.unlimited;
    //   it('changes limit to default', () => {
    //     expect(subject().limit).toEqual(Number.MAX_SAFE_INTEGER);
    //     expect(Klass.limit).toEqual(Number.MAX_SAFE_INTEGER);
    //   });
    //   context('when limit is present', {
    //     definitions() {
    //       class NewKlass extends Klass {
    //         static get limit(): number {
    //           return limit;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('changes limit for new scope and keeps old scope unchanged', () => {
    //         expect(subject().limit).toEqual(Number.MAX_SAFE_INTEGER);
    //         expect(Klass.limit).toEqual(limit);
    //       });
    //     },
    //   });
    // });
    // describe('.skipBy(amount)', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let skip: number = Faker.skip;
    //   const subject = () => Klass.skipBy(skip);
    //   it('changes skip for new scope and keeps old scope unchanged', () => {
    //     expect(subject().skip).toEqual(skip);
    //     expect(Klass.skip).toEqual(0);
    //   });
    // });
    // describe('.unskipped', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let skip: number = Faker.skip;
    //   const subject = () => Klass.unskipped;
    //   it('changes skip to default', () => {
    //     expect(subject().skip).toEqual(0);
    //     expect(Klass.skip).toEqual(0);
    //   });
    //   context('when skip is present', {
    //     definitions() {
    //       class NewKlass extends Klass {
    //         static get skip(): number {
    //           return skip;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('changes skip for new scope and keeps old scope unchanged', () => {
    //         expect(subject().skip).toEqual(0);
    //         expect(Klass.skip).toEqual(skip);
    //       });
    //     },
    //   });
    // });
    // describe('.orderBy(order)', () => {
    //   let Klass: typeof Model;
    //   let order: Partial<Order<any>>[] = Faker.order;
    //   let orderItem: Order<any> = { [Faker.name]: Faker.orderDirection };
    //   const subject = () => Klass.orderBy(orderItem);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns order item as array', () => {
    //         expect(subject().order).toEqual([orderItem]);
    //       });
    //       context('when order is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get order(): Partial<Order<any>>[] {
    //               return order;
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('adds order item to existing order', () => {
    //             expect(subject().order).toEqual([...order, orderItem]);
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.reorder(order)', () => {
    //   let Klass: typeof Model;
    //   let order: Partial<Order<any>>[] = Faker.order;
    //   let orderItem: Order<any> = { [Faker.name]: Faker.orderDirection };
    //   const subject = () => Klass.reorder(orderItem);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns order item as array', () => {
    //         expect(subject().order).toEqual([orderItem]);
    //       });
    //       context('when order is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get order(): Partial<Order<any>>[] {
    //               return order;
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('removes current order and returns order item as array', () => {
    //             expect(subject().order).toEqual([orderItem]);
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.unordered', () => {
    //   let Klass: typeof Model;
    //   let order: Partial<Order<any>>[] = Faker.order;
    //   const subject = () => Klass.unordered;
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty order', () => {
    //         expect(subject().order).toEqual([]);
    //       });
    //       context('when order is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get order(): Partial<Order<any>>[] {
    //               return order;
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('returns empty order', () => {
    //             expect(subject().order).toEqual([]);
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.query(filter)', () => {
    //   let Klass: typeof Model;
    //   let filter: Filter<any> = Faker.filter;
    //   const subject = () => Klass.query(filter);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('sets filter and returns model', () => {
    //         expect(subject().filter).toEqual(filter);
    //       });
    //       context('when filter is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get filter(): Filter<any> {
    //               return { id: 1 };
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('adds filter to existing filter and returns model', () => {
    //             expect(subject().filter).toEqual({ $and: [
    //               filter,
    //               { id: 1 },
    //             ]});
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.onlyQuery(filter)', () => {
    //   let Klass: typeof Model;
    //   let filter: Filter<any> = Faker.filter;
    //   const subject = () => Klass.onlyQuery(filter);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('sets filter and returns model', () => {
    //         expect(subject().filter).toEqual(filter);
    //       });
    //       context('when filter is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get filter(): Filter<any> {
    //               return { id: 1 };
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('sets filter and returns model', () => {
    //             expect(subject().filter).toEqual(filter);
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.queryBy', () => {
    //   let Klass: typeof Model;
    //   let ids: number | number[] = 2;
    //   const subject = () => Klass.queryBy.id(ids);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('sets filter and returns model', () => {
    //         expect(subject().filter).toEqual({ id: 2 });
    //       });
    //       context('when filter is present', {
    //         definitions() {
    //           class NewKlass extends Klass {
    //             static get filter(): Filter<any> {
    //               return { id: 1 };
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('adds filter to existing filter and returns model', () => {
    //             expect(subject().filter).toEqual({
    //               $and: [
    //                 { id: 2 },
    //                 { id: 1 },
    //               ]
    //             });
    //           });
    //         },
    //       });
    //     },
    //   });
    //   context('when passing array of values', {
    //     definitions() {
    //       ids = [1, 2]
    //     },
    //     tests() {
    //       context('model is not extended', {
    //         definitions() {
    //           class NewKlass extends Faker.model { };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('sets filter and returns model', () => {
    //             expect(subject().filter).toEqual({ $in: { id: [1, 2] } });
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 1 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('adds filter to existing filter and returns model', () => {
    //                 expect(subject().filter).toEqual({
    //                   $and: [
    //                     { $in: { id: [1, 2] } },
    //                     { id: 1 },
    //                   ]
    //                 });
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.unfiltered', () => {
    //   let Klass: typeof Model;
    //   const subject = () => Klass.unfiltered;
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends NextModel<any>() { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('sets filter to empty and returns model', () => {
    //         expect(subject().filter).toEqual({});
    //       });
    //       context('when filter is present', {
    //         definitions() {
    //           class NewKlass extends NextModel<any>() {
    //             static get filter(): Filter<any> {
    //               return { id: 1 };
    //             }
    //           };
    //           Klass = NewKlass;
    //         },
    //         tests() {
    //           it('sets filter to empty and returns model', () => {
    //             expect(subject().filter).toEqual({});
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.all', () => {
    //   let Klass: typeof Model;
    //   let connector: Connector<any> = Faker.connector;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => Klass.all;
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {
    //         static get connector() {
    //           return connector;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array', async () => {
    //         const data = await subject();
    //         expect(data).toEqual([]);
    //       });
    //       context('when data is present', {
    //         async definitions() {
    //           instance = await Klass.create({});
    //         },
    //         tests() {
    //           it('calls connector with model', async () => {
    //             const data = await subject();
    //             const attrArr = data.map(instance => instance.attributes);
    //             expect(attrArr).toEqual([instance.attributes]);
    //             expect(data[0]).toBeInstanceOf(Klass);
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 0 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('filters data', async () => {
    //                 const data = await subject();
    //                 expect(data).toEqual([]);
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // pending('.pluck');
    // pending('.select');
    // describe('.updateAll(attrs)', () => {
    //   let Klass: typeof Model;
    //   let connector: Connector<any> = Faker.connector;
    //   const attrs = { test: 1 };
    //   let instance: ModelConstructor<any>;
    //   const subject = () => Klass.updateAll(attrs);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {
    //         static get schema() {
    //           const schema = super.schema;
    //           schema.test = { type: DataType.string };
    //           return schema;
    //         }
    //         static get connector() {
    //           return connector;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array', async () => {
    //         const model = await subject();
    //         const data = await model.all;
    //         expect(data).toEqual([]);
    //       });
    //       context('when data is present', {
    //         async definitions() {
    //           instance = await Klass.create({});
    //         },
    //         tests() {
    //           it('calls connector with model', async () => {
    //             const model = await subject();
    //             const data = await model.all;
    //             const attrArr = data.map(instance => instance.attributes);
    //             const attributes = instance.attributes;
    //             attributes.test = 1;
    //             expect(attrArr).toEqual([attributes]);
    //             expect(data[0]).toBeInstanceOf(Klass);
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 0 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('filters data', async () => {
    //                 const model = await subject();
    //                 const data = await model.all;
    //                 expect(data).toEqual([]);
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.deleteAll()', () => {
    //   let Klass: typeof Model;
    //   let connector: Connector<any> = Faker.connector;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => Klass.deleteAll();
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {
    //         static get connector() {
    //           return connector;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array', async () => {
    //         const model = await subject();
    //         const data = await model.all;
    //         expect(data).toEqual([]);
    //       });
    //       context('when data is present', {
    //         async definitions() {
    //           instance = await Klass.create({});
    //         },
    //         tests() {
    //           it('calls connector with model', async () => {
    //             const model = await subject();
    //             const data = await model.all;
    //             expect(data).toEqual([]);
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 0 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('filters data', async () => {
    //                 const model = await subject();
    //                 const data = await model.all;
    //                 expect(data).toEqual([]);
    //                 const allData = await Klass.unfiltered.all;
    //                 expect(allData.map(instance => instance.attributes))
    //                   .toEqual([instance.attributes]);
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.inBatchesOf(amount)', () => {
    //   let Klass: typeof Model;
    //   let connector: Connector<any> = Faker.connector;
    //   let instance1: ModelConstructor<any>;
    //   let instance2: ModelConstructor<any>;
    //   let amount = 1;
    //   const subject = () => Klass.inBatchesOf(amount);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {
    //         static get connector() {
    //           return connector;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array', async () => {
    //         const dataPromises = await subject();
    //         const datas = await Promise.all(dataPromises);
    //         expect(datas).toEqual([]);
    //       });
    //       context('when data is present', {
    //         async definitions() {
    //           instance1 = await Klass.create({});
    //         },
    //         tests() {
    //           it('calls connector with model', async () => {
    //             const dataPromises = await subject();
    //             const datas = await Promise.all(dataPromises);
    //             expect(datas.length).toEqual(1);
    //             const attrArr = datas[0].map(instance => instance.attributes);
    //             expect(attrArr).toEqual([instance1.attributes]);
    //             expect(datas[0][0]).toBeInstanceOf(Klass);
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 0 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('filters data', async () => {
    //                 const dataPromises = await subject();
    //                 const datas = await Promise.all(dataPromises);
    //                 expect(datas).toEqual([]);
    //               });
    //             },
    //           });
    //           context('when multiple data', {
    //             async definitions() {
    //               instance2 = await Klass.create({});
    //             },
    //             tests() {
    //               it('calls connector with model', async () => {
    //                 const dataPromises = await subject();
    //                 const datas = await Promise.all(dataPromises);
    //                 expect(datas.length).toEqual(2);
    //                 const attrArr1 = datas[0].map(instance => instance.attributes);
    //                 expect(attrArr1).toEqual([instance1.attributes]);
    //                 const attrArr2 = datas[1].map(instance => instance.attributes);
    //                 expect(attrArr2).toEqual([instance2.attributes]);
    //                 expect(datas[0][0]).toBeInstanceOf(Klass);
    //                 expect(datas[1][0]).toBeInstanceOf(Klass);
    //               });
    //               context('when amount is 2', {
    //                 definitions() {
    //                   amount = 2;
    //                 },
    //                 tests() {
    //                   it('filters data', async () => {
    //                     const dataPromises = await subject();
    //                     const datas = await Promise.all(dataPromises);
    //                     expect(datas.length).toEqual(1);
    //                     expect(datas[0].length).toEqual(2);
    //                     const attrArr = datas[0].map(instance => instance.attributes);
    //                     expect(attrArr).toEqual([
    //                       instance1.attributes,
    //                       instance2.attributes,
    //                     ]);
    //                     expect(datas[0][0]).toBeInstanceOf(Klass);
    //                     expect(datas[0][1]).toBeInstanceOf(Klass);
    //                   });
    //                 },
    //               });
    //               context('when filter is present', {
    //                 definitions() {
    //                   class NewKlass extends Klass {
    //                     static get filter(): Filter<any> {
    //                       return { id: 0 };
    //                     }
    //                   };
    //                   Klass = NewKlass;
    //                 },
    //                 tests() {
    //                   it('filters data', async () => {
    //                     const dataPromises = await subject();
    //                     const datas = await Promise.all(dataPromises);
    //                     expect(datas).toEqual([]);
    //                   });
    //                 },
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.first', () => {
    //   let Klass: typeof Model;
    //   let connector: Connector<any> = Faker.connector;
    //   let instance1: ModelConstructor<any>;
    //   let instance2: ModelConstructor<any>;
    //   const subject = () => Klass.first;
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {
    //         static get connector() {
    //           return connector;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array', async () => {
    //         const instance = await subject();
    //         expect(instance).toBeUndefined();
    //       });
    //       context('when data is present', {
    //         async definitions() {
    //           instance1 = await Klass.create({});
    //         },
    //         tests() {
    //           it('calls connector with model', async () => {
    //             const instance = await subject();
    //             expect(instance.attributes).toEqual(instance1.attributes);
    //             expect(instance).toBeInstanceOf(Klass);
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 0 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('filters data', async () => {
    //                 const instance = await subject();
    //                 expect(instance).toBeUndefined();
    //               });
    //             },
    //           });
    //           context('when multiple data', {
    //             async definitions() {
    //               instance2 = await Klass.create({});
    //             },
    //             tests() {
    //               it('calls connector with model', async () => {
    //                 const instance = await subject();
    //                 expect(instance.attributes).toEqual(instance1.attributes);
    //                 expect(instance).toBeInstanceOf(Klass);
    //               });
    //               context('when filter is present', {
    //                 definitions() {
    //                   class NewKlass extends Klass {
    //                     static get filter(): Filter<any> {
    //                       return { id: 0 };
    //                     }
    //                   };
    //                   Klass = NewKlass;
    //                 },
    //                 tests() {
    //                   it('filters data', async () => {
    //                     const instance = await subject();
    //                     expect(instance).toBeUndefined();
    //                   });
    //                 },
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.find(query)', () => {
    //   let Klass: typeof Model;
    //   let connector: Connector<any> = Faker.connector;
    //   let instance1: ModelConstructor<any>;
    //   let instance2: ModelConstructor<any>;
    //   let query = {};
    //   const subject = () => Klass.find(query);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {
    //         static get connector() {
    //           return connector;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array', async () => {
    //         const instance = await subject();
    //         expect(instance).toBeUndefined();
    //       });
    //       context('when data is present', {
    //         async definitions() {
    //           instance1 = await Klass.create({});
    //         },
    //         tests() {
    //           it('calls connector with model', async () => {
    //             const instance = await subject();
    //             expect(instance.attributes).toEqual(instance1.attributes);
    //             expect(instance).toBeInstanceOf(Klass);
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 0 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('filters data', async () => {
    //                 const instance = await subject();
    //                 expect(instance).toBeUndefined();
    //               });
    //             },
    //           });
    //           context('when multiple data', {
    //             async definitions() {
    //               instance2 = await Klass.create({});
    //             },
    //             tests() {
    //               it('calls connector with model', async () => {
    //                 const instance = await subject();
    //                 expect(instance.attributes).toEqual(instance1.attributes);
    //                 expect(instance).toBeInstanceOf(Klass);
    //               });
    //               context('when non matching filter is present', {
    //                 definitions() {
    //                   class NewKlass extends Klass {
    //                     static get filter(): Filter<any> {
    //                       return { id: 0 };
    //                     }
    //                   };
    //                   Klass = NewKlass;
    //                 },
    //                 tests() {
    //                   it('filters data', async () => {
    //                     const instance = await subject();
    //                     expect(instance).toBeUndefined();
    //                   });
    //                 },
    //               });
    //               context('when matching filter is present', {
    //                 definitions() {
    //                   class NewKlass extends Klass {
    //                     static get filter(): Filter<any> {
    //                       return { id: instance2.id };
    //                     }
    //                   };
    //                   Klass = NewKlass;
    //                 },
    //                 tests() {
    //                   it('filters data', async () => {
    //                     const instance = await subject();
    //                     expect(instance.attributes).toEqual(instance2.attributes);
    //                     expect(instance).toBeInstanceOf(Klass);
    //                   });
    //                   context('when query is present', {
    //                     definitions() {
    //                       query = { id: 0 };
    //                     },
    //                     tests() {
    //                       it('filters data', async () => {
    //                         const instance = await subject();
    //                         expect(instance).toBeUndefined();
    //                       });
    //                     },
    //                   });
    //                 },
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.findBy', () => {
    //   let Klass: typeof Model;
    //   let connector: Connector<any> = Faker.connector;
    //   let instance1: ModelConstructor<any>;
    //   let instance2: ModelConstructor<any>;
    //   let query = () => instance1 ? instance1.id : 0;
    //   const subject = () => Klass.findBy.id(query());
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {
    //         static get connector() {
    //           return connector;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array', async () => {
    //         const instance = await subject();
    //         expect(instance).toBeUndefined();
    //       });
    //       context('when data is present', {
    //         async definitions() {
    //           instance1 = await Klass.create({});
    //         },
    //         tests() {
    //           it('calls connector with model', async () => {
    //             const instance = await subject();
    //             expect(instance.attributes).toEqual(instance1.attributes);
    //             expect(instance).toBeInstanceOf(Klass);
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 0 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('filters data', async () => {
    //                 const instance = await subject();
    //                 expect(instance).toBeUndefined();
    //               });
    //             },
    //           });
    //           context('when multiple data', {
    //             async definitions() {
    //               instance2 = await Klass.create({});
    //             },
    //             tests() {
    //               it('calls connector with model', async () => {
    //                 const instance = await subject();
    //                 expect(instance.attributes).toEqual(instance1.attributes);
    //                 expect(instance).toBeInstanceOf(Klass);
    //               });
    //               context('when filter is present', {
    //                 definitions() {
    //                   class NewKlass extends Klass {
    //                     static get filter(): Filter<any> {
    //                       return { id: instance2.id };
    //                     }
    //                   };
    //                   Klass = NewKlass;
    //                 },
    //                 tests() {
    //                   it('filters data', async () => {
    //                     const instance = await subject();
    //                     expect(instance).toBeUndefined();
    //                   });
    //                 },
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.count', () => {
    //   let Klass: typeof Model;
    //   let connector: Connector<any> = Faker.connector;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => Klass.count;
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {
    //         static get connector() {
    //           return connector;
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns empty array', async () => {
    //         const count = await subject();
    //         expect(count).toEqual(0);
    //       });
    //       context('when data is present', {
    //         async definitions() {
    //           instance = await Klass.create({});
    //         },
    //         tests() {
    //           it('calls connector with model', async () => {
    //             const count = await subject();
    //             expect(count).toEqual(1);
    //           });
    //           context('when filter is present', {
    //             definitions() {
    //               class NewKlass extends Klass {
    //                 static get filter(): Filter<any> {
    //                   return { id: 0 };
    //                 }
    //               };
    //               Klass = NewKlass;
    //             },
    //             tests() {
    //               it('filters data', async () => {
    //                 const count = await subject();
    //                 expect(count).toEqual(0);
    //               });
    //             },
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // //#endregion
    // //#region Creating Instances
    // describe('.new(attrs)', () => {
    //   let Klass: typeof Model;
    //   let attrs = {};
    //   const subject = () => new Klass(attrs);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model {};
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns instance', () => {
    //         const instance = subject();
    //         expect(instance.attributes).toEqual(attrs);
    //         expect(instance).toBeInstanceOf(Klass);
    //       });
    //       context('when attributes are set', {
    //         definitions() {
    //           attrs = { id: 1 };
    //         },
    //         tests() {
    //           it('sets attributes', () => {
    //             const instance = subject();
    //             expect(instance.attributes).toEqual(attrs);
    //             expect(instance).toBeInstanceOf(Klass);
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.build(attrs)', () => {
    //   let Klass: typeof Model;
    //   let attrs = {};
    //   const subject = () => Klass.build(attrs);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns instance', () => {
    //         const instance = subject();
    //         expect(instance.attributes).toEqual(attrs);
    //         expect(instance).toBeInstanceOf(Klass);
    //       });
    //       context('when attributes are set', {
    //         definitions() {
    //           attrs = { id: 1 };
    //         },
    //         tests() {
    //           it('sets attributes', () => {
    //             const instance = subject();
    //             expect(instance.attributes).toEqual(attrs);
    //             expect(instance).toBeInstanceOf(Klass);
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('.create(attrs)', () => {
    //   let Klass: typeof Model;
    //   let attrs = {};
    //   const subject = () => Klass.create(attrs);
    //   context('model is not extended', {
    //     definitions() {
    //       class NewKlass extends Faker.model { };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns instance', async () => {
    //         const instance = await subject();
    //         expect(instance.id).toBeDefined()
    //         expect(instance).toBeInstanceOf(Klass);
    //         expect(await Klass.count).toEqual(1);
    //       });
    //       context('when attributes are set', {
    //         definitions() {
    //           attrs = { [Object.keys(Klass.schema)[0]]: 'foo' };
    //         },
    //         tests() {
    //           it('sets attributes', async () => {
    //             const instance = await subject();
    //             const key = Object.keys(Klass.schema)[0];
    //             expect(instance.attributes[key]).toEqual('foo');
    //             expect(instance).toBeInstanceOf(Klass);
    //             expect(await Klass.count).toEqual(1);
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // //#endregion
    // //#endregion
    // //#region Instance
    // //#region Properites
    // describe('#id', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.id;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build({});
    //     },
    //     tests() {
    //       it('returns undefined', async () => {
    //         expect(subject()).toBeUndefined();
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create({});
    //     },
    //     tests() {
    //       it('returns identifier', async () => {
    //         expect(subject()).toBeDefined();
    //       });
    //     },
    //   });
    // });
    // describe('#model', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.model;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build({});
    //     },
    //     tests() {
    //       it('returns model of instance', async () => {
    //         expect(subject()).toBe(Klass);
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create({});
    //     },
    //     tests() {
    //       it('returns model of instance', async () => {
    //         expect(subject()).toBe(Klass);
    //       });
    //     },
    //   });
    // });
    // describe('#attributes', () => {
    //   let attrs: any = {};
    //   let key: string = 'foo';
    //   let Klass: typeof Model = class NewKlass extends Faker.model {
    //     static get schema() {
    //       const schema = super.schema;
    //       schema[key] = { type: DataType.string };
    //       return schema;
    //     }
    //   };
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.attributes;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build(attrs);
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual(attrs);
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create(attrs);
    //       attrs.id = instance.id;
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual(attrs);
    //       });
    //     },
    //   });
    //   context('when attributes have key which is not at schema', {
    //     async definitions() {
    //       attrs = { notInSchema: 'foo' };
    //     },
    //     tests() {
    //       context('when instance is build', {
    //         definitions() {
    //           instance = Klass.build(attrs);
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject().notInSchema).toBeUndefined();
    //           });
    //         },
    //       });
    //       context('when instance is created', {
    //         async definitions() {
    //           instance = await Klass.create(attrs);
    //           attrs.id = instance.id;
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject().notInSchema).toBeUndefined();
    //           });
    //         },
    //       });
    //     },
    //   });
    //   context('when attributes have key which is present at schema', {
    //     async definitions() {
    //       attrs = { [key]: 'foo' };
    //     },
    //     tests() {
    //       context('when instance is build', {
    //         definitions() {
    //           instance = Klass.build(attrs);
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject()[key]).toEqual('foo');
    //           });
    //         },
    //       });
    //       context('when instance is created', {
    //         async definitions() {
    //           instance = await Klass.create(attrs);
    //           attrs.id = instance.id;
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject()[key]).toEqual('foo');
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('#persistentAttributes', () => {
    //   let attrs: any = {};
    //   let key: string = 'foo';
    //   let Klass: typeof Model = class NewKlass extends Faker.model {
    //     static get schema() {
    //       const schema = super.schema;
    //       schema[key] = { type: DataType.string };
    //       return schema;
    //     }
    //   };
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.persistentAttributes;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build(attrs);
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual(attrs);
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create(attrs);
    //       attrs.id = instance.id;
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual(attrs);
    //       });
    //     },
    //   });
    //   context('when attributes have key which is not at schema', {
    //     async definitions() {
    //       attrs = { notInSchema: 'foo' };
    //     },
    //     tests() {
    //       context('when instance is build', {
    //         definitions() {
    //           instance = Klass.build(attrs);
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject().notInSchema).toBeUndefined();
    //           });
    //         },
    //       });
    //       context('when instance is created', {
    //         async definitions() {
    //           instance = await Klass.create(attrs);
    //           attrs.id = instance.id;
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject().notInSchema).toBeUndefined();
    //           });
    //         },
    //       });
    //     },
    //   });
    //   context('when attributes have key which is present at schema', {
    //     async definitions() {
    //       attrs = { [key]: 'foo' };
    //     },
    //     tests() {
    //       context('when instance is build', {
    //         definitions() {
    //           instance = Klass.build(attrs);
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject()[key]).toBeUndefined();
    //           });
    //         },
    //       });
    //       context('when instance is created', {
    //         async definitions() {
    //           instance = await Klass.create(attrs);
    //           attrs.id = instance.id;
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject()[key]).toEqual('foo');
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('#isNew', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.isNew;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build({});
    //     },
    //     tests() {
    //       it('returns undefined', async () => {
    //         expect(subject()).toBeTruthy();
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create({});
    //     },
    //     tests() {
    //       it('returns identifier', async () => {
    //         expect(subject()).toBeFalsy();
    //       });
    //     },
    //   });
    // });
    // describe('#isPersistent', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.isPersistent;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build({});
    //     },
    //     tests() {
    //       it('returns undefined', async () => {
    //         expect(subject()).toBeFalsy();
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create({});
    //     },
    //     tests() {
    //       it('returns identifier', async () => {
    //         expect(subject()).toBeTruthy();
    //       });
    //     },
    //   });
    // });
    // describe('#isChanged', () => {
    //   let key: string = 'foo';
    //   let attrs: any = { [key]: 'bar' };
    //   let Klass: typeof Model = class NewKlass extends Faker.model {
    //     static get schema() {
    //       const schema = super.schema;
    //       schema[key] = { type: DataType.string };
    //       return schema;
    //     }
    //   };
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.isChanged;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build(attrs);
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toBeTruthy();
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create(attrs);
    //       attrs.id = instance.id;
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toBeFalsy();
    //       });
    //     },
    //   });
    // });
    // describe('#isValid', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let trueValidator: Validator<any> = (instance) => Promise.resolve(true);
    //   let falseValidator: Validator<any> = (instance) => Promise.resolve(false);
    //   const subject = () => Klass.build({}).isValid;
    //   it('returns true', async () => {
    //     expect(await subject()).toBeTruthy();
    //   });
    //   context('when true validators is present', {
    //     definitions() {
    //       class NewKlass extends Klass {
    //         static get validators(): Validator<any>[] {
    //           return [trueValidator];
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns true', async () => {
    //         expect(await subject()).toBeTruthy();
    //       });
    //     },
    //   });
    //   context('when false validators is present', {
    //     definitions() {
    //       class NewKlass extends Klass {
    //         static get validators(): Validator<any>[] {
    //           return [falseValidator];
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns false', async () => {
    //         expect(await subject()).toBeFalsy();
    //       });
    //     },
    //   });
    //   context('when mixed validators is present', {
    //     definitions() {
    //       class NewKlass extends Klass {
    //         static get validators(): Validator<any>[] {
    //           return [trueValidator, falseValidator];
    //         }
    //       };
    //       Klass = NewKlass;
    //     },
    //     tests() {
    //       it('returns false', async () => {
    //         expect(await subject()).toBeFalsy();
    //       });
    //     },
    //   });
    // });
    // describe('#changes', () => {
    //   let key: string = 'foo';
    //   let attrs: any = { [key]: 'bar' };
    //   let Klass: typeof Model = class NewKlass extends Faker.model {
    //     static get schema() {
    //       const schema = super.schema;
    //       schema[key] = { type: DataType.string };
    //       return schema;
    //     }
    //   };
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.changes;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build(attrs);
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual({
    //           foo: {
    //             from: undefined,
    //             to: 'bar',
    //           },
    //         });
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create(attrs);
    //       attrs.id = instance.id;
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual({});
    //       });
    //     },
    //   });
    // });
    // //#endregion
    // //#region Manipulation
    // describe('#assign(attrs)', () => {
    //   let attrs: any = {};
    //   let key: string = 'foo';
    //   let Klass: typeof Model = class NewKlass extends Faker.model {
    //     static get schema() {
    //       const schema = super.schema;
    //       schema[key] = { type: DataType.string };
    //       return schema;
    //     }
    //   };
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.assign(attrs).attributes;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build({});
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual(attrs);
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create({});
    //       attrs.id = instance.id;
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual(attrs);
    //       });
    //     },
    //   });
    //   context('when attributes have key which is not at schema', {
    //     async definitions() {
    //       attrs = { notInSchema: 'foo' };
    //     },
    //     tests() {
    //       context('when instance is build', {
    //         definitions() {
    //           instance = Klass.build(attrs);
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject().notInSchema).toBeUndefined();
    //           });
    //         },
    //       });
    //       context('when instance is created', {
    //         async definitions() {
    //           instance = await Klass.create(attrs);
    //           attrs.id = instance.id;
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject().notInSchema).toBeUndefined();
    //           });
    //         },
    //       });
    //     },
    //   });
    //   context('when attributes have key which is present at schema', {
    //     async definitions() {
    //       attrs = { [key]: 'foo' };
    //     },
    //     tests() {
    //       context('when instance is build', {
    //         definitions() {
    //           instance = Klass.build(attrs);
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject()[key]).toEqual('foo');
    //           });
    //         },
    //       });
    //       context('when instance is created', {
    //         async definitions() {
    //           instance = await Klass.create(attrs);
    //           attrs.id = instance.id;
    //         },
    //         tests() {
    //           it('does not set invalid key', async () => {
    //             expect(subject()[key]).toEqual('foo');
    //           });
    //         },
    //       });
    //     },
    //   });
    // });
    // describe('#revertChange(key)', () => {
    //   let key: string = 'foo';
    //   let attrs: any = { [key]: 'bar' };
    //   let Klass: typeof Model = class NewKlass extends Faker.model {
    //     static get schema() {
    //       const schema = super.schema;
    //       schema[key] = { type: DataType.string };
    //       return schema;
    //     }
    //   };
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.revertChange(key).changes;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build(attrs);
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual({});
    //       });
    //       context('when key is not changed', {
    //         definitions() {
    //           key = 'bar';
    //         },
    //         tests() {
    //           it('returns attributes of instance', async () => {
    //             expect(subject()).toEqual({
    //               foo: {
    //                 from: undefined,
    //                 to: 'bar',
    //               },
    //             });
    //           });
    //         },
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create(attrs);
    //       attrs.id = instance.id;
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual({});
    //       });
    //     },
    //   });
    // });
    // describe('#revertChanges()', () => {
    //   let key: string = 'foo';
    //   let attrs: any = { [key]: 'bar' };
    //   let Klass: typeof Model = class NewKlass extends Faker.model {
    //     static get schema() {
    //       const schema = super.schema;
    //       schema[key] = { type: DataType.string };
    //       return schema;
    //     }
    //   };
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.revertChanges().changes;
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build(attrs);
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual({});
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create(attrs);
    //       attrs.id = instance.id;
    //     },
    //     tests() {
    //       it('returns attributes of instance', async () => {
    //         expect(subject()).toEqual({});
    //       });
    //     },
    //   });
    // });
    // //#endregion
    // //#region Storage
    // describe('#save()', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.save();
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build({});
    //     },
    //     tests() {
    //       it('saves instance', async () => {
    //         expect(await Klass.all).toEqual([]);
    //         expect(instance.isNew).toBeTruthy();
    //         expect((await subject()).isNew).toBeFalsy();
    //         const data = (await Klass.all).map(instance => instance.attributes);
    //         expect(data).toEqual([instance.attributes]);
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create({});
    //     },
    //     tests() {
    //       it('saves changes', async () => {
    //         const count = await Klass.count;
    //         const keys = Object.keys(Klass.schema);
    //         instance.assign({
    //           [keys[0]]: 'foo',
    //           [keys[1]]: 'bar',
    //         });
    //         expect(instance.isChanged).toBeTruthy();
    //         expect((await subject()).isChanged).toBeFalsy();
    //         expect(await Klass.count).toEqual(count);
    //       });
    //     },
    //   });
    // });
    // describe('#delete()', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.delete();
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build({});
    //     },
    //     tests() {
    //       it('returns error', () => {
    //         return expect(subject()).rejects.toEqual('[TODO] Cant find error');
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create({});
    //     },
    //     tests() {
    //       it('deletes instance', async () => {
    //         const count = await Klass.count;
    //         const deletedInstance = await subject();
    //         expect(deletedInstance).toBeInstanceOf(Klass);
    //         expect(deletedInstance.attributes).toEqual(instance.attributes);
    //         expect(await Klass.count).toEqual(count - 1);
    //       });
    //     },
    //   });
    // });
    // describe('#reload()', () => {
    //   let Klass: typeof Model = Faker.model;
    //   let instance: ModelConstructor<any>;
    //   const subject = () => instance.reload();
    //   context('when instance is build', {
    //     definitions() {
    //       instance = Klass.build({});
    //     },
    //     tests() {
    //       it('returns error', async () => {
    //         expect(await subject()).toBeUndefined();
    //       });
    //     },
    //   });
    //   context('when instance is created', {
    //     async definitions() {
    //       instance = await Klass.create({});
    //     },
    //     tests() {
    //       it('reloads from storage', async () => {
    //         const keys = Object.keys(Klass.schema).filter(key => key !== 'id');
    //         const attributes = instance.attributes;
    //         instance.assign({
    //           [keys[0]]: 'foo',
    //         });
    //         expect(instance.isChanged).toBeTruthy();
    //         const reloadedInstance = await subject();
    //         expect(reloadedInstance.isChanged).toBeFalsy();
    //         expect(reloadedInstance.attributes).toEqual(attributes);
    //       });
    //     },
    //   });
    // });
    // //#endregion
    // //#endregion
});
