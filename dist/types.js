"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DataType;
(function (DataType) {
    DataType[DataType["bigInteger"] = 0] = "bigInteger";
    DataType[DataType["binary"] = 1] = "binary";
    DataType[DataType["boolean"] = 2] = "boolean";
    DataType[DataType["date"] = 3] = "date";
    DataType[DataType["dateTime"] = 4] = "dateTime";
    DataType[DataType["decimal"] = 5] = "decimal";
    DataType[DataType["enum"] = 6] = "enum";
    DataType[DataType["float"] = 7] = "float";
    DataType[DataType["integer"] = 8] = "integer";
    DataType[DataType["json"] = 9] = "json";
    DataType[DataType["jsonb"] = 10] = "jsonb";
    DataType[DataType["string"] = 11] = "string";
    DataType[DataType["text"] = 12] = "text";
    DataType[DataType["time"] = 13] = "time";
    DataType[DataType["uuid"] = 14] = "uuid";
})(DataType = exports.DataType || (exports.DataType = {}));
var OrderDirection;
(function (OrderDirection) {
    OrderDirection[OrderDirection["asc"] = 1] = "asc";
    OrderDirection[OrderDirection["desc"] = -1] = "desc";
})(OrderDirection = exports.OrderDirection || (exports.OrderDirection = {}));
var ModelStaticClass = (function () {
    function ModelStaticClass() {
    }
    return ModelStaticClass;
}());
exports.ModelStaticClass = ModelStaticClass;
var ModelConstructorClass = (function () {
    function ModelConstructorClass() {
    }
    return ModelConstructorClass;
}());
exports.ModelConstructorClass = ModelConstructorClass;
//# sourceMappingURL=types.js.map