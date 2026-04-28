#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Connector, TableDefinition } from '@next-model/core';
import { generateSchemaSource } from '@next-model/core';

import type { ColumnStub } from './types.js';
import type { WriteOptions } from './writer.js';
import { writeMigration } from './writer.js';

function usage(): string {
  return [
    'Usage:',
    '  nm-generate-migration <name> [options]',
    '  nm-generate-migration schema-from-db --connector <path> --output <path> [options]',
    '',
    'Generate-migration options:',
    '  --dir <path>                 Output directory (default: ./migrations)',
    '  --create-table <name>        Scaffold a createTable body for <name>',
    '  --column <spec>              Column spec for --create-table, repeatable.',
    '                               Format: name[:type[:flags]] — type defaults to string.',
    '                               Flags: primary, autoIncrement, nullable, not-null.',
    '  --no-timestamps              Skip the default createdAt + updatedAt columns',
    '                               when using --create-table.',
    '  --parent <version>           Parent migration version (repeatable).',
    '  --version <string>           Override the auto-generated version.',
    '  --core-spec <module>         Import specifier for Connector (default: @next-model/core).',
    '  --require-existing-dir       Do not create the output directory.',
    '',
    'schema-from-db options:',
    '  --connector <path>           Path to a JS/TS module exporting a Connector instance.',
    '                               The module must default-export a Connector OR export it',
    '                               as `connector`, OR export a `default()` factory.',
    '  --output <path>              Path to write the generated typed-schema TS file.',
    '  --import-path <module>       Module specifier the emitted source imports defineSchema',
    '                               from (default: @next-model/core).',
    '  -h, --help                   Show this help.',
    '',
    'Examples:',
    '  nm-generate-migration create_users \\',
    '    --create-table users \\',
    '    --column id:integer:primary:autoIncrement:not-null \\',
    '    --column name:string:not-null \\',
    '    --column age:integer',
    '',
    '  nm-generate-migration schema-from-db \\',
    '    --connector ./db-connector.js \\',
    '    --output ./src/schema.ts',
  ].join('\n');
}

function parseColumn(raw: string): ColumnStub {
  const [name, type, ...flags] = raw.split(':');
  if (!name) throw new Error(`--column requires a name (got "${raw}")`);
  const col: ColumnStub = { name };
  if (type) col.type = type as ColumnStub['type'];
  for (const flag of flags) {
    if (flag === 'primary') col.primary = true;
    else if (flag === 'autoIncrement') col.autoIncrement = true;
    else if (flag === 'nullable') col.nullable = true;
    else if (flag === 'not-null') col.nullable = false;
    else throw new Error(`Unknown column flag "${flag}" in --column ${raw}`);
  }
  return col;
}

export interface CliOptions {
  args: string[];
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  now?: Date;
}

export interface CliResult {
  exitCode: number;
  /** Resolved write options — undefined when we only print help or fail to parse. */
  resolved?: WriteOptions;
  /** Path written (only populated when the command actually wrote a file). */
  path?: string;
}

/** Options for the `schema-from-db` subcommand. */
export interface SchemaFromDbOptions {
  /** Path to a module that exports a Connector. */
  connector: string;
  /** Where to write the generated typed-schema file. */
  output: string;
  /** Optional override for the `defineSchema` import specifier in the output. */
  importPath?: string;
}

export function parseSchemaFromDbArgs(args: string[]): {
  options: Partial<SchemaFromDbOptions>;
  showHelp: boolean;
} {
  let showHelp = false;
  const options: Partial<SchemaFromDbOptions> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      showHelp = true;
      continue;
    }
    if (arg === '--connector') {
      options.connector = args[++i];
      continue;
    }
    if (arg === '--output') {
      options.output = args[++i];
      continue;
    }
    if (arg === '--import-path') {
      options.importPath = args[++i];
      continue;
    }
    if (arg?.startsWith('--')) {
      throw new Error(`Unknown flag for schema-from-db: ${arg}`);
    }
    throw new Error(`Unexpected positional arg for schema-from-db: ${arg}`);
  }
  return { options, showHelp };
}

/**
 * Load the connector module and reach for an instance. We accept any of:
 *   - default export = Connector instance
 *   - default export = `() => Connector | Promise<Connector>` factory
 *   - named `connector` export
 *
 * The order is "instance > named instance > factory" to match the most
 * common ergonomic shapes consumers reach for.
 */
async function loadConnector(modulePath: string): Promise<Connector> {
  const absolute = resolve(modulePath);
  const url = pathToFileURL(absolute).href;
  const mod = (await import(url)) as Record<string, unknown>;
  const candidates: unknown[] = [mod.default, (mod as any).connector, mod];
  for (const c of candidates) {
    if (isConnector(c)) return c;
  }
  // Try invoking a factory function before giving up.
  for (const c of candidates) {
    if (typeof c === 'function') {
      const built = await (c as () => Connector | Promise<Connector>)();
      if (isConnector(built)) return built;
    }
  }
  throw new Error(
    `Could not find a Connector in ${modulePath}. Export it as default, named \`connector\`, or a factory.`,
  );
}

