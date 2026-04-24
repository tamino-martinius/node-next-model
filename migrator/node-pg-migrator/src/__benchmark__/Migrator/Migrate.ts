import { Benchmark } from '../Benchmark';
import { Migrator, Migration, Connector } from '../..';

export class Migrate extends Benchmark {
  lastIndex = 0;
  migrations: Migration[] = [];
  tableName = `benchmark-${this.id}`;
  migrator = new Migrator(this.tableName, { min: 1, max: 5 });

  get simulateWork() {
    return new Promise((resolve) => {
      setTimeout(
        () => {
          resolve();
        },
        ~~(Math.random() * 200),
      );
    });
  }

  get migration(): Migration {
    return {
      version: `example-${this.lastIndex += 1}`,
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
