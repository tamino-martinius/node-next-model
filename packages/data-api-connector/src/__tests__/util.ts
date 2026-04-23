import { Context } from './types';

export const it = test;

export const context = (description: string, { definitions, tests, reset }: Context) => {
  describe(description, () => {
    beforeEach(definitions);
    tests();
    if (reset !== undefined) {
      afterEach(reset);
    }
  });
};

export function randomInteger(min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(Math.random() * (max - min))));
}
