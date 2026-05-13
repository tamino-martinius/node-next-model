export class NextModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class FilterError extends NextModelError {}
export class NotFoundError extends NextModelError {}
export class PersistenceError extends NextModelError {}
export class StaleObjectError extends NextModelError {}
export class UnsupportedOperationError extends NextModelError {}
export class ValidationError extends NextModelError {
  errors?: Record<string, string[]>;
  constructor(message: string, errors?: Record<string, string[]>) {
    super(message);
    this.errors = errors;
  }
}
