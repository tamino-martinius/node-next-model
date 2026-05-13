import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateMigration } from './generator.js';
import type { GeneratedMigration, GenerateOptions } from './types.js';

export interface WriteOptions extends GenerateOptions {
  /** Directory the file is written into. Defaults to `./migrations`. */
  directory?: string;
  /** Throw if the directory doesn't exist (defaults to creating it). */
  requireExistingDir?: boolean;
}

export interface WriteResult extends GeneratedMigration {
  path: string;
}

export function writeMigration(options: WriteOptions): WriteResult {
  const directory = options.directory ?? './migrations';
  if (!options.requireExistingDir) {
    mkdirSync(directory, { recursive: true });
  }
  const migration = generateMigration(options);
  const path = join(directory, migration.fileName);
  writeFileSync(path, migration.contents, { flag: 'wx' });
  return { ...migration, path };
}
