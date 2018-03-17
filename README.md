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
* Implement **order** in `Connector`
* `createdAt` and `updatedAt` **timestamps**
* Add **callbacks**
* Predefined **validations**
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
  * [query](#query)
  * [find](#find)
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
  * [connector](#connector)
  * [identifier](#identifier)
  * [validators](#validators)
  * [keys](#keys)
  * [filter](#filter)
  * [order](#order)
  * [skip](#skip)
  * [limit](#limit)
* [Instance Attributes](#instance-attributes)
  * [isNew](#isnew)
  * [isPersistent](#ispersistent)
  * [attributes](#attributes)
  * [isChanged](#ischanged)
  * [changes](#changes)
  * [errors](#errors)
  * [Custom Attributes](#custom-attributes)
* [Instance Actions](#instance-actions)
  * [assign](#assign)
  * [save](#save)
  * [delete](#delete)
  * [reload](#reload)
  * [revertChanges](#revertchanges)
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
* Every model has an `id` property. If needed you can add aliases for it.

## Example

~~~ts
// import
import NextModel from 'next-model';

// Typings
interface UserSchema {
  id: number;
  addressId: number;
  firstName: string;
  lastName: string;
  gender: string;
};

interface AddressSchema {
  id: number;
  street: string;
};

// model definitions
class User extends NextModel<UserSchema>() {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;

  static get schema() {
    return {
      id: { type: 'integer' },
      addressId: { type: 'integer' },
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      gender: { type: 'string' },
    };
  }

  static get hasMany() {
    return {
      addresses: { model: Address },
    };
  }

  static get males(): typeof User {
    return this.queryBy.gender('male');
  }

  static get females(): typeof User {
    return this.queryBy('female');
  }

  static withFirstName(firstName): typeof User {
    return this.query({ firstName });
  }

  get name(): string {
    return `${this.firstName} ${this.lastName}`;
  }
};

class Address extends NextModel<AddressSchema>() {
  id: number;
  street: string;

  static get schema() {
    return {
      id: { type: 'integer' },
      street: { type: 'string' },
    };
  }

  static get belongsTo() {
    return {
      user: { model: User },
    };
  }
};

// Creating
user = User.males.build({ firstName: 'John', lastName: 'Doe' });
user.gender === 'male';
user.name === 'John Doe';
user = await user.save();

user = await User.create({
  firstName: 'John',
  lastName: 'Doe',
  gender: 'male',
});

address = await user.addresses.create({
  street: 'Bakerstr.'
});

// Searching
users = await User.males.all;
user = await User.withFirstName('John').first;
addresses = await User.addresses.all;
users = await User.queryBy.lastName('Doe').all;
users = await User.males.order({ lastName: 'asc' }).all;
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
user = await User.create({
  firstName: 'John',
  lastName: 'Doe',
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

A `.belongsTo` association sets up a one-to-one connection with another model, such that each instance of the declaring model "belongs to" one instance of the other model.

For example, if your application includes users and addresses, and each user can be assigned to exactly one address, you'd declare the user model this way:

~~~js
class User extends NextModel<UserSchema>() {
  static get belongsTo() {
    return {
      address: { model: Address },
    }
  }
};

user = await User.create({ addressId: id })
address = await user.address;
address.id === id;

user = User.build();
user.address = address;
user.addressId === address.id;
~~~

### hasMany

A `.hasMany` association indicates a one-to-many connection with another model. You'll often find this association on the "other side" of a [belongsTo](#belongsto) association. This association indicates that each instance of the model has zero or more instances of another model.

For example, in an application containing users and addresses, the author model could be declared like this:

~~~js
class Address extends NextModel<AddressSchema>() {
  static get hasMany() {
    return {
      users: { model: User },
    }
  }
};

users = await address.users.all;
user = await address.users.create({ ... });
~~~

### hasOne

A `.hasOne` association also sets up a one-to-one connection with another model, but with somewhat different semantics (and consequences). This association indicates that each instance of a model contains or possesses one instance of another model.

For example, if each address in your application has only one user, you'd declare the user model like this:

~~~js
class User extends NextModel<UserSchema>() {
  static get hasOne() {
    return {
      address: { model: Address },
    }
  }
};

class Address extends NextModel<AddressSchema>() {
  static get belongsTo() {
    return {
      user: { model: User },
    }
  }
};

address = await user.address;
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
User.males.unfiltered.females;
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
class User extends NextModel<UserSchema>() {
  static get males() {
    return this.queryBy.gender('male');
  }

  static get females() {
    return this.queryBy.gender('female');
  }

  static withFirstName(firstName) {
    return this.queryBy.firstName(firstName);
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
User.withFirstName('John').queryBy.gender('transgender');
~~~

### Build from scope

~~~js
profile = User.males.build();
profile.gender === 'male';
~~~

### Scope chaining

~~~js
User.males.young;
User.males.young.query({ ... });
~~~

## Fetching

If you want to read the data of the samples of the [previous section](#fetching) you can fetch if with the following functions. Each fetching function will return a `Promise` to read the data.

### all

Returns all data of the query. Results can be limited by [skipBy](#skipby) and [limitBy](#limitby).

~~~js
users = await User.all;
users = await User.males.all;
users = await User.queryBy({ firstName: 'John' }).all;
~~~

### first

Returns the first record which matches the query. Use **orderBy** to sort matching records before fetching the first one.

~~~js
user = await User.first;
user = await User.males.first;
user = await User.queryBy({ firstName: 'John' }).first;
user = await User.orderBy({ lastName: 'asc' }).first;
~~~

### count

Returns the count of the matching records. Ignores [orderBy](#orderBy), [skip](#skipby) and [limit](#limitby) and always returns complete count of matching records.

~~~js
count = await User.count;
count = await User.males.count;
count = await User.queryBy({ name: 'John' }).count;
~~~

## Batches

When there is a need to change/delete multiple records at once its recommended to use the following methods if possible. They provide a much better performance compared to do it record by record.

### updateaAll

`.updateAll(attrs)` updates all matching records with the passed attributes.

~~~js
users = await User.queryBy({ firstName: 'John' }).updateAll({ gender: 'male' });
users = await User.updateAll({ encryptedPassword: undefined });
~~~

### deleteAll

Deletes and returns all matching records..

~~~js
deletedUsers = await User.deleteAll();
deletedUsers = await User.query({ firstName: 'John', lastName: 'Doe' }).deleteAll();
~~~

## Class Properties

Class Properties are static getters which can be defined with the class. Some of them can be modified by [Queries](#queries) which creates a new Class.

### modelName

The model name needs to be defined for every model. The name should be singular camelcase, starting with an uppercase char. If the `.modelName` is not passed its reflected from its Class Name.

~~~js
class User extends NextModel<UserSchema>() {};
User.modelName; //=> 'User'

class User extends NextModel<UserSchema>() {
  static get modelName() {
    return 'User';
  }
};

class UserAddress extends NextModel<AddressSchema>() {
  static get modelName() {
    return 'UserAddress';
  }
};
~~~

### schema

A schema describes all (database stored) properties. Foreign keys from relations like [belongsTo](#belongsto) are automatically added to the schema. The existing types and their names are depending on the used Database connector.

~~~js
class User extends NextModel<UserSchema>() {
  static get schema() {
    return {
      id: { type: 'integer' },
      name: { type: 'string' },
    };
  }
};
~~~

### connector

A connector is the bridge between models and the database. NextModel comes with an DefaultConnector which reads and writes on an simpe js object.

Available connectors:

* WIP [knex](https://github.com/tamino-martinius/node-next-model-knex-connector.git) (mySQL, postgres, sqlite3, ...)
* WIP [local-storage](https://github.com/tamino-martinius/node-next-model-local-storage-connector.git) (Client side for Browser usage)

~~~js
const Connector = require('next-model-knex-connector');
const connector = new Connector(options);

class User extends NextModel<UserSchema>() {
  static get connector() {
    return connector;
  }
};
~~~

Define an base model with connector to prevent adding connector to all Models.

*Please note:* In this case its better to call the `@Model` Decorator just on the final models and not on the base model, else you need to define the [modelName](#modelname) on each model because its reflected from the base model.

~~~js
class BaseModel<S extends Identifiable> extends NextModel<S>() {
  static get connector() {
    return connector;
  }
};

class User extends BaseModel<UserSchema> {
  ...
};

class Address extends BaseModel<AddressSchema> {
  ...
};
~~~

### Identifier

Defines the name of the primary key. It also gets automatically added to the schema with type `'integer'` if the identifier is not present at the schema. The identifier values must be serialized to an unique value with `toString()`

Default values is `id`.

~~~js
class User extends NextModel<UserSchema>() {
  static get identifier() {
    return 'key';
  }

get id(): string {
    return this.key;
  }

  set id(key: string) {
    return this.key = key;
  }
};
~~~

You also can define your identifier on the [schema](#schema) to change the default type.

~~~js
class User extends NextModel<UserSchema>() {
  static get identifier(): string {
    return 'uid';
  }

  get id(): string {
    return this.uid;
  }

  set id(uid: string) {
    return this.uid = uid;
  }

  static get schema(): Schema {
    return {
      uid: { type: 'uuid' },
      ...
    };
  }
};
~~~

### validators

Validators is an object with keys of type string and values which are Promises to check if an instance is valid. An Validator gets the model instance and returns an promised boolean. The values can also be Arrays of Validators. These validators are checked with [isValid](#isValid).

~~~js
class User extends NextModel {
  static get validators: Validators {
    return {
      ageCheck: (user) => Promise.resolve(user.age > 0),
    };
  }
};

new User({ age: 28 }).isValid().then(isValid => ...) //=> true
new User({ age: -1 }).isValid().then(isValid => ...) //=> flase
~~~

Validators can be skipped by `.skipValidator(key)` by passing the key of the validator. Multiple keys could be skipped by `.skipValidators(keys)` or be defining the getter `.skippedValidators`.

~~~js
UncheckedUser = User.skipValidator('ageCheck');
new User({ age: -1 }).isValid().then(isValid => ...) //=> true
~~~

### keys

The `.keys` will return all possible attributes you can pass to build new model Instances. The keys depend on [schema](#schema).

~~~js
class Foo extends NextModel{
  static get schema(): Schema {
    return {
      bar: { type: 'string' },
    };
  }
};
Foo.keys //=> ['bar']
~~~

### filter

A default scope can be defined by adding a getter for `.filter`. You need call [unfiltered](#query) to search without this scope.

~~~js
class User extends NextModel<UserSchema>() {
  static get filter() {
    return {
      deletedAt: null,
    };
  }
};

user = await User.first;
User.unqueried.where( ... );
~~~

### order

Adds an default Order to all queries unless its overwritten.

~~~js
class User extends NextModel<UserSchema>() {
  static get order() {
    return [{
      name: 'asc',
    }];
  }
};
~~~

### skip

Adds an default amount of skipped records on every query. This can be changed by [skipBy](#skipby) and removed by `.unskipped`.

~~~js
class User extends NextModel<UserSchema>() {
  static get limit(): number {
    return 10;
  }
};
~~~

### limit

Limits all queries made to this model to an specific amount. This can be changed by [limitBy](#limitby) and removed by `.unlimited`.

~~~js
class User extends NextModel<UserSchema>() {
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
address = await address.save();
address.isNew === false;
~~~

### isPersistent

The opposite of [isNew](#isnew). Returns false unless the record is not saved to the database.

~~~js
address = Address.build();
address.isPersistent === false;
address = await address.save();
address.isPersistent === true;
~~~

### attributes

Returns an object which contains all properties defined by schema.

~~~js
class Address extends NextModel<AddressSchema>() {
  static get schema() {
    return {
      street: { type: 'string' },
      city: { type: 'string' },
    };
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
address = await address.save();
address.changes === {}
~~~

### Custom Attributes

Custom attributes can be defined as on every other js class.

~~~js
class User extends NextModel<UserSchema>() {
  static get schema() {
    return {
      firstname: { type: 'string' },
      lastname: { type: 'string' },
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

## Instance Actions

### assign

You can assign a new value to an [schema](#schema) defined property. This does **not** automatically save the data to the database. All assigned attributes will be tracked by [changes](#changes)

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
address = await address.save();
address.isNew === false;
~~~

~~~js
address.street = 'changed';
address = await address.save();
~~~

### delete

Removes the record from database. Returns a `Promise` with the deleted record.

~~~js
address.isNew === false;
address = await address.delete();
address.isNew === true;
~~~

### reload

Refetches the record from database. All temporary attributes and changes will be lost. Returns a `Promise` with the reloaded record.

~~~js
address.isNew === false;
address.street = 'changed';
address.notAnDatabaseColumn = 'foo';
address = address.reload();
address.name === '1st Street';
address.notAnDatabaseColumn === undefined;
~~~

### revertCachanges

Reverts an unsaved change with `#revertChange(key)` or reverts all unsaved changed with `#revertChanges()`.

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
address.revertChange('street');
address.changes === {};
~~~

~~~js
address = Address.build({
  street: '1st street',
  city: 'New York',
});
address.changes === {};
address.street = '2nd street';
address.city = 'San Francisco',
address.changes === {
  street: { from: '1st street', to: '2nd street' },
  street: { from: 'New York', to: 'San Francisco' },
};
address.revertChanges();
address.changes === {};
~~~

### isValid

Checks if the current instance is valid. Promises to return boolean value.

~~~js
class User extends NextModel<UserSchema>() {
  static get validators(): Validators {
    return {
      ageCheck: (user) => Promise.resolve(user.age > 0),
    };
  }
};

isValid = await new User({ age: 28 }).isValid //=> true
isValid = await new User({ age: -1 }).isValid //=> flase

UncheckedUser = User.skipValidator('ageCheck');
isValid = await new User({ age: -1 }).isValid //=> true
~~~

~~~js
class User extends NextModel<UserSchema>() {
  static ageCheck(user): Promise<boolean> {
    return Promise.resolve(user.age > 0);
  }

  static get validators(): Validators {
    return {
      ageCheck: this.ageCheck,
    };
  }
};
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
