export type ColumnKind =
  | 'string'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'json';

export type ColumnDefault = string | number | boolean | Date | null | 'currentTimestamp';

export interface ColumnOptions {
  null?: boolean;
  default?: ColumnDefault;
  limit?: number;
  primary?: boolean;
  unique?: boolean;
  precision?: number;
  scale?: number;
  autoIncrement?: boolean;
}

export interface IndexOptions {
  name?: string;
  unique?: boolean;
}

export interface ReferencesOptions {
  null?: boolean;
  unique?: boolean;
  index?: boolean | IndexOptions;
  column?: string;
}

export interface ColumnDefinition {
  name: string;
  type: ColumnKind;
  nullable: boolean;
  default?: ColumnDefault;
  limit?: number;
  primary: boolean;
  unique: boolean;
  precision?: number;
  scale?: number;
  autoIncrement: boolean;
}

export interface IndexDefinition {
  columns: string[];
  name?: string;
  unique: boolean;
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  primaryKey?: string;
  /** Associations declared at the schema level. Mirrors `TypedTable.associations`. */
  associations?: Record<string, unknown>;
}

export interface TableBuilder {
  column(name: string, type: ColumnKind, options?: ColumnOptions): this;
  string(name: string, options?: ColumnOptions): this;
  text(name: string, options?: ColumnOptions): this;
  integer(name: string, options?: ColumnOptions): this;
  bigint(name: string, options?: ColumnOptions): this;
  float(name: string, options?: ColumnOptions): this;
  decimal(name: string, options?: ColumnOptions): this;
  boolean(name: string, options?: ColumnOptions): this;
  date(name: string, options?: ColumnOptions): this;
  datetime(name: string, options?: ColumnOptions): this;
  timestamp(name: string, options?: ColumnOptions): this;
  json(name: string, options?: ColumnOptions): this;
  timestamps(options?: { null?: boolean }): this;
  index(columns: string | string[], options?: IndexOptions): this;
  references(name: string, options?: ReferencesOptions): this;
}

class TableBuilderImpl implements TableBuilder {
  readonly columns: ColumnDefinition[] = [];
  readonly indexes: IndexDefinition[] = [];

  column(name: string, type: ColumnKind, options: ColumnOptions = {}): this {
    this.columns.push({
      name,
      type,
      nullable: options.null ?? true,
      default: options.default,
      limit: options.limit,
      primary: options.primary ?? false,
      unique: options.unique ?? false,
      precision: options.precision,
      scale: options.scale,
      autoIncrement: options.autoIncrement ?? false,
    });
    return this;
  }

  string(name: string, options?: ColumnOptions): this {
    return this.column(name, 'string', options);
  }
  text(name: string, options?: ColumnOptions): this {
    return this.column(name, 'text', options);
  }
  integer(name: string, options?: ColumnOptions): this {
    return this.column(name, 'integer', options);
  }
  bigint(name: string, options?: ColumnOptions): this {
    return this.column(name, 'bigint', options);
  }
  float(name: string, options?: ColumnOptions): this {
    return this.column(name, 'float', options);
  }
  decimal(name: string, options?: ColumnOptions): this {
    return this.column(name, 'decimal', options);
  }
  boolean(name: string, options?: ColumnOptions): this {
    return this.column(name, 'boolean', options);
  }
  date(name: string, options?: ColumnOptions): this {
    return this.column(name, 'date', options);
  }
  datetime(name: string, options?: ColumnOptions): this {
    return this.column(name, 'timestamp', options);
  }
  timestamp(name: string, options?: ColumnOptions): this {
    return this.column(name, 'timestamp', options);
  }
  json(name: string, options?: ColumnOptions): this {
    return this.column(name, 'json', options);
  }

  timestamps(options: { null?: boolean } = {}): this {
    const nullable = options.null ?? false;
    this.column('created_at', 'timestamp', { null: nullable, default: 'currentTimestamp' });
    this.column('updated_at', 'timestamp', { null: nullable, default: 'currentTimestamp' });
    return this;
  }

  index(columns: string | string[], options: IndexOptions = {}): this {
    this.indexes.push({
      columns: Array.isArray(columns) ? columns : [columns],
      name: options.name,
      unique: options.unique ?? false,
    });
    return this;
  }

  references(name: string, options: ReferencesOptions = {}): this {
    const columnName = options.column ?? `${name}Id`;
    this.column(columnName, 'integer', { null: options.null ?? false, unique: options.unique });
    const indexOpt = options.index ?? true;
    if (indexOpt !== false) {
      const indexOptions: IndexOptions = typeof indexOpt === 'object' ? indexOpt : {};
      this.index(columnName, indexOptions);
    }
    return this;
  }
}

export function defineTable(name: string, blueprint: (t: TableBuilder) => void): TableDefinition {
  const builder = new TableBuilderImpl();
  blueprint(builder);
  const primaryKey = builder.columns.find((c) => c.primary)?.name;
  return {
    name,
    columns: builder.columns,
    indexes: builder.indexes,
    primaryKey,
  };
}

export type ForeignKeyAction = 'cascade' | 'restrict' | 'setNull' | 'setDefault' | 'noAction';

