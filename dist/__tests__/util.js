"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.it = test;
exports.context = function (description, _a) {
    var definitions = _a.definitions, tests = _a.tests, reset = _a.reset;
    describe(description, function () {
        beforeEach(definitions);
        tests();
        if (reset !== undefined) {
            afterEach(reset);
        }
    });
};
function randomInteger(min, max) {
    return Math.max(min, Math.min(max, Math.round(Math.random() * (max - min))));
}
exports.randomInteger = randomInteger;
