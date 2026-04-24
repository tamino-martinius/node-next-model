import { Dict, Migration } from './types';
import { Connector } from './Connector';

export class Migrator {
  migrationPromises: Dict<Promise<void>> = {};
  migrationStatus: Dict<boolean> = {};
  initStatus: boolean | Promise<void> = false;
  lastMigration: string | undefined;

  constructor(public connector: Connector) { }

  async init(): Promise<void> {
    if (this.initStatus === true) return Promise.resolve();
    if (this.initStatus === false) {
      return this.initStatus = new Promise(async (resolve) => {
        const migrationTableExists = await this.connector.tableExists();
        if (!migrationTableExists) await this.connector.createTable();
        const migrationKeys = await this.connector.getMigrationKeys();
        for (const key of migrationKeys) {
          this.migrationStatus[key] = true;
          this.migrationPromises[key] = Promise.resolve();
          this.lastMigration = key;
        }
        resolve();
      });
    }
    return this.initStatus;
  }

  public async migrate(migrations: Migration[]): Promise<void> {
    const promises: Promise<void>[] = [];
    let migrationCount = migrations.length;
    const migrationKeyLookup: Dict<boolean> = {};
    migrations.map(migration => migrationKeyLookup[migration.key] = true);
    while (migrationCount > 0) {
      let index = 0;
      while (index < migrations.length) {
        const migration = migrations[index];
        let processMigration = true;
        if (migration.parent !== undefined) {
          for (const key of migration.parent) {
            if (!this.migrationPromises[key]) {
              if (!migrationKeyLookup[key]) {
                throw `Parent «${key}» not found for migration «${migrations[0].key}».`;
              }
              processMigration = false;
              break;
            }
          }
        }
        if (processMigration) {
          promises.push(this.up(migration));
          migrations.splice(index, 1);
        } else {
          index += 1;
        }
      }
      if (migrationCount === migrations.length) {
        throw `
          Migrations build a infinite loop.
          Unable to add keys «${migrations.map(migration => migration.key).join('», «')}».
        `;
      }
      migrationCount = migrations.length;
    }
    await Promise.all(promises);
  }

  public async up(migration: Migration): Promise<void> {
    const parent = migration.parent || (this.lastMigration ? [this.lastMigration] : []);
    const parentPromises = parent.map((key) => {
      const process = this.migrationPromises[key];
      if (!process) throw `Parent Migration «${key}» missing.`;
      return process;
    });
    return this.migrationPromises[migration.key] = new Promise(async (resolve, reject) => {
      await this.init();
      await Promise.all(parentPromises);
      try {
        await this.connector.beginTransaction();
        await migration.up();
        await this.connector.insertMigrationKey(migration.key);
        await this.connector.endTransaction();
        this.migrationStatus[migration.key] = true;
      } catch (error) {
        await this.connector.rollbackTransaction();
        return reject(error);
      }
      resolve();
    });
  }

  public async down(migration: Migration): Promise<void> {
    await this.init();
    try {
      await this.connector.beginTransaction();
      await migration.down();
      await this.connector.deleteMigrationKey(migration.key);
      await this.connector.endTransaction();
      delete this.migrationPromises[migration.key];
      delete this.migrationStatus[migration.key];
    } catch (error) {
      await this.connector.rollbackTransaction();
      throw error;
    }
  }
}

export default Migrator;
