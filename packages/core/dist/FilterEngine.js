import { FilterError } from './errors';
const singleKey = (filter, op) => {
    const keys = Object.keys(filter);
    if (keys.length !== 1) {
        throw new FilterError(`${op} expects exactly one key, got ${keys.length}`);
    }
    return keys[0];
};
async function propertyFilter(items, filter) {
    const counts = {};
    // biome-ignore lint/suspicious/noAssignInExpressions: concise counter init
    items.forEach((item) => (counts[item.id] = 0));
    for (const key in filter) {
        items.forEach((item) => {
            if (item[key] === filter[key]) {
                counts[item.id] += 1;
            }
        });
    }
    const filterCount = Object.keys(filter).length;
    return items.filter((item) => counts[item.id] === filterCount);
}
async function andFilter(items, filters) {
    const counts = items.reduce((obj, item) => {
        obj[item.id] = 0;
        return obj;
    }, {});
    await Promise.all(filters.map(async (filter) => {
        const filterItems = await filterList(items, filter);
        filterItems.forEach((item) => {
            counts[item.id] += 1;
        });
    }));
    const filterCount = filters.length;
    return items.filter((item) => counts[item.id] === filterCount);
}
async function notFilter(items, filter) {
    const array = await filterList(items, filter);
    const exists = {};
    array.forEach((item) => {
        exists[item.id] = exists[item.id] || true;
    });
    return items.filter((item) => !exists[item.id]);
}
async function orFilter(items, filters) {
    const arrays = await Promise.all(filters.map(async (filter) => await filterList(items, filter)));
    const exists = {};
    arrays.forEach((array) => array.forEach((item) => {
        exists[item.id] = exists[item.id] || true;
    }));
    return items.filter((item) => exists[item.id]);
}
async function inFilter(items, filter) {
    const key = singleKey(filter, '$in');
    return items.filter((item) => {
        const values = filter[key];
        if (Array.isArray(values)) {
            for (const value of values) {
                if (item[key] === value)
                    return true;
            }
        }
        return false;
    });
}
async function notInFilter(items, filter) {
    const key = singleKey(filter, '$notIn');
    return items.filter((item) => {
        const values = filter[key];
        if (Array.isArray(values)) {
            for (const value of values) {
                if (item[key] === value)
                    return false;
            }
        }
        return true;
    });
}
async function nullFilter(items, key) {
    return items.filter((item) => item[key] === null || item[key] === undefined);
}
async function notNullFilter(items, key) {
    return items.filter((item) => item[key] !== null && item[key] !== undefined);
}
async function betweenFilter(items, filter) {
    const key = singleKey(filter, '$between');
    const range = filter[key];
    if (range === undefined)
        return items;
    return items.filter((item) => range.to >= item[key] && item[key] >= range.from);
}
async function notBetweenFilter(items, filter) {
    const key = singleKey(filter, '$notBetween');
    const range = filter[key];
    if (range === undefined)
        return items;
    return items.filter((item) => range.to < item[key] || item[key] < range.from);
}
async function gtFilter(items, filter) {
    const key = singleKey(filter, '$gt');
    return items.filter((item) => item[key] > filter[key]);
}
async function gteFilter(items, filter) {
    const key = singleKey(filter, '$gte');
    return items.filter((item) => item[key] >= filter[key]);
}
async function ltFilter(items, filter) {
    const key = singleKey(filter, '$lt');
    return items.filter((item) => item[key] < filter[key]);
}
async function lteFilter(items, filter) {
    const key = singleKey(filter, '$lte');
    return items.filter((item) => item[key] <= filter[key]);
}
async function rawFilter(items, filter) {
    const fn = compileRawQuery(filter.$query);
    const params = filter.$bindings;
    if (Array.isArray(params)) {
        return items.filter((item) => fn(item, ...params));
    }
    return items.filter((item) => fn(item, params));
}
async function asyncFilter(items, pending) {
    const filter = await pending;
    if (filter && Object.keys(filter).length > 0) {
        return filterList(items, filter);
    }
    return items;
}
async function specialFilter(items, filter) {
    const keys = Object.keys(filter);
    if (keys.length !== 1) {
        throw new FilterError(`special filter expects exactly one operator, got ${keys.length}`);
    }
    if (filter.$and !== undefined)
        return andFilter(items, filter.$and);
    if (filter.$or !== undefined)
        return orFilter(items, filter.$or);
    if (filter.$not !== undefined)
        return notFilter(items, filter.$not);
    if (filter.$in !== undefined)
        return inFilter(items, filter.$in);
    if (filter.$notIn !== undefined)
        return notInFilter(items, filter.$notIn);
    if (filter.$null !== undefined)
        return nullFilter(items, filter.$null);
    if (filter.$notNull !== undefined)
        return notNullFilter(items, filter.$notNull);
    if (filter.$between !== undefined)
        return betweenFilter(items, filter.$between);
    if (filter.$notBetween !== undefined)
        return notBetweenFilter(items, filter.$notBetween);
    if (filter.$gt !== undefined)
        return gtFilter(items, filter.$gt);
    if (filter.$gte !== undefined)
        return gteFilter(items, filter.$gte);
    if (filter.$lt !== undefined)
        return ltFilter(items, filter.$lt);
    if (filter.$lte !== undefined)
        return lteFilter(items, filter.$lte);
    if (filter.$raw !== undefined)
        return rawFilter(items, filter.$raw);
    if (filter.$async !== undefined)
        return asyncFilter(items, filter.$async);
    throw new FilterError(`unknown special filter operator: ${keys[0]}`);
}
function compileRawQuery(source) {
    // biome-ignore lint/security/noGlobalEval: in-memory filter evaluates raw predicate strings by design
    return eval(source);
}
export async function filterList(items, filter = {}) {
    for (const key in filter) {
        if (key.startsWith('$')) {
            return specialFilter(items, filter);
        }
    }
    return propertyFilter(items, filter);
}
//# sourceMappingURL=FilterEngine.js.map