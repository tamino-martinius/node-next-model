# NextModelLocalStorageConnector

LocalStorage connector for [NextModel](https://github.com/tamino-martinius/node-next-model) package.

 [![Build Status](https://travis-ci.org/tamino-martinius/node-next-model-local-storage-connector.svg?branch=master)](https://travis-ci.org/tamino-martinius/node-next-model-local-storage-connector)

Special keys for queries:
* $and
* $or
* $not
* $null
* $notNull
* $in
* $notIn
* $between
* $notBetween
* $eq
* $lt
* $lte
* $gt
* $gte
* $match
* $filter

### Roadmap / Where can i contribute

See [GitHub project](https://github.com/tamino-martinius/node-next-model-local-storage-connector/projects/1) for current progress/tasks

* Fix Typos
* Add more **examples**
* Add **exists**, **join** and **subqueries**
* There are already some **tests**, but not every test case is covered.

## TOC

* [Example](#example)
  * [Create Connector](#create-connector)
  * [Use Connector](#use-connector)
* [Build Queries](#build-queries)
  * [Where](#where)
  * [And](#and)
  * [Or](#or)
  * [Not](#not)
  * [Nesting](#nesting)
  * [Null](#null)
  * [NotNull](#notnull)
  * [Equation](#equation)
  * [In](#in)
  * [NotIn](#notin)
  * [Between](#between)
  * [NotBetween](#notbetween)
  * [Match](#match)
  * [Filter](#filter)
* [Changelog](#changelog)

## Example

### Create Connector

The constructor allows to pass an prefix or postfix.

~~~js
const connector = new NextModelKnexConnector({
  prefix: 'app_',
});
~~~

~~~js
const connector = new NextModelKnexConnector({
  postfix: '_test',
});
~~~

~~~js
const connector = new NextModelKnexConnector({
  prefix: 'app_',
  postfix: '_test',
});
~~~

### Use Connector

The connector is used to connect your models to a database.

~~~js
const User = class User extends NextModel {
  static get connector() {
    return connector;
  }

  static get modelName() {
    return 'User';
  }

  static get schema() {
    return {
      id: { type: 'integer' },
      name: { type: 'string' },
    };
  }
}
~~~

Create an base model with the connector to use it with multiple models.

~~~js
const BaseModel = class BaseModel extends NextModel {
  static get connector() {
    return connector;
  }
});

const User = class User extends BaseModel {
  static get modelName() {
    return 'User';
  }

  static get schema() {
    return {
      id: { type: 'integer' },
      name: { type: 'string' },
    };
  }
}

const Address = class Address extends BaseModel {
  static get modelName() {
    return 'Address';
  }

  static get schema() {
    return {
      id: { type: 'integer' },
      street: { type: 'string' },
    };
  }
}
~~~

## Build Queries

This connector allows to filter the data. Samples of possible queries are listed below.

### Where

An object passed as `where` clause will query for object property and value.

~~~js
User.where({ name: 'foo' });
~~~

If the Object has multiple properties the properties are connected with `and`.

~~~js
User.where({ name: 'foo', age: 18 });
~~~

An `where` query can be connected with another `where` or an `orWhere`. A second query will encapsulate the query on the topmost layer.

~~~js
User.where({ name: 'foo', age: 18 }).orWhere({ name: 'bar' });
~~~

### And

Special properties are starting with an `$` sign. The `$and` property connects all values which are passed as `Array` with an SQL `and` operator.

~~~js
User.where({ $and: [
  { name: 'foo' },
]});
~~~

~~~js
User.where({ $and: [
  { name: 'foo' },
  { age: 18 },
]});
~~~

The special properties can also chained with other `where` queries.

~~~js
User.where({ $and: [
  { name: 'foo' },
  { age: 18 },
]}).orWhere({ $and: [
  { name: 'bar' },
  { age: 21 },
]});
~~~

### Or

The `$or` property works similar to the `$and` property and connects all values with `or`.

~~~js
User.where({ $or: [
  { name: 'foo' },
]});
~~~

~~~js
User.where({ $or: [
  { name: 'foo' },
  { name: 'bar' },
]});
~~~

~~~js
User.where({ $or: [
  { name: 'foo' },
  { age: 18 },
]}).where({ $or: [
  { name: 'bar' },
  { age: 21 },
]});
~~~

### Not

The child object of an `$not` property will be inverted.

~~~js
User.where({ $not: {
  name: 'foo'
}});
~~~

~~~js
User.where({ $not: {
  name: 'foo',
  age: 18,
}});
~~~

~~~js
User.where({ $not: {
  name: 'foo',
  age: 18,
}}).where({ $not: {
  name: 'bar',
  age: 21,
}});
~~~

### Nesting

The `$and`, `$or` and `$not` properties can be nested as deeply as needed.

~~~js
User.where({ $not: {
  $or: [
    { name: 'foo' },
    { age: 21 },
  ],
}});
~~~

~~~js
User.where({ $not: {
  $and: [
    { name: 'foo' },
    { $or: [
      { age: 18 },
      { age: 21 },
    ]},
  ],
}});
~~~

### Null

The `$null` property checks for unset columns and takes the column name as value.

~~~js
User.where({ $null: 'name' });
~~~

### NotNull

The `$notNull` property checks if an column is set and takes the column name as value.

~~~js
User.where({ $notNull: 'name' });
~~~

### Equation

There are five different equation properties available.
* `$eq` checks for equal
* `$lt` checks for lower
* `$gt` checks for greater

`$lt`, `$gt` also allows equal values.

The property needs to be an object as value with the column name as key and the equation as value.

~~~js
User.where({ $lt: { age: 18 } });
~~~

~~~js
User.where({ $lt: { age: 18, size: 180 } });
~~~

~~~js
User.where({ $lte: { age: 18 } });
~~~

~~~js
User.where({ $lte: { age: 18, size: 180 } });
~~~

### In

The `$in` property needs an object as value with the column name as key and the `Array` of values as value.

~~~js
User.where({ $in: {
  name: ['foo', 'bar'],
}});
~~~

If multiple properties are present they get connected by an `and` operator.

~~~js
User.where({ $in: {
  name: ['foo', 'bar'],
  age: [18, 19, 20, 21],
}});
~~~

### NotIn

`$notIn` works same as `$in` but inverts the result.

~~~js
User.where({ $notIn: {
  name: ['foo', 'bar'],
}});
~~~

~~~js
User.where({ $notIn: {
  name: ['foo', 'bar'],
  age: [18, 19, 20, 21],
}});
~~~

### Between

The `$between` property needs an object as value with the column name as key and an  `Array` with the min and max values as value.

~~~js
User.where({ $between: {
  age: [18, 21],
}});
~~~

If multiple properties are present they get connected by an `and` operator.

~~~js
User.where({ $between: {
  age: [18, 21],
  size: [160, 185],
}});
~~~

### NotBetween

`$notBetween` works same as `$between` but inverts the result.

~~~js
User.where({ $notBetween: {
  age: [18, 21],
}});
~~~

~~~js
User.where({ $notBetween: {
  age: [18, 21],
  size: [160, 185],
}});
~~~

### Match

The `$match` property needs an object as value with the column name as key and an `regex` with the min and max values as value.

~~~js
User.where({ $between: {
  age: [18, 21],
}});
~~~

If multiple properties are present they get connected by an `and` operator.

~~~js
User.where({ $between: {
  age: [18, 21],
  size: [160, 185],
}});
~~~

### Filter

The `$filter` property allows to write custom filter queries. Pass an function to filter the items.

~~~js
User.where({ $filter: (item) => {
  return ...
}});
~~~

## Changelog

See [history](HISTORY.md) for more details.

* `0.1.0` **2017-02-25** First release compatible with NextModel 0.2.0
* `0.2.0` **2017-02-25** Added missing dependency for CI
* `0.3.0` **2017-02-25** Improved browser compatibility
* `0.4.0` **2017-02-27** Stored nextId separately
* `0.4.1` **2017-02-27** Updated next-model dependency
* `0.4.2` **2017-02-28** Updated next-model dependency
* `0.4.3` **2017-04-05** Updated next-model dependency
