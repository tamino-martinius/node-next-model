import * as Knex from 'knex';

import { Filter } from '@next-model/core';

export interface Context {
  definitions: () => void;
  tests: () => void;
  reset?: () => void;
}

export type Connection = Knex.Sqlite3ConnectionConfig | Knex.MySqlConnectionConfig;

export interface FilterSpecs {
  filter: () => Filter<any> | undefined;
  results: (() => number[]) | string;
}

export interface FilterSpecGroup {
  [key: string]: FilterSpecs[];
}
