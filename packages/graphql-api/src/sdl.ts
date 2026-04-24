import type { FieldDef, ResourceOptions } from './types.js';

export interface ResolvedNames {
  singular: string;
  plural: string;
  queryList: string;
  queryGet: string;
  queryCount: string;
  mutationCreate: string;
  mutationUpdate: string;
  mutationDelete: string;
  typeName: string;
  typeList: string;
  inputCreate: string;
  inputUpdate: string;
  inputFilter: string;
  inputOrder: string;
  inputOrderColumn: string;
  typeMeta: string;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function resolveNames(opts: ResourceOptions<unknown>): ResolvedNames {
  const singular = opts.name;
  const plural = opts.pluralName ?? `${singular}s`;
  return {
    singular,
    plural,
    queryList: lowerFirst(plural),
    queryGet: lowerFirst(singular),
    queryCount: `${lowerFirst(singular)}Count`,
    mutationCreate: `create${singular}`,
    mutationUpdate: `update${singular}`,
    mutationDelete: `delete${singular}`,
    typeName: singular,
    typeList: `${singular}List`,
    inputCreate: `${singular}CreateInput`,
    inputUpdate: `${singular}UpdateInput`,
    inputFilter: `${singular}FilterInput`,
    inputOrder: `${singular}OrderInput`,
    inputOrderColumn: `${singular}OrderColumn`,
    typeMeta: `${singular}ListMeta`,
  };
}

function stripNonNull(type: string): string {
  return type.replace(/!$/, '');
}

function includeInCreate(field: FieldDef): boolean {
  const flag = field.input;
  if (flag === false) return false;
  if (flag === 'update') return false;
  return true;
}

function includeInUpdate(field: FieldDef): boolean {
  const flag = field.input;
  if (flag === false) return false;
  if (flag === 'create') return false;
  return true;
}

function includeInFilter(field: FieldDef): boolean {
  return field.filter !== false;
}

function field(name: string, type: string): string {
  return `  ${name}: ${type}`;
}

export function buildTypeDefs(opts: ResourceOptions<unknown>, names: ResolvedNames): string {
  const idField = opts.idField ?? 'id';
  const idType = opts.idType ?? 'ID!';

  const fieldLines = [field(idField, idType)];
  for (const [key, def] of Object.entries(opts.fields)) {
    if (key === idField) continue;
    fieldLines.push(field(key, def.type));
  }

  const createLines: string[] = [];
  for (const [key, def] of Object.entries(opts.fields)) {
    if (key === idField) continue;
    if (!includeInCreate(def)) continue;
    createLines.push(field(key, def.type));
  }

  const updateLines: string[] = [];
  for (const [key, def] of Object.entries(opts.fields)) {
    if (key === idField) continue;
    if (!includeInUpdate(def)) continue;
    // All update-input fields are optional: we strip the trailing `!`.
    updateLines.push(field(key, stripNonNull(def.type)));
  }

  const filterLines: string[] = [];
  for (const [key, def] of Object.entries(opts.fields)) {
    if (!includeInFilter(def)) continue;
    filterLines.push(field(key, stripNonNull(def.type)));
  }
  if (includeInFilter(opts.fields[idField] ?? { type: idType })) {
    // Ensure the primary key is always filterable even if the user didn't
    // repeat it in `fields`.
    if (!opts.fields[idField]) {
      filterLines.unshift(field(idField, stripNonNull(idType)));
    }
  }

  const orderKeyUnion = Object.keys(opts.fields)
    .concat(opts.fields[idField] ? [] : [idField])
    .map((k) => `  ${k}`)
    .join('\n');

  return [
    `type ${names.typeName} {`,
    fieldLines.join('\n'),
    '}',
    '',
    `type ${names.typeMeta} {`,
    '  total: Int',
    '  page: Int',
    '  perPage: Int',
    '  totalPages: Int',
    '  hasNext: Boolean',
    '  hasPrev: Boolean',
    '  hasMore: Boolean',
    '  nextCursor: String',
    '  prevCursor: String',
    '}',
    '',
    `type ${names.typeList} {`,
    `  items: [${names.typeName}!]!`,
    `  meta: ${names.typeMeta}!`,
    '}',
    '',
    `input ${names.inputCreate} {`,
    createLines.join('\n'),
    '}',
    '',
    `input ${names.inputUpdate} {`,
    updateLines.join('\n'),
    '}',
    '',
    `input ${names.inputFilter} {`,
    filterLines.join('\n'),
    '}',
    '',
    `enum ${names.inputOrderColumn} {`,
    orderKeyUnion,
    '}',
    '',
    `enum ${names.singular}OrderDirection {`,
    '  ASC',
    '  DESC',
    '}',
    '',
    `input ${names.inputOrder} {`,
    `  key: ${names.inputOrderColumn}!`,
    `  dir: ${names.singular}OrderDirection`,
    '}',
  ].join('\n');
}

export function buildQueryExtension(opts: ResourceOptions<unknown>, names: ResolvedNames): string {
  const idType = opts.idType ?? 'ID!';
  const id = opts.idField ?? 'id';
  return [
    'extend type Query {',
    `  ${names.queryList}(`,
    `    filter: ${names.inputFilter}`,
    `    order: [${names.inputOrder}!]`,
    '    limit: Int',
    '    skip: Int',
    '    page: Int',
    '    perPage: Int',
    '    after: String',
    '    before: String',
    `  ): ${names.typeList}!`,
    `  ${names.queryGet}(${id}: ${stripNonNull(idType)}!): ${names.typeName}`,
    `  ${names.queryCount}(filter: ${names.inputFilter}): Int!`,
    '}',
  ].join('\n');
}

export function buildMutationExtension(
  opts: ResourceOptions<unknown>,
  names: ResolvedNames,
): string {
  const idType = opts.idType ?? 'ID!';
  const id = opts.idField ?? 'id';
  return [
    'extend type Mutation {',
    `  ${names.mutationCreate}(input: ${names.inputCreate}!): ${names.typeName}!`,
    `  ${names.mutationUpdate}(${id}: ${stripNonNull(idType)}!, input: ${names.inputUpdate}!): ${names.typeName}!`,
    `  ${names.mutationDelete}(${id}: ${stripNonNull(idType)}!): Boolean!`,
    '}',
  ].join('\n');
}
