# NextModel

Rails like models using **TypeScript**. [![Build Status](https://travis-ci.org/tamino-martinius/node-next-model.svg?branch=typescript-experimental)](https://travis-ci.org/tamino-martinius/node-next-model)

NextModel gives you the ability to:

* Represent **models** and their data.
* Represent **associations** between these models.
* Represent **inheritance** hierarchies through related models.
* Perform database operations in an **object-oriented** fashion.
* Uses **Promises** for database queries.

## Roadmap / Where can i contribute

See [GitHub](https://github.com/tamino-martinius/node-next-model/projects/1) project for current progress/tasks

* Fix **typos**
* Improve **documentation**
* `createdAt` and `updatedAt` **timestamps**
* Predefined and custom **validations**
* Improve **schema** with eg. default values, limits
* Improve **associations** eg. cascading deletions
* Add more packages for eg. **versioning** and **soft deleting**
* Help to improve **tests** and the test **coverage**.
* Add more connectors for eg. **graphQL** and **dynamoDB**
* `includes` prefetches relations with two db queries *(fetch records => pluck ids => fetch related records by ids)* instead of one query per related model.

  `User.includes({address: {}})`, `Profile.includes({user: {address: {}}})`
* Add a solution to create **Migrations**

## TOC

* [Naming Conventions](#naming-conventions)
* [Example](#example)
* [Model Instances](#model-instances)
  * [build](#build)
  * [create](#create)
* [Relations](#relations)
  * [belongsTo](#belongsto)
  * [hasMany](#hasmany)
  * [hasOne](#hasone)
* [Queries](#queries)
  * [queryBy](#where)
  * [orderBy](#order)
  * [skip](#skipby)
  * [limit](#limitby)
* [Scopes](#scopes)
  * [Scope chaining](#scope-chaining)
  * [Build from scope](#build-from-scope)
* [Fetching](#fetching)
  * [all](#all)
  * [first](#first)
  * [count](#count)
* [Batches](#batches)
  * [updateAll](#updateall)
  * [deleteAll](#deleteall)
* [Class Properties](#class-properties)
  * [modelName](#modelname)
  * [Schema](#schema)
  * [dbConnector](#dbconnector)
  * [identifier](#identifier)
  * [attrAccessors](#attraccessors)
  * [keys](#keys)
  * [dbKeys](#dbKeys)
  * [query](#query)
  * [order](#order)
  * [skip](#skip)
  * [limit](#limit)
* [Instance Attributes](#instance-attributes)
  * [isNew](#isnew)
  * [isPersistent](#ispersistent)
  * [attributes](#attributes)
  * [dbAttributes](#dbattributes)
  * [isChanged](#ischanged)
  * [changes](#changes)
  * [errors](#errors)
  * [Custom Attributes](#custom-attributes)
* [Instance Callbacks](#instance-callbacks)
  * [Promise Callbacks](#promise-callbacks)
  * [Sync Callbacks](#sync-callbacks)
* [Instance Actions](#instance-actions)
  * [assign](#assign)
  * [save](#save)
  * [delete](#delete)
  * [reload](#reload)
  * [isValid](#isvalid)
* [Changelog](#changelog)

## Naming Conventions

To keep the configuration as short as possible, its recommended to use the following conventions:

* Use camel case for multiple words
  * `createdAt`
  * `someOtherValue`
  * `ChatMessage`
* Every property starts with lower case.
  * `createdAt`
  * `someOtherValue`
* Classes should be singular start with an capital letter.
  * `Address`
  * `Chat`
  * `ChatMessage`
* Foreign keys are the class names starting with an lower case character and end with Id.
  * `User` - `userId`
  * `Chat` - `chatId`
  * `ChatMessage` - `chatMessageId`

## Example

~~~ts
// import
import {
  Model,
  NextModel,
  Schema,
  BelongsTo,
  HasMany,
} from 'next-model';

// model definitions
@Model
class User extends NextModel {
  // This typings are optional but improves autocomplete
  id: number;
  firstName: string;
  lastName: string;
  gender: string;

  static get schema(): Schema {
    return {
      id: { type: 'integer' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      gender: { type: 'string' },
    };
  }

  static get hasMany(): HasMany {
    return {
      addresses: { model: Address },
    };
  }

  static get males(): typeof NextModel {
    return this.queryBy({ gender: 'male' });
  }

  static get females(): typeof NextModel {
    return this.queryBy({ gender: 'female' });
  }

  static withFirstName(firstName): typeof NextModel {
    return this.queryBy({ firstName });
  }

  get name(): string {
    return `${this.firstName} ${this.lastName}`;
  }
};

@Model
class Address extends NextModel {
  static get schema(): Schema {
    return {
      id: { type: 'integer' },
      street: { type: 'string' },
    };
  }

  static get belongsTo(): BelongsTo {
    return {
      user: { model: User },
    };
  }
};

// Creating
user = User.males.build({ firstName: 'John', lastName: 'Doe' });
user.gender === 'male';
user.name === 'John Doe';
user.save().then(user => ... );

User.create({
  firstName: 'John',
  lastName: 'Doe',
  gender: 'male',
}).then(user => ... );

user.addresses.create({
  street: 'Bakerstr.'
}).then(address => ...);

// Searching
User.males.all.then(users => ... );
User.withFirstName('John').first(user => ... );
User.addresses.all.then(addresses => ... );
User.queryBy({ lastName: 'Doe' }).all.then(users => ... );
User.males.order({ lastName: 'asc' }).all.then(users => ... );
~~~

## Model Instances

### build

Initializes new record without saving it to the database.

~~~js
user = User.build({ firstName: 'John', lastName: 'Doe' });
user.isNew === true;
user.name === 'John Doe';
~~~

### create

Returns a `Promise` which returns the created record on success or the initialized if sth. goes wrong.

~~~js
User.create({
  firstName: 'John',
  lastName: 'Doe',
}).then(user => {
  user.isNew === false;
}).catch(user => {
  user.isNew === true;
});
~~~

### From Scopes and queries

An record can be `build` or `create`d from scopes. These records are created with scope values as default.

~~~js
address = user.addresses.build();
address.userId === user.id;

user = User.males.build();
user.gender === 'male';

user = User.withFirstName('John').build();
user.firstName === 'John';

user = User.withFirstName('John').queryBy({ lastName: 'Doe' }).build();
user.name === 'John Doe';

user = User.where({ gender: 'male'}).build();
user.gender === 'male';
~~~

## Relations

Define the Model associations. Describe the relation between models to get predefined scopes and constructors.

### belongsTo

~~~js
@Model
class Address extends NextModel {
  static get belongsTo() {
    return {
      user: { model: User },
    }
  }
};

Address.create({
  userId: id
}).then(address => {
  return address.user;
}).then(user => {
  user.id === id;
});

address = Address.build();
address.user = user;
address.userId === user.id;
~~~

### hasMany

~~~js
@Model
class User extends NextModel {
  static get hasMany() {
    return {
      addresses: { model: Address },
    }
  }
};

user.addresses.all.then(addresses => ... );
user.addresses.create({ ... }).then(address => ... );
~~~

### hasOne

~~~js
@Model
class User extends NextModel {
  static get hasOne() {
    return {
      address: { model: Address },
    }
  }
};

user.address.then(address => ... );
~~~

## Queries

### queryBy

Special query syntax is dependent on used connector. But all connectors and the cache supports basic attribute filtering and the special queries $and, $or and $now. All special queries start with an leading $. The query can be completely cleared by calling `.unqueried`

~~~js
User.queryBy({ gender: 'male' });
User.queryBy({ age: 21 });
User.queryBy({ name: 'John', gender: 'male' });
User.queryBy({ $or: [
  { firstName: 'John' },
  { firstName: 'Foo' },
]});
User.queryBy({ $and: [
  { firstName: 'John' },
  { lastName: 'Doe' },
]});
User.queryBy({ $not: [
  { gender: 'male' },
  { gender: 'female' },
]});
User.males.queryBy({ name: 'John' });
User.males.unqueried.females;
~~~

### orderBy

The fetched data can be sorted before fetching then. The `orderBy` function takes an object with property names as keys and the sort direction as value. Valid values are `asc` and `desc`. The order can be resetted by calling `.unordered`.

~~~js
User.orderBy({ name: 'asc' });
User.orderBy({ name: 'desc' });
User.orderBy({ name: 'asc', age: 'desc' });
User.males.orderBy({ name: 'asc' });
User.orderBy({ name: 'asc' }).unordered;
~~~

### skipBy

An defined amont of matching records can be skipped with `.skipBy(amount)` and be resetted with  `.unskipped`. The current skipped amount of records can be fetched with `.skip`.

*Please note:* `.skipBy(amount)` and `.unskipped` will return a scoped model and will not modify the existing one.

Default value is `0`.

~~~js
User.count; //=> 10
User.skip; //=> 0
User.skipBy(3).count; //=> 7
User.skip; //=> 0 !
User = User.skipBy(15);
User.skip; //=> 15
User.skipBy(5).unskipped.count; //=> 10
~~~

### limitBy

The resultset can be limited with `.limitBy(amount)` and be resetted with  `.unlimited`. The current limit can be fetched with `.limit`.

*Please note:* `.limitBy(amount)` and `.unlimited` will return a scoped model and will not modify the existing one.

Default value is `Number.MAX_SAFE_INTEGER`.

~~~js
User.count; //=> 10
User.limit; //=> Number.MAX_SAFE_INTEGER
User.limitBy(3).count; //=> 3
User.limit; //=> Number.MAX_SAFE_INTEGER !
User = User.limitBy(15);
User.limit; //=> 15
User.limitBy(5).unlimited.count; //=> 10
~~~

## Scopes

Scopes are predefined search queries on a Model.

~~~js
@Model
class User extends NextModel {
  static get males() {
    return this.queryBy({ gender: 'male' });
  }

  static get females() {
    return this.queryBy({ gender: 'female' });
  }

  static get withFirstName(firstName) {
    return this.queryBy({ firstName });
  }
};
~~~

Now you can use these scopes to search/filter records.

~~~js
User.males;
User.withFirstName('John');
~~~

Scopes can be chained with other scopes or search queries.

~~~js
User.males.witFirsthName('John');
User.withFirstName('John').queryBy({ gender: 'transgender' });
~~~

### Build from scope

~~~js
profile = User.males.build();
profile.gender === 'male';
~~~

### Scope chaining

~~~js
User.males.young;
User.males.young.queryBy({ ... });
~~~

## Fetching

If you want to read the data of the samples of the [previous section](#fetching) you can fetch if with the following functions. Each fetching function will return a `Promise` to read the data.

### all

Returns all data of the query. Results can be limited by [skipBy](#skipby) and [limitBy](#limitby).

~~~js
User.all.then(users => ...);
User.males.all.then(users => ...);
User.queryBy({ firstName: 'John' }).all.then(users => ...);
~~~

### first

Returns the first record which matches the query. Use **orderBy** to sort matching records before fetching the first one.

~~~js
User.first.then(user => ...);
User.males.first.then(user => ...);
User.queryBy({ firstName: 'John' }).first.then(user => ...);
User.orderBy({ lastName: 'asc' }).first.then(user => ...);
~~~

### count

Returns the count of the matching records. Ignores [orderBy](#orderBy), [skip](#skipby) and [limit](#limitby) and always returns complete count of matching records.

~~~js
User.count.then(count => ...);
User.males.count.then(count => ...);
User.queryBy({ name: 'John' }).count.then(count => ...);
User.count === User.limit(5).count;
~~~

## Batches

When there is a need to change/delete multiple records at once its recommended to use the following methods if possible. They provide a much better performance compared to do it record by record.

### updateaAll

`.updateAll(attrs)` updates all matching records with the passed attributes.

~~~js
User.queryBy({ firstName: 'John' }).updateAll({ gender: 'male' }).then(users => ...);
User.updateAll({ encryptedPassword: undefined }).then(users => ...);
~~~

### deleteAll

Deletes and returns all matching records..

~~~js
User.deleteAll().then(deletedUsers => ...);
User.queryBy({ firstName: 'John', lastName: 'Doe' }).deleteAll().then(deletedUsers => ...);
~~~


## Class Properties

Class Properties are static getters which can be defined with the class. Some of them can be modified by [Queries](#queries) which creates a new Class.

### modelName

The model name needs to be defined for every model. The name should be singular camelcase, starting with an uppercase char. If the `.modelName` is not passed its reflected from its Class Name.

~~~js
@Model
class User extends NextModel {};
User.modelName; //=> 'User'

@Model
class User extends NextModel {
  static get modelName() {
    return 'User';
  }
};

@Model
class UserAddress extends NextModel {
  static get modelName() {
    return 'UserAddress';
  }
};
~~~

### schema

A schema describes all (database stored) properties. Foreign keys from relations like [belongsTo](#belongsto) are automatically added to the schema. The existing types and their names are depending on the used Database connector.

~~~js
@Model
class User extends NextModel {
  static get schema() {
    return {
      id: { type: 'integer' },
      name: { type: 'string' },
    };
  }
};
~~~

### dbConnector

A connector is the bridge between models and the database. NextModel comes with an DefaultConnector which reads and writes on an simpe js object.

Available connectors:

* WIP [knex](https://github.com/tamino-martinius/node-next-model-knex-connector.git) (mySQL, postgres, sqlite3, ...)
* WIP [local-storage](https://github.com/tamino-martinius/node-next-model-local-storage-connector.git) (Client side for Browser usage)

~~~js
const Connector = require('next-model-knex-connector');
const connector = new Connector(options);

@Model
class User extends NextModel {
  static get connector() {
    return connector;
  }
};
~~~

Define an base model with connector to prevent adding connector to all Models.

*Please note:* In this case its better to call the `@Model` Decorator just on the final models and not on the base model, else you need to define the [modelName](#modelname) on each model because its reflected from the base model.

~~~js
class BaseModel extends NextModel {
  static get connector() {
    return connector;
  }
};

@Model
class User extends BaseModel {
  ...
};

@Model
class Address extends BaseModel {
  ...
};
~~~


### Identifier

Defines the name of the primary key. It also gets automatically added to the schema with type `'integer'` if the identifier is not present at the schema. The identifier values must be serialized to an unique value with `toString()`

Default values is `id`.

~~~js
@Model
class User extends BaseModel {
  static get identifier() {
    return 'key';
  }
};
~~~

You also can define your identifier on the [schema](#schema) to change the default type.

~~~js
@Model
class User extends BaseModel {
  static get identifier() {
    return 'uid';
  }

  static get schema() {
    return {
      uid: { type: 'uuid' },
      ...
    };
  }
};
~~~

### attrAccessors

Accessors define properties which can be passed to [build](#build), [create](#create) functions or assignments, but are not passed to the database. Use them to store temporary data like passing values to model but not to database layer. Attributes defined this way are returned by [attributes](#attributes) but not by [dbAttributes](#dbattributes).

~~~js
class User extends NextModel {
  static get accessors {
    return [
      'checkForConflicts',
    ];
  }
};

user = User.build({ checkForConflicts: true });
user.checkForConflicts === true;

user = User.build({ foo: 'bar' });
user.foo === undefined;
~~~

### keys

The `.keys` will return all possible attributes you can pass to build new model Instances. The keys depend on [Relations](#relations), [schema](#schema), [attrAccessors](#attraccessors) and the [identifier](#identifier).

~~~js
@Model
class Foo extends NextModel{};
Foo.keys //=> ['id']
class Foo extends NextModel{
  static get schema(): Schema {
    return {
      bar: { type: 'string' },
    };
  }

  static get belongsTo(): BelongsTo {
    return {
      bar: { model: Bar },
    };
  }

  static get attrAccessors(): string[] {
    return ['baz'];
  }
};
Foo.keys //=> ['id', 'bar', 'barId', 'baz']
~~~

### dbKeys

The `.dbKeys` will return all attributes which are persistend stored at the database. The keys depend on [Relations](#relations), [schema](#schema) and the [identifier](#identifier).

~~~js
@Model
class Foo extends NextModel{};
Foo.keys //=> ['id']
class Foo extends NextModel{
  static get schema(): Schema {
    return {
      bar: { type: 'string' },
    };
  }

  static get belongsTo(): BelongsTo {
    return {
      bar: { model: Bar },
    };
  }

  static get attrAccessors(): string[] {
    return ['baz'];
  }
};
Foo.keys //=> ['id', 'bar', 'barId']
~~~

### query

A default scope can be defined by adding a getter for `.query`. You need call [unqueried](#queryby) to search without this scope.

~~~js
@Model
class User extends NextModel {
  static get query(): Query {
    return {
      deletedAt: null,
    };
  }
};

User.first.then(user => user.deletedAt === null);
User.unqueried.where( ... );
~~~

### order

Adds an default Order to all queries unless its overwritten.

~~~js
@Model
class User extends NextModel {
  static get order(): Order {
    return {
      name: 'asc',
    };
  }
};
~~~

### skip

Adds an default amount of skipped records on every query. This can be changed by [skipBy](#skipby) and removed by `.unskipped`.

~~~js
@Model
class User extends NextModel {
  static get limit(): number {
    return 10;
  }
};
~~~

### limit

Limits all queries made to this model to an specific amount. This can be changed by [limitBy](#limitby) and removed by `.unlimited`.

~~~js
@Model
class User extends NextModel {
  static get limit(): number {
    return 100;
  }
};
~~~

## Instance Attributes

### isNew

An record is new unless the record is saved to the database. NextModel checks if the identifier property is set for this attribute.

~~~js
address = Address.build();
address.isNew === true;
address.save().then(address => {
  address.isNew === false;
});
~~~

### isPersistent

The opposite of [isNew](#isnew). Returns false unless the record is not saved to the database.

~~~js
address = Address.build();
address.isPersistent === false;
address.save().then(address => {
  address.isPersistent === true;
});
~~~

### attributes

Returns an object which contains all properties defined by schema and attrAccessors.

~~~js
@Model
class Address extends NextModel {
  static get schema() {
    return {
      street: { type: 'string' },
      city: { type: 'string' },
    };
  }

  static get attrAccessors() {
    return ['fetchGeoCoord'];
  }
};

address = Address.build({
  street: '1st street',
  city: 'New York',
  fetchGeoCoord: false,
});
address.foo = 'bar';

address.attributes === {
  street: '1st street',
  city: 'New York',
  fetchGeoCoord: false
};
~~~

### dbAttributes

Returns an object which contains all properties defined only by schema.

~~~js
@Model
class Address extends NextModel {
  static get schema() {
    return {
      street: { type: 'string' },
      city: { type: 'string' },
    };
  }

  static get attrAccessors() {
    return ['fetchGeoCoord'];
  }
};

address = Address.build({
  street: '1st street',
  city: 'New York',
  fetchGeoCoord: false,
});
address.foo = 'bar';

address.dbAttributes === {
  street: '1st street',
  city: 'New York',
};
~~~

### isChanged

When you change a fresh build or created Class instance this property changes to true.

~~~js
address = Address.build({
  street: '1st street',
  city: 'New York',
});
address.isChanged === false;
address.street = '2nd street';
address.isChanged === true;
~~~

This property does not change when the value is same after assignment.

~~~js
address = Address.build({
  street: '1st street',
  city: 'New York',
});
address.isChanged === false;
address.street = '1st street';
address.isChanged === false;
~~~

### changes

The `changes` property contains an `object` of changes per property which has changed. Each entry contains an `from` and `to` property. Just the last value is saved at the `to` property if the property is changed multiple times. The changes are cleared once its set again to its initial value, or if the record got saved.

~~~js
address = Address.build({
  street: '1st street',
  city: 'New York',
});
address.changes === {};
address.street = '2nd street';
address.changes === {
  street: { from: '1st street', to: '2nd street' },
};
address.street = '3rd street';
address.changes === {
  street: { from: '1st street', to: '3nd street' },
};
address.street = '1st street';
address.changes === {};
~~~

~~~js
address = Address.build({
  street: '1st street',
  city: 'New York',
});
address.changes === {};
address.street = '2nd street';
address.changes === {
  street: { from: '1st street', to: '2nd street' },
};
address.save(address =>
  address.changes === {}
);
~~~

### Custom Attributes

Custom attributes can be defined as on every other js class.

~~~js
class User extends NextModel {
  static get schema() {
    return {
      firstname: {type: String},
      lastname: {type: String}
    }
  }

  get name() {
    return `${this.firstName} ${this.lastName}`;
  }
}

user = User.build({
  firstname: 'Foo',
  lastname: 'Bar'
});
user.name === 'Foo Bar';
~~~

## Instance Callbacks

With callbacks you can run code before or after an action. Actions which currently supports callbacks are `save`, `update`, `delete`, `reload`, `assign`, `change` and `validation`. Callbacks are always named `before{Action}` and `after{Action}`. Callbacks are async with Promises (except `assign` and `change`). Callbacks get called with the current model instance and should return a bool value. If an `before{Action}` callback returns `false` or gets rejected the action will be aborted and non of the following callbacks will be called. If an `after{Action}` callback will return `false` or gets rejected none of the following callback will be called, but the action will not be rolled back.

*Please Note:* `assign` and `change` just supports sync callbacks.

### Pmomise Callbacks

Callbacks can be defined as function which returns a promised boolean.

~~~js
@Model
class User extends NextModel {
  static beforeSave(user): boolean {
    if (user.isNew) user.createdAt = Date.now();
    user.updatedAt = Date.now();
    return Pronise.resolve(true);
  }
};
~~~

Callbacks can be defined as getter to return other methods.

~~~js
class BaseModel extends NextModel {
  static setTimestemps(instance): Promise<boolean> {
    if (instance.isNew) instance.createdAt = Date.now();
    instance.updatedAt = Date.now();
    return Pronise.resolve(true);
  }
}

@Model
class User extends BaseModel {
  static get beforeSave(): PromiseCallback {
    return this.setTimestemps;
  }
};
~~~

Callbacks can be defined as getter to return multiple methods.

~~~js
@Model
class User extends BaseModel {
  static setGeoCoord(user): Promise<boolean> {
    return GeoService.getGeoCoord(user.address).then(coord => {
      user.coord = coord;
      return true;
    }).catch(() => return false);
  }

  static get beforeSave(): PromiseCallback[] {
    return [
      this.setGeoCoord,
      this.setTimestemps,
    ];
  }
};
~~~

### Sync Callbacks

Callbacks can be defined as function which returns a boolean.

~~~js
@Model
class User extends NextModel {
  static afterChange(user): boolean {
    if (user.isNew) user.createdAt = Date.now();
    const changeCount = Object.keys(user.changes).length;
    if (changeCount === 1) {
      if (user.changes.updatedAt === undefined) {
        user.updatedAt = Date.now();
      } else {
       user.revertChange('updatedAt');
      }
    }
    return true;
  }
};
~~~

Callbacks can be defined as getter to return other methods.

~~~js
class BaseModel extends NextModel {
  static setTimestemps(instance): boolean {
    if (instance.isNew) instance.createdAt = Date.now();
    const changeCount = Object.keys(instance.changes).length;
    if (changeCount === 1) {
      if (instance.changes.updatedAt === undefined) {
        instance.updatedAt = Date.now();
      } else {
       instance.revertChange('updatedAt');
      }
    }
    return true;
  }
}

@Model
class User extends BaseModel {
  static get afterChange(): SyncCallback {
    return this.setTimestemps;
  }
};
~~~

Callbacks can be defined as getter to return multiple methods.

~~~js
@Model
class User extends BaseModel {
  static someOtherCallback(instance): boolean {
    ...
  }

  static get afterChange(): PromiseCallback[] {
    return [
      this.someOtherCallback,
      this.setTimestemps,
    ];
  }
};
~~~

## Instance Actions

### assign

You can assign a new value to an [schema](#schema) or [accessor](#accessors) defined property. This does **not** automatically save the data to the database. All assigned attributes will be tracked by [changes](#changes)

~~~js
address.assign({
  street: '1st Street',
  city: 'New York',
});
~~~

### save

Saves the record to database. Returns a `Promise` with the created record including its newly created id. An already existing record gets updated.

~~~js
address = Address.build({street: '1st street'});
address.save().then(
  (address) => address.isNew === false;
).catch(
  (address) => address.isNew === true;
);
~~~

~~~js
address.street = 'changed';
address.save().then( ... );
~~~

### delete

Removes the record from database. Returns a `Promise` with the deleted record.

~~~js
address.isNew === false;
address.delete().then(
  (address) => address.isNew === true;
).catch(
  (address) => address.isNew === false;
);
~~~

### reload

Refetches the record from database. All temporary attributes and changes will be lost. Returns a `Promise` with the reloaded record.

~~~js
address.isNew === false;
address.street = 'changed';
address.notAnDatabaseColumn = 'foo';
address.reload().then((address) => {
  address.name === '1st Street';
  address.notAnDatabaseColumn === undefined;
});
~~~

## Changelog

See [history](HISTORY.md) for more details.

* `1.0.0` **2017-11-xx** Complete rewrite in typescript
* `0.4.1` **2017-04-05** Bugfix: before and after callback
* `0.4.0` **2017-02-28** Added platform specific callbacks
* `0.3.0` **2017-02-27** Tracked property changes
* `0.2.0` **2017-02-25** Improved browser compatibility
* `0.1.0` **2017-02-23** Added Browser compatibility
* `0.0.4` **2017-02-16** Added callbacks for `build`, `create`, `save` and `delete`
* `0.0.3` **2017-02-12** Added CI
* `0.0.2` **2017-02-05** Published [knex connector](https://github.com/tamino-martinius/node-next-model-knex-connector.git)
* `0.0.1` **2017-01-23** Initial commit with query and scoping functions
