class TableBuilderImpl {
    constructor() {
        this.columns = [];
        this.indexes = [];
    }
    column(name, type, options = {}) {
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
        });
        return this;
    }
    string(name, options) {
        return this.column(name, 'string', options);
    }
    text(name, options) {
        return this.column(name, 'text', options);
    }
    integer(name, options) {
        return this.column(name, 'integer', options);
    }
    bigint(name, options) {
        return this.column(name, 'bigint', options);
    }
    float(name, options) {
        return this.column(name, 'float', options);
    }
    decimal(name, options) {
        return this.column(name, 'decimal', options);
    }
    boolean(name, options) {
        return this.column(name, 'boolean', options);
    }
    date(name, options) {
        return this.column(name, 'date', options);
    }
    datetime(name, options) {
        return this.column(name, 'timestamp', options);
    }
    timestamp(name, options) {
        return this.column(name, 'timestamp', options);
    }
    json(name, options) {
        return this.column(name, 'json', options);
    }
    timestamps(options = {}) {
        const nullable = options.null ?? false;
        this.column('created_at', 'timestamp', { null: nullable, default: 'currentTimestamp' });
        this.column('updated_at', 'timestamp', { null: nullable, default: 'currentTimestamp' });
        return this;
    }
    index(columns, options = {}) {
        this.indexes.push({
            columns: Array.isArray(columns) ? columns : [columns],
            name: options.name,
            unique: options.unique ?? false,
        });
        return this;
    }
}
export function defineTable(name, blueprint) {
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
//# sourceMappingURL=schema.js.map