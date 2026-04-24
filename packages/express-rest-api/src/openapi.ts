import type { ColumnKind } from '@next-model/core';

import type { ActionName } from './types.js';

export interface OpenApiFieldDef {
  /** `ColumnKind` from the schema DSL, or a raw JSON-schema `type` string. */
  type: ColumnKind | 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
  /** `format: 'date-time'` etc. propagates straight into the generated schema. */
  format?: string;
  /** Pass-through enum for literal unions. */
  enum?: readonly (string | number)[];
  nullable?: boolean;
  description?: string;
}

export interface OpenApiResource {
  /** Singular PascalCase name — `'User'`. */
  name: string;
  /** Plural route segment — `'users'`. */
  pluralPath: string;
  /** Fully qualified base path for this resource, e.g. `/api/users`. */
  basePath: string;
  /** Field map; each entry becomes a schema property. */
  fields: Record<string, OpenApiFieldDef>;
  /** Primary key field name (defaults to `id`). */
  idField?: string;
  /** Actions to include — defaults to every default action. */
  actions?: readonly ActionName[];
  /** Optional resource description for the collection tag. */
  description?: string;
}

export interface OpenApiServerConfig {
  url: string;
  description?: string;
}

export interface BuildOpenApiDocumentOptions {
  /** `info.title`. */
  title: string;
  /** `info.version`. */
  version: string;
  /** `info.description` (optional). */
  description?: string;
  /** `servers: [...]` — required because it can't be derived from the resources alone. */
  servers?: OpenApiServerConfig[];
  resources: OpenApiResource[];
}

export const DEFAULT_ACTION_SET: readonly ActionName[] = Object.freeze([
  'index',
  'show',
  'create',
  'update',
  'delete',
  'count',
  'first',
  'last',
]);

const COLUMN_KIND_TO_JSON_SCHEMA: Record<string, { type: string; format?: string }> = {
  string: { type: 'string' },
  text: { type: 'string' },
  integer: { type: 'integer' },
  bigint: { type: 'integer', format: 'int64' },
  float: { type: 'number' },
  decimal: { type: 'number' },
  boolean: { type: 'boolean' },
  date: { type: 'string', format: 'date' },
  datetime: { type: 'string', format: 'date-time' },
  timestamp: { type: 'string', format: 'date-time' },
  json: { type: 'object' },
  array: { type: 'array' },
  object: { type: 'object' },
  number: { type: 'number' },
};

interface JsonSchema {
  type: string | string[];
  format?: string;
  enum?: readonly (string | number)[];
  description?: string;
}

function fieldToSchema(field: OpenApiFieldDef): JsonSchema {
  const mapping = COLUMN_KIND_TO_JSON_SCHEMA[field.type] ?? { type: 'string' };
  const schema: JsonSchema = { type: mapping.type };
  if (mapping.format) schema.format = mapping.format;
  if (field.format) schema.format = field.format;
  if (field.enum) schema.enum = field.enum;
  if (field.description) schema.description = field.description;
  if (field.nullable) schema.type = [schema.type as string, 'null'];
  return schema;
}

function buildResourceSchemas(resource: OpenApiResource): Record<string, unknown> {
  const idField = resource.idField ?? 'id';
  const idDef = resource.fields[idField];

  const rowProperties: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(resource.fields)) {
    rowProperties[name] = fieldToSchema(def);
  }

  const createProperties: Record<string, unknown> = {};
  const updateProperties: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(resource.fields)) {
    if (name === idField) continue;
    createProperties[name] = fieldToSchema(def);
    updateProperties[name] = fieldToSchema({ ...def, nullable: true });
  }

  const filterProperties: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(resource.fields)) {
    filterProperties[name] = fieldToSchema({ ...def, nullable: true });
  }

  const rowRequired = Object.entries(resource.fields)
    .filter(([, def]) => !def.nullable)
    .map(([name]) => name);

  return {
    [resource.name]: {
      type: 'object',
      properties: rowProperties,
      required: rowRequired,
    },
    [`${resource.name}CreateInput`]: {
      type: 'object',
      properties: createProperties,
      required: Object.entries(resource.fields)
        .filter(([name, def]) => name !== idField && !def.nullable)
        .map(([name]) => name),
    },
    [`${resource.name}UpdateInput`]: {
      type: 'object',
      properties: updateProperties,
    },
    [`${resource.name}FilterInput`]: {
      type: 'object',
      properties: filterProperties,
    },
    [`${resource.name}List`]: {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: `#/components/schemas/${resource.name}` },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            perPage: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
            hasMore: { type: 'boolean' },
            nextCursor: { type: 'string' },
            prevCursor: { type: 'string' },
          },
        },
      },
    },
    ...(idDef
      ? {}
      : {
          [`${resource.name}IdPath`]: {
            type: 'integer',
          },
        }),
  };
}

const COMMON_ERROR_SCHEMA = {
  type: 'object',
  required: ['error', 'message'],
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
};

