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

export class MigrationParentMissingError extends MigrationError {
  readonly version: string;
  readonly parent: string;

  constructor(version: string, parent: string) {
    super(`migration ${version} declares parent ${parent} which is not in the provided list`);
    this.name = 'MigrationParentMissingError';
    this.version = version;
    this.parent = parent;
  }
}

export class MigrationCycleError extends MigrationError {
  readonly versions: string[];

  constructor(versions: string[]) {
    super(`migration dependency cycle detected involving: ${versions.join(', ')}`);
    this.name = 'MigrationCycleError';
    this.versions = versions;
  }
}
