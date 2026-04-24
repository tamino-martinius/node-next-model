import { existsSync, mkdirSync, writeFileSync } from 'fs';

import { Migration } from './types';
import { Migrator } from './Migrator';
import { resolve } from 'path';

export type Logger = (...params: any[]) => void;

export class CLI {
  folder: string;
  logger: Logger;
  private cachedNodeVersion: number | undefined;

  constructor(logger: Logger = console.log) {
    this.logger = logger;
  }

  private envHelp() {
    this.logger('');
    this.logger('Environment variables:');
    this.logger('  PGHOST             Host of postgres server');
    this.logger('  PGPORT             Port of postgres server ');
    this.logger('  PGUSER             Username of postgres user');
    this.logger('  PGPASSWORD         Password of postgres user');
    this.logger('  PGDATABASE         Database Name');
  }

  help() {
    this.logger('Usage: pg-migrator <command> [paramenters]');
    this.logger('To see help text, you can run:');
    this.logger('');
    this.logger('  pg-migrator help');
    this.logger('  pg-migrator <command> help');
    this.logger('');
    this.logger('Commands:');
    this.logger('  migrate            Applies all pending migrations from the given folder');
    this.logger('  up                 Applies the migration');
    this.logger('  down               Does a rollback of the migration');
    this.logger('  create             Creates a empty migration with the given name');
    this.logger('  createDatabase     Creates the database if not already existing');
    this.logger('  dropDatabase       Drops the database if already existing');
    this.logger('  dropTable          Drops the migration table');
    this.logger('  help               Shows this overview');
  }

  migrateHelp() {
    this.logger('Applies all pending migrations from the given folder');
    this.logger('');
    this.logger('Usage: pg-migrator migrate [paramenters]');
    this.logger('');
    this.logger('Options:');
    this.logger('  -f, --folder       Folder which contains the migrations');
    this.logger('                     (default: migrations)');
    this.envHelp();
  }

  upHelp() {
    this.logger('Applies the migration');
    this.logger('');
    this.logger('Usage: pg-migrator up [paramenters]');
    this.logger('');
    this.logger('Options:');
    this.logger('  -f, --folder       Folder which contains the migrations');
    this.logger('                     (default: migrations)');
    this.logger('  -n, --name         Full filename without extension');
    this.logger('  -v, --version      Version of the migration (first part of filename)');
    this.envHelp();
  }

  downHelp() {
    this.logger('Does a rollback of the migration');
    this.logger('');
    this.logger('Usage: pg-migrator down [paramenters]');
    this.logger('');
    this.logger('Options:');
    this.logger('  -f, --folder       Folder which contains the migrations');
    this.logger('                     (default: migrations)');
    this.logger('  -n, --name         Full filename without extension');
    this.logger('  -v, --version      Version of the migration (first part of filename)');
    this.envHelp();
  }

  createDatabaseHelp() {
    this.logger('Creates the database if not already existing');
    this.logger('');
    this.logger('Usage: pg-migrator createDatabase [paramenters]');
    this.envHelp();
  }

  dropDatabaseHelp() {
    this.logger('Drops the database if already existing');
    this.logger('');
    this.logger('Usage: pg-migrator dropDatabase [paramenters]');
    this.envHelp();
  }

  dropTableHelp() {
    this.logger('Drops the migration table');
    this.logger('');
    this.logger('Usage: pg-migrator dropTable [paramenters]');
    this.envHelp();
  }

  createHelp() {
    this.logger('Creates a empty migration with the given name');
    this.logger('');
    this.logger('Usage: pg-migrator create <name> [paramenters]');
    this.logger('  -f, --folder       Folder which contains the migrations');
    this.logger('                     (default: migrations)');
    this.logger('  -t, --type         Pass the type of migration template which should be used');
    this.logger('                     Valid options are: js, es2015, es2017, ts');
    this.logger('                     (default: js)');
    this.envHelp();
  }

  private createFolder(path: string) {
    const parent = resolve(path, '..');
    if (!existsSync(parent)) this.createFolder(parent);
    if (!existsSync(path)) mkdirSync(path);
  }

  private get migrationsPath() {
    const folderParam = this.getParam('f', 'folder');
    const path = folderParam ? resolve(folderParam) : resolve('migrations');
    this.createFolder(path);
    return path;
  }

  private get migrationNames() {
    const path = this.migrationsPath;
    this.logger(path);
    return Migrator.getMigrationFileNamesFromPath(path);
  }

  private readMigration(fileName: string) {
    const path = this.migrationsPath;
    return Migrator.readMigrationFromPath(path, fileName);
  }

  private get migrations(): Migration[] {
    const path = this.migrationsPath;
    return Migrator.getMigrationsFromPath(path);
  }

