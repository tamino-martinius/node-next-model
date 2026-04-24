export type ColumnKind = 'string' | 'text' | 'integer' | 'bigint' | 'float' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'timestamp' | 'json';
export type ColumnDefault = string | number | boolean | Date | null | 'currentTimestamp';
export interface ColumnOptions {
    null?: boolean;
    default?: ColumnDefault;
    limit?: number;
    primary?: boolean;
    unique?: boolean;
    precision?: number;
    scale?: number;
}
export interface IndexOptions {
    name?: string;
    unique?: boolean;
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
    timestamps(options?: {
        null?: boolean;
    }): this;
    index(columns: string | string[], options?: IndexOptions): this;
}
export declare function defineTable(name: string, blueprint: (t: TableBuilder) => void): TableDefinition;
//# sourceMappingURL=schema.d.ts.map