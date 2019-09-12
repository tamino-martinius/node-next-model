"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function snakeToCamelCase(value) {
    return value.replace(/_\w/g, function (m) { return m[1].toUpperCase(); });
}
exports.snakeToCamelCase = snakeToCamelCase;
function camelToSnakeCase(value) {
    return value.replace(/([A-Z])/g, function (m) { return "_" + m.toLowerCase(); });
}
exports.camelToSnakeCase = camelToSnakeCase;
function uuid() {
    var dateStr = Date.now()
        .toString(16)
        .padStart(12, '0');
    var randomStr = Math.random()
        .toString(16)
        .slice(2)
        .padStart(12, '0');
    return [
        '2e87c0de',
        dateStr.slice(0, 4),
        dateStr.slice(4, 8),
        dateStr.slice(8, 12),
        randomStr.slice(-12),
    ].join('-');
}
exports.uuid = uuid;
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
exports.clone = clone;
