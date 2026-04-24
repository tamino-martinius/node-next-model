import type { ColumnStub, GeneratedMigration, GenerateOptions } from './types.js';

const DEFAULT_CORE_SPEC = '@next-model/core';

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** `2026-04-24 13:45:12.987` → `20260424134512987` */
export function timestampFromDate(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    pad(date.getUTCMilliseconds(), 3)
  );
}

export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: stripping diacritics
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'migration'
  );
}

function renderDefault(value: string | number | boolean | null | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function columnOptionsLiteral(col: ColumnStub): string {
  const parts: string[] = [];
  if (col.primary) parts.push('primary: true');
  if (col.autoIncrement) parts.push('autoIncrement: true');
  if (col.nullable === false) parts.push('null: false');
  if (col.nullable === true) parts.push('null: true');
  const rendered = renderDefault(col.default);
  if (rendered !== undefined) parts.push(`default: ${rendered}`);
  return parts.length === 0 ? '' : `, { ${parts.join(', ')} }`;
}

function columnKind(col: ColumnStub): string {
  const kind = col.type ?? 'string';
  const supported = new Set([
    'integer',
    'bigint',
    'float',
    'string',
    'text',
    'boolean',
    'date',
    'datetime',
    'json',
  ]);
  return supported.has(kind) ? kind : 'string';
}

function defaultCreateColumns(): ColumnStub[] {
  return [{ name: 'id', type: 'integer', primary: true, autoIncrement: true, nullable: false }];
}

function renderCreateTableBody(
  tableName: string,
  columns: ColumnStub[],
  timestamps: boolean,
): string {
  const lines = columns.map(
    (col) => `      t.${columnKind(col)}('${col.name}'${columnOptionsLiteral(col)});`,
  );
  if (timestamps) {
    lines.push(`      t.datetime('createdAt');`);
    lines.push(`      t.datetime('updatedAt');`);
  }
  return [
    `    await connector.createTable('${tableName}', (t) => {`,
    lines.join('\n'),
    `    });`,
  ].join('\n');
}

function renderDropTable(tableName: string): string {
  return `    await connector.dropTable('${tableName}');`;
}

function renderParents(parents?: string[]): string {
  if (!parents || parents.length === 0) return '';
  const entries = parents.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(', ');
  return `  parent: [${entries}],\n`;
}

export function generateMigration(options: GenerateOptions): GeneratedMigration {
  const now = options.now ?? new Date();
  const version = options.version ?? timestampFromDate(now);
  const slug = slugify(options.name);
  const coreSpec = options.coreSpec ?? DEFAULT_CORE_SPEC;

  const createTable = options.createTable;
  const upBody = createTable
    ? renderCreateTableBody(
        createTable.tableName,
        createTable.columns ?? defaultCreateColumns(),
        createTable.timestamps ?? true,
      )
    : '    // TODO: apply schema changes';
  const downBody = createTable
    ? renderDropTable(createTable.tableName)
    : '    // TODO: revert schema changes';

  const contents = `import type { Connector } from '${coreSpec}';
import type { Migration } from '@next-model/migrations';

const migration: Migration = {
  version: '${version}',
  name: '${slug}',
${renderParents(options.parents)}  async up(connector: Connector): Promise<void> {
${upBody}
  },

  async down(connector: Connector): Promise<void> {
${downBody}
  },
};

export default migration;
`;

  return {
    version,
    name: slug,
    fileName: `${version}_${slug}.ts`,
    contents,
  };
}
