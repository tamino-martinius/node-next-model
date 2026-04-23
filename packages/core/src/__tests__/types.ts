import { Filter } from '..';

export interface Context {
  definitions: () => void;
  tests: () => void;
  reset?: () => void;
}

export interface FilterSpecs {
  filter: Filter<any> | undefined;
  results: number[] | string;
}

export interface FilterSpecGroup {
  [key: string]: FilterSpecs[];
}
