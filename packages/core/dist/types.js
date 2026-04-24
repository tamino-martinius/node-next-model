export var KeyType;
(function (KeyType) {
    KeyType[KeyType["uuid"] = 0] = "uuid";
    KeyType[KeyType["number"] = 1] = "number";
    /** Caller supplies the primary key value; the connector does not generate one. */
    KeyType[KeyType["manual"] = 2] = "manual";
})(KeyType || (KeyType = {}));
export var SortDirection;
(function (SortDirection) {
    SortDirection[SortDirection["Asc"] = 1] = "Asc";
    SortDirection[SortDirection["Desc"] = -1] = "Desc";
})(SortDirection || (SortDirection = {}));
//# sourceMappingURL=types.js.map