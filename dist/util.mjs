export function snakeToCamelCase(value) {
    return value.replace(/_\w/g, m => m[1].toUpperCase());
}
export function camelToSnakeCase(value) {
    return value.replace(/([A-Z])/g, m => `_${m.toLowerCase()}`);
}
export function uuid() {
    const dateStr = Date.now()
        .toString(16)
        .padStart(12, '0');
    const randomStr = Math.random()
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
export function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
//# sourceMappingURL=util.mjs.map