export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class MigrationAlreadyAppliedError extends MigrationError {
  constructor(version: string) {
    super(`migration ${version} is already applied`);
    this.name = 'MigrationAlreadyAppliedError';
  }
}

export class MigrationNotAppliedError extends MigrationError {
  constructor(version: string) {
    super(`migration ${version} is not applied`);
    this.name = 'MigrationNotAppliedError';
  }
}

export class MigrationMissingError extends MigrationError {
  constructor(version: string) {
    super(`migration ${version} is applied but missing from the provided migration list`);
    this.name = 'MigrationMissingError';
  }
}
