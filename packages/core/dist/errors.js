export class NextModelError extends Error {
    constructor(message) {
        super(message);
        this.name = new.target.name;
    }
}
export class FilterError extends NextModelError {
}
export class NotFoundError extends NextModelError {
}
export class PersistenceError extends NextModelError {
}
export class ValidationError extends NextModelError {
}
//# sourceMappingURL=errors.js.map