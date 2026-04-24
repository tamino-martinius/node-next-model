import { Migrate } from './Migrate';

export class MigrateSequential extends Migrate {
  async setup(count: number) {
    await super.setup(count);
    this.migrations = Array.from({ length: count }).map(() => this.migration);
  }
}
