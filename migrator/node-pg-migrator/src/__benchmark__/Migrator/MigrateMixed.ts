import { Migrate } from './Migrate';

export class MigrateMixed extends Migrate {
  async setup(count: number) {
    await super.setup(count);
    Array.from({ length: count }).forEach((_, i) => {
      const parent = i % 2 === 0 ? [] : Array.from({ length: 2 }).map(
        () => this.migrations[~~(Math.random() * this.migrations.length)].version,
      );
      this.migrations.push({ ...this.migration, parent });
    });
  }
}