function commonResponses() {
  return {
    '400': {
      description: 'Bad request (invalid query string).',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
    '401': {
      description: 'Unauthorized (authorize callback rejected the request).',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
    '404': {
      description: 'Not found.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
    '422': {
      description: 'Validation error.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
  };
}

function buildCollectionParameters(resource: OpenApiResource) {
  return [
    {
      in: 'query',
      name: 'filter',
      schema: { type: 'string', description: 'JSON-encoded filter, e.g. {"name":"Ada"}' },
    },
    {
      in: 'query',
      name: 'order',
      schema: { type: 'string', description: 'CSV of keys; prefix with `-` for desc.' },
    },
    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1 } },
    { in: 'query', name: 'skip', schema: { type: 'integer', minimum: 0 } },
    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
    { in: 'query', name: 'perPage', schema: { type: 'integer', minimum: 1 } },
    { in: 'query', name: 'after', schema: { type: 'string' } },
    { in: 'query', name: 'before', schema: { type: 'string' } },
  ].filter((_param) => resource.fields); // no-op filter keeps the TS type
}

function buildPathsForResource(resource: OpenApiResource): Record<string, unknown> {
  const actions = new Set(resource.actions ?? DEFAULT_ACTION_SET);
  const idField = resource.idField ?? 'id';
  const idSchema = resource.fields[idField]
    ? fieldToSchema({ ...resource.fields[idField], nullable: false })
    : { type: 'integer' };
  const tag = resource.name;
  const paths: Record<string, unknown> = {};
  const collection: Record<string, unknown> = {};
  const member: Record<string, unknown> = {};

  if (actions.has('index')) {
    collection.get = {
      tags: [tag],
      summary: `List ${resource.pluralPath}`,
      parameters: buildCollectionParameters(resource),
      responses: {
        '200': {
          description: `Array of ${resource.name}, or a paginated envelope when page/after/before is present.`,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { type: 'array', items: { $ref: `#/components/schemas/${resource.name}` } },
                  { $ref: `#/components/schemas/${resource.name}List` },
                ],
              },
            },
          },
        },
        ...commonResponses(),
      },
    };
  }
  if (actions.has('create')) {
    collection.post = {
      tags: [tag],
      summary: `Create a ${resource.name}`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${resource.name}CreateInput` },
          },
        },
      },
      responses: {
        '201': {
          description: `The persisted ${resource.name}.`,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${resource.name}` },
            },
          },
        },
        ...commonResponses(),
      },
    };
  }
  if (Object.keys(collection).length > 0) paths[resource.basePath] = collection;

  if (actions.has('count')) {
    paths[`${resource.basePath}/count`] = {
      get: {
        tags: [tag],
        summary: `Count ${resource.pluralPath}`,
        parameters: [
          {
            in: 'query',
            name: 'filter',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Record count.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['count'],
                  properties: { count: { type: 'integer' } },
                },
              },
            },
          },
          ...commonResponses(),
        },
      },
    };
  }

  for (const aggregate of ['first', 'last'] as const) {
    if (actions.has(aggregate)) {
      paths[`${resource.basePath}/${aggregate}`] = {
        get: {
          tags: [tag],
          summary: `${aggregate[0].toUpperCase()}${aggregate.slice(1)} ${resource.name} matching the current scope`,
          responses: {
            '200': {
              description: `A single ${resource.name} (or null).`,
              content: {
                'application/json': {
                  schema: {
                    oneOf: [{ $ref: `#/components/schemas/${resource.name}` }, { type: 'null' }],
                  },
                },
              },
            },
            ...commonResponses(),
          },
        },
      };
    }
  }

  const memberParam = {
    in: 'path',
    name: idField,
    required: true,
    schema: idSchema,
  };

  if (actions.has('show')) {
    member.get = {
      tags: [tag],
      summary: `Fetch a ${resource.name} by ${idField}`,
      parameters: [memberParam],
      responses: {
        '200': {
          description: `The ${resource.name}.`,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${resource.name}` } },
          },
        },
        ...commonResponses(),
      },
    };
  }
  if (actions.has('update')) {
    member.patch = {
      tags: [tag],
      summary: `Partially update a ${resource.name}`,
      parameters: [memberParam],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${resource.name}UpdateInput` },
          },
        },
      },
      responses: {
        '200': {
          description: `The persisted ${resource.name}.`,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${resource.name}` } },
          },
        },
        ...commonResponses(),
      },
    };
  }
  if (actions.has('delete')) {
    member.delete = {
      tags: [tag],
      summary: `Delete a ${resource.name}`,
      parameters: [memberParam],
      responses: {
        '204': { description: 'Deleted.' },
        ...commonResponses(),
      },
    };
  }
  if (Object.keys(member).length > 0) paths[`${resource.basePath}/{${idField}}`] = member;

  return paths;
}

export function buildOpenApiDocument(
  options: BuildOpenApiDocumentOptions,
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = { Error: COMMON_ERROR_SCHEMA };
  const tags: Array<{ name: string; description?: string }> = [];

  for (const resource of options.resources) {
    Object.assign(paths, buildPathsForResource(resource));
    Object.assign(schemas, buildResourceSchemas(resource));
    tags.push({ name: resource.name, description: resource.description });
  }

  const doc: Record<string, unknown> = {
    openapi: '3.1.0',
    info: { title: options.title, version: options.version, description: options.description },
    paths,
    components: { schemas },
    tags,
  };
  if (options.servers) doc.servers = options.servers;
  return doc;
}
