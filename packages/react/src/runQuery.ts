import { NotFoundError } from '@next-model/core';
import type { ReactiveQuery, TerminalKind } from './ReactiveQuery.js';

export async function runQuery(
  query: ReactiveQuery<{ tableName: string }>,
  terminal: TerminalKind,
  terminalArgs: unknown[],
): Promise<unknown> {
  let scope: any = query.plan.ModelClass;
  for (const step of query.plan.steps) {
    scope = scope[step.method](...step.args);
  }
  switch (terminal) {
    case 'all': return scope.all();
    case 'first': return scope.first();
    case 'last': return scope.last();
    case 'find': try { return await scope.find(...terminalArgs); } catch (e) { if (e instanceof NotFoundError) return undefined; throw e; }
    case 'findBy': return scope.findBy(...terminalArgs);
    case 'findOrFail': return scope.findOrFail(...terminalArgs);
    case 'count': return scope.count();
    case 'sum': return scope.sum(...terminalArgs);
    case 'min': return scope.min(...terminalArgs);
    case 'max': return scope.max(...terminalArgs);
    case 'avg': return scope.avg(...terminalArgs);
    case 'pluck': return scope.pluck(...terminalArgs);
    case 'exists': return scope.exists();
    case 'build': throw new Error('runQuery is for async terminals only — build is sync');
  }
}
