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
