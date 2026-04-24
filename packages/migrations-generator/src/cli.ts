#!/usr/bin/env node
import type { ColumnStub } from './types.js';
import type { WriteOptions } from './writer.js';
import { writeMigration } from './writer.js';

function usage(): string {
  return [
    'Usage: nm-generate-migration <name> [options]',
    '',
    'Options:',
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
    '  -h, --help                   Show this help.',
    '',
    'Examples:',
    '  nm-generate-migration create_users \\',
    '    --create-table users \\',
    '    --column id:integer:primary:autoIncrement:not-null \\',
    '    --column name:string:not-null \\',
    '    --column age:integer',
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runCli({ args: process.argv.slice(2) });
  process.exit(result.exitCode);
}
