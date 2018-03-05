import {
  NextModel,
} from '../next_model';

import {
  Schema,
  FilterProperty,
  Filter,
  Identifiable,
} from '../types';

import {
  Storage,
  Connector,
} from '../connector';

import {
  context,
} from './types';

import {
  Faker,
} from '../__mocks__/next_model';

let storage: Storage | undefined = undefined;
let connector = () => new Connector(storage);
let id: number;
const Model = NextModel<any>();

beforeEach(() => {
  storage = undefined;
});

