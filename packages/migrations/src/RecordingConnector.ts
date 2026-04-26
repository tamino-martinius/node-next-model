import {
  type AggregateKind,
  type AlterTableOp,
  type AlterTableSpec,
  type BaseType,
  type Connector,
  type DeltaUpdateSpec,
  type Dict,
  defineTable,
  foreignKeyName,
  type KeyType,
  type Scope,
  type TableBuilder,
  type TableDefinition,
  type UpsertSpec,
} from '@next-model/core';

import { IrreversibleMigrationError } from './errors.js';

type RecordedOp =
  | {
      kind: 'createTable';
      tableName: string;
      blueprint: (t: TableBuilder) => void;
      definition: TableDefinition;
    }
  | { kind: 'dropTable'; tableName: string }
  | { kind: 'alterTable'; spec: AlterTableSpec };

/**
 * Connector wrapper that captures every schema-mutating call without executing
 * any of them. Used by the migrator to derive a reversible `down()` path from a
 * single `change()` block — the change runs against this wrapper to populate
 * `recorded`, and the migrator inverts each entry when rolling back.
 *
 * Data-path methods (query / count / select / updateAll / deleteAll /
 * batchInsert / aggregate / execute / transaction / hasTable) are intentionally
 * unsupported: a reversible migration must describe declarative shape changes
 * only. If a migration needs to read or mutate data, write explicit
 * `up()` / `down()` instead.
 */
export class RecordingConnector implements Connector {
  readonly recorded: RecordedOp[] = [];

  async createTable(tableName: string, blueprint: (t: TableBuilder) => void): Promise<void> {
    const definition = defineTable(tableName, blueprint);
    this.recorded.push({ kind: 'createTable', tableName, blueprint, definition });
  }

  async dropTable(tableName: string): Promise<void> {
    this.recorded.push({ kind: 'dropTable', tableName });
  }

  async alterTable(spec: AlterTableSpec): Promise<void> {
    this.recorded.push({ kind: 'alterTable', spec });
  }

  // Data-path methods are not callable from a reversible change block.
  async query(_scope: Scope): Promise<Dict<any>[]> {
    throw new Error(
      'Reversible change() block cannot query data. Use up()/down() for data-touching migrations.',
    );
  }
  async count(_scope: Scope): Promise<number> {
    throw new Error(
      'Reversible change() block cannot count rows. Use up()/down() for data-touching migrations.',
    );
  }
  async select(_scope: Scope, ..._keys: string[]): Promise<Dict<any>[]> {
    throw new Error(
      'Reversible change() block cannot select rows. Use up()/down() for data-touching migrations.',
    );
  }
  async updateAll(_scope: Scope, _attrs: Partial<Dict<any>>): Promise<Dict<any>[]> {
    throw new Error(
      'Reversible change() block cannot update rows. Use up()/down() for data-touching migrations.',
    );
  }
  async deleteAll(_scope: Scope): Promise<Dict<any>[]> {
    throw new Error(
      'Reversible change() block cannot delete rows. Use up()/down() for data-touching migrations.',
    );
  }
  async batchInsert(
    _tableName: string,
    _keys: Dict<KeyType>,
    _items: Dict<any>[],
  ): Promise<Dict<any>[]> {
    throw new Error(
      'Reversible change() block cannot insert rows. Use up()/down() for data-touching migrations.',
    );
  }
  async upsert(_spec: UpsertSpec): Promise<Dict<any>[]> {
    throw new Error(
      'Reversible change() block cannot upsert rows. Use up()/down() for data-touching migrations.',
    );
  }
  async deltaUpdate(_spec: DeltaUpdateSpec): Promise<number> {
    throw new Error(
      'Reversible change() block cannot apply deltaUpdate. Use up()/down() for data-touching migrations.',
    );
  }
  async execute(_query: string, _bindings: BaseType | BaseType[]): Promise<any[]> {
    throw new Error(
      'Reversible change() block cannot execute raw SQL. Use up()/down() for data-touching migrations.',
    );
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async aggregate(_scope: Scope, _kind: AggregateKind, _key: string): Promise<number | undefined> {
    throw new Error(
      'Reversible change() block cannot aggregate. Use up()/down() for data-touching migrations.',
    );
  }
  async hasTable(_tableName: string): Promise<boolean> {
    throw new Error(
      'Reversible change() block cannot probe table existence. Use up()/down() instead.',
    );
  }
}

/**
 * Replay the recorded operations against a real connector to perform the
 * forward (up) migration. Used by the migrator when running a `change()` —
 * the change runs against a `RecordingConnector` first to populate the list,
 * then this replays it on the real connector for actual execution.
 */
export async function replayUp(connector: Connector, ops: readonly RecordedOp[]): Promise<void> {
  for (const op of ops) {
    switch (op.kind) {
      case 'createTable':
        await connector.createTable(op.tableName, op.blueprint);
        break;
      case 'dropTable':
        await connector.dropTable(op.tableName);
        break;
      case 'alterTable':
        await connector.alterTable(op.spec);
        break;
    }
  }
}

/**
 * Replay the inverse of the recorded operations on a real connector to perform
 * the reverse (down) migration. Operations are inverted individually, then the
 * resulting list is reversed so the most-recent forward op rolls back first.
 *
 * Throws `IrreversibleMigrationError` for ops that can't be auto-inverted
 * (`dropTable`, `removeColumn`, `removeIndex`, `removeForeignKey`,
 * `removeCheckConstraint`, and `changeColumn` without a `previous` snapshot).
 */
export async function replayDown(
  connector: Connector,
  version: string,
  ops: readonly RecordedOp[],
): Promise<void> {
  const inverted = invertOps(version, ops);
  for (const op of inverted) {
    switch (op.kind) {
      case 'createTable':
        await connector.createTable(op.tableName, op.blueprint);
        break;
      case 'dropTable':
        await connector.dropTable(op.tableName);
        break;
      case 'alterTable':
        if (op.spec.ops.length > 0) await connector.alterTable(op.spec);
        break;
    }
  }
}

function invertOps(version: string, ops: readonly RecordedOp[]): RecordedOp[] {
  const inverted: RecordedOp[] = [];
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    inverted.push(invertOp(version, ops[i]));
  }
  return inverted;
}

