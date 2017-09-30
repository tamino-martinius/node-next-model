import {
  filter,
  orderBy,
  keys,
  values,
} from 'lodash';

import NextModel from '../NextModel';
import {
  Connector,
} from '../types';

export function mockConnector(data: NextModel[]): Connector {
  const all = (model) => {
    let result = filter(data, model.defaultScope);
    const order = model.defaultOrder;
    if (order) result = orderBy(result, keys(order), values(order));
    result = result.splice(model._skip, model._limit || Number.MAX_VALUE);
    return Promise.resolve(result);
  };
  const first = (model: typeof NextModel) => all(model).then(result => result[0]);
  const last = (model: typeof NextModel) => all(model).then(result => result[result.length - 1]);
  const count = (model: typeof NextModel) => all(model).then(result => result.length);
  const save = (model: NextModel) => Promise.resolve(model/*model.id = 1*/);
  return {
    all,
    first,
    last,
    count,
    save,
  };
};
