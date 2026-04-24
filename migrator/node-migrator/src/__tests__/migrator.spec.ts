import { context } from './types';
import {
  Migrator,
  Dict,
} from '..';

describe('Migrator', () => {
  context('when no test is present', {
    definitions() {
      // overwrites
    },
    tests() {
      it('still passes', () => {
        expect(true).toBeTruthy();
      });
    },
  });

});