function invertOp(version: string, op: RecordedOp): RecordedOp {
  switch (op.kind) {
    case 'createTable':
      return { kind: 'dropTable', tableName: op.tableName };
    case 'dropTable':
      throw new IrreversibleMigrationError(
        version,
        `dropTable('${op.tableName}')`,
        'dropping a table loses its schema',
      );
    case 'alterTable':
      return {
        kind: 'alterTable',
        spec: {
          tableName: op.spec.tableName,
          ops: invertAlterOps(version, op.spec.tableName, op.spec.ops),
        },
      };
  }
}

function invertAlterOps(
  version: string,
  tableName: string,
  ops: readonly AlterTableOp[],
): AlterTableOp[] {
  const result: AlterTableOp[] = [];
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    result.push(invertAlterOp(version, tableName, ops[i]));
  }
  return result;
}

function invertAlterOp(version: string, tableName: string, op: AlterTableOp): AlterTableOp {
  switch (op.op) {
    case 'addColumn':
      return { op: 'removeColumn', name: op.name };
    case 'removeColumn':
      throw new IrreversibleMigrationError(
        version,
        `removeColumn('${tableName}', '${op.name}')`,
        'the original column type and options are lost',
      );
    case 'renameColumn':
      return { op: 'renameColumn', from: op.to, to: op.from };
    case 'changeColumn':
      if (!op.previous) {
        throw new IrreversibleMigrationError(
          version,
          `changeColumn('${tableName}', '${op.name}')`,
          'pass the previous ColumnDefinition via the third argument so the inverse can be derived',
        );
      }
      return {
        op: 'changeColumn',
        name: op.previous.name,
        type: op.previous.type,
        options: {
          null: op.previous.nullable,
          default: op.previous.default,
          limit: op.previous.limit,
          primary: op.previous.primary,
          unique: op.previous.unique,
          precision: op.previous.precision,
          scale: op.previous.scale,
          autoIncrement: op.previous.autoIncrement,
        },
      };
    case 'addIndex':
      return {
        op: 'removeIndex',
        nameOrColumns: op.name ?? op.columns,
      };
    case 'removeIndex':
      throw new IrreversibleMigrationError(
        version,
        `removeIndex('${tableName}', ${JSON.stringify(op.nameOrColumns)})`,
        'the dropped index columns + uniqueness flag are lost',
      );
    case 'renameIndex':
      return { op: 'renameIndex', from: op.to, to: op.from };
    case 'addForeignKey':
      return {
        op: 'removeForeignKey',
        nameOrTable: op.name ?? foreignKeyName(tableName, op.toTable),
      };
    case 'removeForeignKey':
      throw new IrreversibleMigrationError(
        version,
        `removeForeignKey('${tableName}', '${op.nameOrTable}')`,
        'the referenced table + on-delete/on-update behaviour are lost',
      );
    case 'addCheckConstraint':
      if (!op.name) {
        throw new IrreversibleMigrationError(
          version,
          `addCheckConstraint('${tableName}', ${JSON.stringify(op.expression)})`,
          'the constraint must have a name so the inverse can target it',
        );
      }
      return { op: 'removeCheckConstraint', name: op.name };
    case 'removeCheckConstraint':
      throw new IrreversibleMigrationError(
        version,
        `removeCheckConstraint('${tableName}', '${op.name}')`,
        'the original predicate is lost',
      );
  }
}