function isConnector(value: unknown): value is Connector {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object' && typeof value !== 'function') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.query === 'function' &&
    typeof v.createTable === 'function' &&
    typeof v.batchInsert === 'function'
  );
}

export async function runSchemaFromDb(
  options: SchemaFromDbOptions,
): Promise<{ tables: TableDefinition[]; path: string }> {
  const connector = await loadConnector(options.connector);
  if (typeof connector.reflectSchema !== 'function') {
    throw new Error(
      `Connector loaded from ${options.connector} does not implement reflectSchema(). schema-from-db needs a connector with schema reflection support — see the @next-model/core Connector docs.`,
    );
  }
  const tables = await connector.reflectSchema();
  const source = generateSchemaSource(tables, { importPath: options.importPath });
  mkdirSync(dirname(options.output), { recursive: true });
  writeFileSync(options.output, source, 'utf8');
  return { tables, path: options.output };
}

export function parseArgs(args: string[]): { options: WriteOptions; showHelp: boolean } {
  let showHelp = false;
  const positional: string[] = [];
  const options: WriteOptions = { name: '' };
  const columns: ColumnStub[] = [];
  let createTableName: string | undefined;
  let timestamps = true;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      showHelp = true;
      continue;
    }
    if (arg === '--dir') {
      options.directory = args[++i];
      continue;
    }
    if (arg === '--create-table') {
      createTableName = args[++i];
      continue;
    }
    if (arg === '--column') {
      columns.push(parseColumn(args[++i] ?? ''));
      continue;
    }
    if (arg === '--no-timestamps') {
      timestamps = false;
      continue;
    }
    if (arg === '--parent') {
      options.parents = [...(options.parents ?? []), args[++i]];
      continue;
    }
    if (arg === '--version') {
      options.version = args[++i];
      continue;
    }
    if (arg === '--core-spec') {
      options.coreSpec = args[++i];
      continue;
    }
    if (arg === '--require-existing-dir') {
      options.requireExistingDir = true;
      continue;
    }
    if (arg?.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }

  options.name = positional.join(' ');
  if (createTableName) {
    options.createTable = { tableName: createTableName, columns, timestamps };
  }

  return { options, showHelp };
}

export function runCli(cli: CliOptions): CliResult {
  const stdout = cli.stdout ?? process.stdout;
  const stderr = cli.stderr ?? process.stderr;

  let parsed: { options: WriteOptions; showHelp: boolean };
  try {
    parsed = parseArgs(cli.args);
  } catch (err) {
    stderr.write(`${(err as Error).message}\n\n${usage()}\n`);
    return { exitCode: 2 };
  }

  if (parsed.showHelp || parsed.options.name === '') {
    stdout.write(`${usage()}\n`);
    return { exitCode: parsed.showHelp ? 0 : 2 };
  }

  try {
    const resolved = cli.now
      ? ({ ...parsed.options, now: cli.now } as WriteOptions)
      : parsed.options;
    const result = writeMigration(resolved);
    stdout.write(`wrote ${result.path}\n`);
    return { exitCode: 0, resolved, path: result.path };
  } catch (err) {
    stderr.write(`${(err as Error).message}\n`);
    return { exitCode: 1, resolved: parsed.options };
  }
}

/**
 * Async-friendly entry point. Identical to `runCli` for the synchronous
 * `generate-migration` path; routes the `schema-from-db` subcommand through
 * its async pipeline (connector load + reflectSchema). Use this when you
 * need to await the CLI's result programmatically.
 */
export async function runCliAsync(cli: CliOptions): Promise<CliResult> {
  const stdout = cli.stdout ?? process.stdout;
  const stderr = cli.stderr ?? process.stderr;

  if (cli.args[0] === 'schema-from-db') {
    let parsed: { options: Partial<SchemaFromDbOptions>; showHelp: boolean };
    try {
      parsed = parseSchemaFromDbArgs(cli.args.slice(1));
    } catch (err) {
      stderr.write(`${(err as Error).message}\n\n${usage()}\n`);
      return { exitCode: 2 };
    }
    if (parsed.showHelp) {
      stdout.write(`${usage()}\n`);
      return { exitCode: 0 };
    }
    if (!parsed.options.connector || !parsed.options.output) {
      stderr.write(`schema-from-db requires both --connector and --output.\n\n${usage()}\n`);
      return { exitCode: 2 };
    }
    try {
      const result = await runSchemaFromDb(parsed.options as SchemaFromDbOptions);
      stdout.write(`wrote ${result.path}\n`);
      return { exitCode: 0, path: result.path };
    } catch (err) {
      stderr.write(`${(err as Error).message}\n`);
      return { exitCode: 1 };
    }
  }

  return runCli(cli);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Drive the async path so subcommands like schema-from-db can complete
  // before the process exits.
  void runCliAsync({ args: process.argv.slice(2) }).then((result) => {
    process.exit(result.exitCode);
  });
}