  private get migration(): Migration {
    const path = this.migrationsPath;
    const names = this.migrationNames;
    const nameParam = this.getParam('n', 'name');
    const versionParam = this.getParam('v', 'version');
    if (nameParam && nameParam.length > 0) {
      if (names.indexOf(nameParam) < 0) {
        throw `Unable to find file «${nameParam}» in folder «${path}»`;
      }
      return this.readMigration(nameParam);
    }
    if (versionParam && versionParam.length > 0) {
      for (const name of names) {
        if (name.startsWith(`${versionParam}_`) || name.startsWith(`${versionParam}-`)) {
          return this.readMigration(name);
        }
      }
      throw `Unable to find version «${versionParam}» in folder «${path}»`;
    }
    throw 'Unable to find migration - please provide either version or name';
  }

  private getMigrator(tableName?: string) {
    return new Migrator({ tableName: tableName || 'migrations' });
  }

  private getParam(shortKey: string, longKey: string) {
    const shortParam = `-${shortKey}`;
    const longParam = `--${longKey}=`;
    const argv = process.argv;
    let result: string | undefined = undefined;
    for (let index = 0; index < argv.length; index += 1) {
      const param = argv[index];
      if (param === shortParam) {
        const nextParam = argv[index + 1];
        if (nextParam) {
          if (!nextParam.startsWith('-')) {
            result = nextParam;
          } else {
            throw `Invalid parameter value for «${shortParam}»: «${nextParam}»`;
          }
        } else {
          throw `Value missing for parameter «${shortParam}»`;
        }
      }
      if (param.startsWith(longParam)) {
        result = param.substr(longParam.length);
      }
    }
    return result;
  }

  async up() {
    await this.getMigrator().up(this.migration);
  }

  async down() {
    await this.getMigrator().down(this.migration);
  }

  async migrate() {
    await this.getMigrator().migrate(this.migrations);
  }

  async createDatabase() {
    await this.getMigrator().createDatabase();
  }

  async dropDatabase() {
    await this.getMigrator().dropDatabase();
  }

  async dropTable() {
    await this.getMigrator().dropTable();
  }

  get newVersion() {
    return new Date()
      .toISOString()
      .substr(0, 19)
      .replace(/[-T:]/g, '');
  }

  get nodeVersion() {
    if (this.cachedNodeVersion) return this.cachedNodeVersion;
    const version = Number((process.version.match(/^v(\d+\.\d+)/) || ['', '0'])[1]);
    return (this.cachedNodeVersion = version);
  }

  get es2015() {
    return `const postgres = require('postgres');

/**
 * Description of the Migration
 */
module.exports = {
  parent: undefined,
  /**
   * Method to apply migration
   * @param {any} sql
   * @returns {Promise<void>}
   */
  up(sql) {

    // Return Promise for Migration

  },
  /**
   * Method to rollback migration
   * @param {any} sql
   * @returns {Promise<void>}
   */
  down(sql) {

    // Return Promise for Rollback

  },
}
`;
  }

  get es2017() {
    return `const postgres = require('postgres');

/**
 * Description of the Migration
 */
module.exports = {
  parent: undefined,
  /**
   * Method to apply migration
   * @param {any} sql
   * @returns {Promise<void>}
   */
  async up(sql) {

    // Code for Migration

  },
  /**
   * Method to rollback migration
   * @param {any} sql
   * @returns {Promise<void>}
   */
  async down(sql) {

    // Code for Rollback

  },
}
`;
  }

  get ts() {
    return `/*
 * Description of the Migration
 */

// Migration depends on these versions
export const parent: string[] | undefined = undefined;

// Method to apply migration
export const up = async (sql: any) => {

  // Code for Migration

};

// Method to rollback migration
export const down = async (sql: any) => {

  // Code for Rollback

};
`;
  }

  get js() {
    return this.nodeVersion > 7 ? this.es2017 : this.es2015;
  }

  get template() {
    return this[this.type];
  }

  get extension() {
    return this.type === 'ts' ? 'ts' : 'js';
  }

  get type() {
    const typeParam = this.getParam('t', 'type');
    let type: 'js' | 'es2015' | 'es2017' | 'ts' = 'js';
    if (typeParam) {
      if (
        typeParam === 'js' ||
        typeParam === 'es2015' ||
        typeParam === 'es2017' ||
        typeParam === 'ts'
      ) {
        type = typeParam;
      } else {
        throw `Invalid parameter value for type «${typeParam}».
Valid options are 'js', 'es2015', 'es2017, 'ts'`;
      }
    }
    return type;
  }

  get arguments() {
    const args = process.argv.slice(2);
    let index = 0;
    while (index < args.length) {
      if (args[index].startsWith('--')) {
        args.splice(index, 1);
      } else if (args[index].startsWith('-')) {
        args.splice(index, 2);
      } else {
        index += 1;
      }
    }
    return args;
  }

  create() {
    const name = this.arguments[1];
    if (!name || name.length === 0 || name.startsWith('-')) {
      throw `Value missing for parameter «${name}»`;
    }

    const path = this.migrationsPath;
    writeFileSync(resolve(path, `${this.newVersion}_${name}.${this.extension}`), this.template);
  }
}

export default CLI;
