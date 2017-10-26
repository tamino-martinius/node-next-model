import {
  Model,
  NextModel,
  Query,
} from '../next_model';

import {
  Storage,
  DefaultConnector,
} from '../connector';

import {
  context,
} from './types';

let storage: Storage | undefined  = undefined;
let connector = () => new DefaultConnector(storage);

beforeEach(() => {
  storage = undefined;
})

describe('DefaultConnector', () => {
  describe('#reload', () => {
    pending('not yet implemented');
  });

  describe('#insert', () => {
    pending('not yet implemented');
  });

  describe('#update', () => {
    pending('not yet implemented');
  });

  describe('#delete', () => {
    pending('not yet implemented');
  });
});
