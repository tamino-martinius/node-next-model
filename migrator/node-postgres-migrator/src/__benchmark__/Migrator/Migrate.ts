import { Migration, Migrator } from '../..';

import { Benchmark } from '../Benchmark';

export class Migrate extends Benchmark {
  lastIndex = 0;
  migrations: Migration[] = [];
  tableName = `benchmark-${this.id}`;
  migrator = new Migrator({ max: 5, tableName: this.tableName });

  get simulateWork() {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, ~~(Math.random() * 200));
    });
  }

  get migration(): Migration {
    return {
      version: `example-${(this.lastIndex += 1)}`,
      up: () => this.simulateWork,
      down: () => this.simulateWork,
    };
  }

  async setup(_: number) {
    await this.migrator.createTable();
  }

  async teardown() {
    await this.migrator.dropTable();
  }

  async main() {
    await this.migrator.migrate(this.migrations);
  }
}