export interface ForeignKeyOptions {
  /** Local column. Defaults to `${refTable}Id` (camelCase singular). */
  column?: string;
  /** Referenced column on the target table. Defaults to the target's primary key. */
  primaryKey?: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
  /** Constraint name. Auto-generated as `fk_<table>_<refTable>` when omitted. */
  name?: string;
}

export interface ForeignKeyDefinition {
  column: string;
  toTable: string;
  primaryKey?: string;
  onDelete?: ForeignKeyAction;
  onUpdate?: ForeignKeyAction;
  name?: string;
}

export interface CheckConstraintOptions {
  name?: string;
}

export interface CheckConstraintDefinition {
  expression: string;
  name?: string;
}

export interface RemoveIndexOptions {
  /** Match by stored index name when provided. Otherwise the columns array is used. */
  name?: string;
  columns?: string[];
}

export interface AddReferenceOptions {
  /** Local column. Defaults to `${refName}Id`. */
  column?: string;
  /** Whether the column may be NULL. Defaults to `false`. */
  null?: boolean;
  /** Add a UNIQUE constraint to the local column. */
  unique?: boolean;
  /** Index the local column. Pass an `IndexOptions` object to customise. Defaults to `true`. */
  index?: boolean | IndexOptions;
  /** Add a foreign-key constraint pointing at `refName`. Defaults to `false`. */
  foreignKey?: boolean | ForeignKeyOptions;
}

export type AlterTableOp =
  | { op: 'addColumn'; name: string; type: ColumnKind; options?: ColumnOptions }
  | { op: 'removeColumn'; name: string }
  | { op: 'renameColumn'; from: string; to: string }
  | {
      op: 'changeColumn';
      name: string;
      type: ColumnKind;
      options?: ColumnOptions;
      /** Original column definition, captured so `down()` can restore it. */
      previous?: ColumnDefinition;
    }
  | {
      op: 'addIndex';
      columns: string[];
      unique?: boolean;
      name?: string;
      where?: string;
    }
  | { op: 'removeIndex'; nameOrColumns: string | string[] }
  | { op: 'renameIndex'; from: string; to: string }
  | ({ op: 'addForeignKey'; toTable: string } & ForeignKeyOptions)
  | { op: 'removeForeignKey'; nameOrTable: string }
  | { op: 'addCheckConstraint'; expression: string; name?: string }
  | { op: 'removeCheckConstraint'; name: string };

export interface AlterTableSpec {
  tableName: string;
  ops: AlterTableOp[];
}

export interface AlterTableBuilder {
  addColumn(name: string, type: ColumnKind, options?: ColumnOptions): this;
  removeColumn(name: string): this;
  renameColumn(from: string, to: string): this;
  changeColumn(
    name: string,
    type: ColumnKind,
    options?: ColumnOptions,
    previous?: ColumnDefinition,
  ): this;
  addIndex(columns: string | string[], options?: IndexOptions & { where?: string }): this;
  removeIndex(nameOrColumns: string | string[]): this;
  renameIndex(from: string, to: string): this;
  addForeignKey(toTable: string, options?: ForeignKeyOptions): this;
  removeForeignKey(nameOrTable: string): this;
  addCheckConstraint(expression: string, options?: CheckConstraintOptions): this;
  removeCheckConstraint(name: string): this;
  addReference(refName: string, options?: AddReferenceOptions): this;
  removeReference(refName: string, options?: { column?: string }): this;
}

class AlterTableBuilderImpl implements AlterTableBuilder {
  readonly ops: AlterTableOp[] = [];

  addColumn(name: string, type: ColumnKind, options?: ColumnOptions): this {
    this.ops.push({ op: 'addColumn', name, type, options });
    return this;
  }

  removeColumn(name: string): this {
    this.ops.push({ op: 'removeColumn', name });
    return this;
  }

  renameColumn(from: string, to: string): this {
    this.ops.push({ op: 'renameColumn', from, to });
    return this;
  }

  changeColumn(
    name: string,
    type: ColumnKind,
    options?: ColumnOptions,
    previous?: ColumnDefinition,
  ): this {
    this.ops.push({ op: 'changeColumn', name, type, options, previous });
    return this;
  }

  addIndex(columns: string | string[], options: IndexOptions & { where?: string } = {}): this {
    this.ops.push({
      op: 'addIndex',
      columns: Array.isArray(columns) ? columns : [columns],
      unique: options.unique,
      name: options.name,
      where: options.where,
    });
    return this;
  }

  removeIndex(nameOrColumns: string | string[]): this {
    this.ops.push({ op: 'removeIndex', nameOrColumns });
    return this;
  }

  renameIndex(from: string, to: string): this {
    this.ops.push({ op: 'renameIndex', from, to });
    return this;
  }

  addForeignKey(toTable: string, options: ForeignKeyOptions = {}): this {
    this.ops.push({
      op: 'addForeignKey',
      toTable,
      column: options.column,
      primaryKey: options.primaryKey,
      onDelete: options.onDelete,
      onUpdate: options.onUpdate,
      name: options.name,
    });
    return this;
  }

