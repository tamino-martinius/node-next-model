import type { Filter, NextModelError } from '..';

export interface Context {
  definitions: () => void;
  tests: () => void;
  reset?: () => void;
}

export interface FilterSpecs {
  filter: Filter<any> | undefined;
  results: number[] | (new (...args: any[]) => NextModelError);
}

export interface FilterSpecGroup {
  [key: string]: FilterSpecs[];
}