  removeForeignKey(nameOrTable: string): this {
    this.ops.push({ op: 'removeForeignKey', nameOrTable });
    return this;
  }

  addCheckConstraint(expression: string, options: CheckConstraintOptions = {}): this {
    this.ops.push({ op: 'addCheckConstraint', expression, name: options.name });
    return this;
  }

  removeCheckConstraint(name: string): this {
    this.ops.push({ op: 'removeCheckConstraint', name });
    return this;
  }

  addReference(refName: string, options: AddReferenceOptions = {}): this {
    const columnName = options.column ?? `${refName}Id`;
    this.addColumn(columnName, 'integer', {
      null: options.null ?? false,
      unique: options.unique,
    });
    const indexOpt = options.index ?? true;
    if (indexOpt !== false) {
      const indexOptions: IndexOptions = typeof indexOpt === 'object' ? indexOpt : {};
      this.addIndex(columnName, indexOptions);
    }
    const fkOpt = options.foreignKey ?? false;
    if (fkOpt !== false) {
      const fkOptions: ForeignKeyOptions = typeof fkOpt === 'object' ? fkOpt : {};
      this.addForeignKey(refName, { column: columnName, ...fkOptions });
    }
    return this;
  }

  removeReference(refName: string, options: { column?: string } = {}): this {
    const columnName = options.column ?? `${refName}Id`;
    this.removeForeignKey(refName);
    this.removeColumn(columnName);
    return this;
  }
}

export function defineAlter(
  tableName: string,
  blueprint: (a: AlterTableBuilder) => void,
): AlterTableSpec {
  const builder = new AlterTableBuilderImpl();
  blueprint(builder);
  return { tableName, ops: builder.ops };
}

/**
 * Default foreign-key constraint name used when callers don't pass one.
 * Stable + readable so `removeForeignKey` can target it without bookkeeping.
 */
export function foreignKeyName(fromTable: string, toTable: string): string {
  return `fk_${fromTable}_${toTable}`;
}

/**
 * Default index name used when callers don't pass one — matches the SQLite
 * connector's existing convention so cross-driver behaviour is consistent.
 */
export function indexName(tableName: string, columns: string[]): string {
  return `idx_${tableName}_${columns.join('_')}`;
}

/** Apply a series of `AlterTableOp`s to a `TableDefinition`, returning a new definition. */
export function applyAlterOps(table: TableDefinition, ops: AlterTableOp[]): TableDefinition {
  let columns = [...table.columns];
  let indexes = [...table.indexes];

  for (const op of ops) {
    switch (op.op) {
      case 'addColumn': {
        if (columns.some((c) => c.name === op.name)) {
          throw new Error(`column ${op.name} already exists on table ${table.name}`);
        }
        columns.push(buildColumnDefinition(op.name, op.type, op.options));
        break;
      }
      case 'removeColumn': {
        columns = columns.filter((c) => c.name !== op.name);
        indexes = indexes.filter((i) => !i.columns.includes(op.name));
        break;
      }
      case 'renameColumn': {
        columns = columns.map((c) => (c.name === op.from ? { ...c, name: op.to } : c));
        indexes = indexes.map((idx) => ({
          ...idx,
          columns: idx.columns.map((c) => (c === op.from ? op.to : c)),
        }));
        break;
      }
      case 'changeColumn': {
        const next = buildColumnDefinition(op.name, op.type, op.options);
        columns = columns.map((c) => (c.name === op.name ? next : c));
        break;
      }
      case 'addIndex': {
        indexes.push({
          columns: op.columns,
          name: op.name,
          unique: op.unique ?? false,
        });
        break;
      }
      case 'removeIndex': {
        if (Array.isArray(op.nameOrColumns)) {
          const cols = op.nameOrColumns;
          indexes = indexes.filter((idx) => !arraysEqual(idx.columns, cols));
        } else {
          const target = op.nameOrColumns;
          indexes = indexes.filter(
            (idx) => idx.name !== target && !arraysEqual(idx.columns, [target]),
          );
        }
        break;
      }
      case 'renameIndex': {
        indexes = indexes.map((idx) => (idx.name === op.from ? { ...idx, name: op.to } : idx));
        break;
      }
      case 'addForeignKey':
      case 'removeForeignKey':
      case 'addCheckConstraint':
      case 'removeCheckConstraint':
        // Foreign keys and check constraints aren't part of the snapshot's
        // structural shape today — they live on the live database. Leave the
        // structural arrays alone; connectors still execute the DDL.
        break;
    }
  }

  const primaryKey = columns.find((c) => c.primary)?.name;
  return {
    name: table.name,
    columns,
    indexes,
    primaryKey,
  };
}

function buildColumnDefinition(
  name: string,
  type: ColumnKind,
  options: ColumnOptions = {},
): ColumnDefinition {
  return {
    name,
    type,
    nullable: options.null ?? true,
    default: options.default,
    limit: options.limit,
    primary: options.primary ?? false,
    unique: options.unique ?? false,
    precision: options.precision,
    scale: options.scale,
    autoIncrement: options.autoIncrement ?? false,
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
