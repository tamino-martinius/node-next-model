# NextModel

Write scoped models using **TypeScript**. [![Build Status](https://travis-ci.org/tamino-martinius/node-next-model.svg?branch=master)](https://travis-ci.org/tamino-martinius/node-next-model)

NextModel gives you the ability to:

* Represent **models** and their data.
* Represent **inheritance** hierarchies through related models.
* Perform database operations in an **object-oriented** fashion.
* Uses **Promises** for database queries.

## Roadmap / Where can i contribute

See [GitHub](https://github.com/tamino-martinius/node-next-model/projects/1) project for current progress/tasks

* Fix **typos**
* Add **associations** between models
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

- [NextModel](#nextmodel)
  - [Roadmap / Where can i contribute](#roadmap--where-can-i-contribute)
  - [TOC](#toc)
  - [Example](#example)
  - [Model Instances](#model-instances)
    - [build](#build)
    - [create](#create)
    - [From Scopes and queries](#from-scopes-and-queries)
  - [Relations *WIP - Definitions will change*](#relations-wip---definitions-will-change)
    - [belongsTo *WIP - Definitions will change*](#belongsto-wip---definitions-will-change)
    - [hasMany *WIP - Definitions will change*](#hasmany-wip---definitions-will-change)
    - [hasOne *WIP - Definitions will change*](#hasone-wip---definitions-will-change)
  - [Queries](#queries)
    - [filterBy](#filterby)
    - [orderBy](#orderby)
    - [skipBy](#skipby)
    - [limitBy](#limitby)
  - [Scopes](#scopes)
    - [Build from scope](#build-from-scope)
    - [Scope chaining](#scope-chaining)
  - [Fetching](#fetching)
    - [all](#all)
    - [first](#first)
    - [count](#count)
  - [Batches *WIP - Definitions will change*](#batches-wip---definitions-will-change)
    - [updateaAll *WIP - Definitions will change*](#updateaall-wip---definitions-will-change)
    - [deleteAll *WIP - Definitions will change*](#deleteall-wip---definitions-will-change)
  - [Model Parameters *WIP - Definitions will change*](#model-parameters-wip---definitions-will-change)
    - [connector *WIP - Definitions will change*](#connector-wip---definitions-will-change)
    - [keys *WIP - Definitions will change*](#keys-wip---definitions-will-change)
    - [filter *WIP - Definitions will change*](#filter-wip---definitions-will-change)
    - [order *WIP - Definitions will change*](#order-wip---definitions-will-change)
    - [skip *WIP - Definitions will change*](#skip-wip---definitions-will-change)
    - [limit *WIP - Definitions will change*](#limit-wip---definitions-will-change)
  - [Instance Attributes](#instance-attributes)
    - [isNew](#isnew)
    - [isPersistent](#ispersistent)
    - [attributes](#attributes)
    - [isChanged *WIP - Definitions will change*](#ischanged-wip---definitions-will-change)
    - [changes *WIP - Definitions will change*](#changes-wip---definitions-will-change)
    - [Custom Attributes *WIP - Definitions will change*](#custom-attributes-wip---definitions-will-change)
  - [Instance Actions](#instance-actions)
    - [assign](#assign)
    - [save](#save)
    - [delete](#delete)
    - [reload](#reload)
    - [revertCachanges](#revertcachanges)
    - [isValid](#isvalid)
  - [Changelog](#changelog)

## Example

~~~ts
// import
import { Model } from '@next-model/core';

class User extends Model({
  tableName: 'users',
  init: (props: { firstName?: string; lastName?: string; gender?: string }) => props,
}) {
  static get males() {
    return this.filterBy({ gender: 'male' });
  }

  static get females() {
    return this.filterBy({ gender: 'female' });
  }

  static withFirstName(firstName: string) {
    return this.filterBy({firstName});
  }

  get addresses() {
    return Address.filterBy({ userId: this.attributes.id })
  }

  get name(): string {
    return `${this.attributes.firstName} ${this.attributes.lastName}`;
  }
}

class Address extends Model({
  tableName: 'addresses',
  init: (props: { street: string; userId: number }) => props,
}) {
  get user() {
    return User.filterBy({ id: this.attributes.userId }).first;
  }
}

// Creating
user = User.build({
  firstName: 'John',
  lastName: 'Doe',
  gender: 'male',
});
user.name === 'John Doe';
user = await user.save();

user = User.males.buildScoped({ firstName: 'John', lastName: 'Doe' });
user.gender === 'male';

user = await User.create({
  firstName: 'John',
  lastName: 'Doe',
  gender: 'male',
});

address = await user.addresses.createScoped({
  street: 'Bakerstr.'
});
address.userId === user.id

// Searching
users = await User.males.all();
user = await User.withFirstName('John').first();
addresses = await user.addresses.all();
users = await User.filterBy({ lastName: 'Doe' }).all();
users = await User.males().order({ key: 'lastName' }).all();
~~~

## Model Instances

### build

Initializes new record without saving it to the database.

~~~ts
user = User.build({ firstName: 'John', lastName: 'Doe' });
user.isNew === true;
user.name === 'John Doe';
~~~

### create

Returns a `Promise` which returns the created record on success or the initialized if sth. goes wrong.

~~~ts
user = await User.create({
  firstName: 'John',
  lastName: 'Doe',
});
~~~

### From Scopes and queries

An record can be `buildScoped` or `createScoped` from filters. These records are created with scope values as default.

~~~ts
address = user.addresses.buildScoped();
address.userId === user.id;

user = User.males.buildScoped();
user.gender === 'male';

user = User.withFirstName('John').buildScoped();
user.firstName === 'John';

user = User.withFirstName('John').filterBy({ lastName: 'Doe' }).buildScoped();
user.name === 'John Doe';

user = User.filterBy({ gender: 'male'}).buildScoped();
user.gender === 'male';
~~~

## Relations *WIP - Definitions will change*

Define the Model associations. Describe the relation between models to get predefined scopes and constructors.

### belongsTo *WIP - Definitions will change*

A `.belongsTo` association sets up a one-to-one connection with another model, such that each instance of the declaring model "belongs to" one instance of the other model.

For example, if your application includes users and addresses, and each user can be assigned to exactly one address, you'd declare the user model this way:

~~~ts
class User extends NextModel<UserSchema>() {
  get address() {
    return this.belongsTo(Address);
  }
};

user = await User.create({ addressId: id })
address = await user.address;
address.id === id;

user = User.build();
user.address = address;
user.addressId === address.id;
~~~

### hasMany *WIP - Definitions will change*

A `.hasMany` association indicates a one-to-many connection with another model. You'll often find this association on the "other side" of a [belongsTo](#belongsto) association. This association indicates that each instance of the model has zero or more instances of another model.

For example, in an application containing users and addresses, the author model could be declared like this:

~~~ts
class Address extends NextModel<AddressSchema>() {
  get users() {
    return this.hasMany(User);
  }
};

users = await address.users.all;
user = await address.users.create({ ... });
~~~

### hasOne *WIP - Definitions will change*

A `.hasOne` association also sets up a one-to-one connection with another model, but with somewhat different semantics (and consequences). This association indicates that each instance of a model contains or possesses one instance of another model.

For example, if each address in your application has only one user, you'd declare the user model like this:

~~~ts
class User extends NextModel<UserSchema>() {
  get address() {
    return this.hasOne(Address);
  }
};

class Address extends NextModel<AddressSchema>() {
  get user() {
    return this.belongsTo(User);
  }
};

address = await user.address;
~~~

## Queries

### filterBy

Special filter syntax is dependent on used connector. But all connectors and the cache supports basic attribute filtering and the special queries $and, $or and $now. All special queries start with an leading $. The filter can be completely cleared by calling `.unfiltered`

~~~ts
User.filterBy({ gender: 'male' });
User.filterBy({ age: 21 });
User.filterBy({ name: 'John', gender: 'male' });
User.filterBy({ $or: [
  { firstName: 'John' },
  { firstName: 'Foo' },
]});
User.filterBy({ $and: [
  { firstName: 'John' },
  { lastName: 'Doe' },
]});
User.filterBy({ $not: [
  { gender: 'male' },
  { gender: 'female' },
]});
User.males.filterBy({ name: 'John' });
User.males.unfiltered().females;
~~~

### orderBy

The fetched data can be sorted before fetching then. The `orderBy` function takes an object with property names as keys and the sort direction as value. Valid values are `asc` and `desc`. The order can be resetted by calling `.unordered`.

~~~ts
User.orderBy({ key: 'name' });
User.orderBy({ key: 'name', dir: SortDirection.Desc });
User.orderBy([{ key: 'name' }, { key: 'age', dir: SortDirection.Desc }]);
User.males.orderBy({ key: 'name' dir: SortDirection.Asc });
User.orderBy({ key: 'name' }).unordered;
~~~

### skipBy

An defined amont of matching records can be skipped with `.skipBy(amount)` and be resetted with  `.unskipped`. The current skipped amount of records can be fetched with `.skip`.

*Please note:* `.skipBy(amount)` and `.unskipped` will return a scoped model and will not modify the existing one.

Default value is `0`.

~~~ts
User.count(); //=> 10
User.skipBy(3).count(); //=> 7
User.count(); //=> 10 - creates new instance and does not modify existing
User.skipBy(15).count(); //=> 10
User.skipBy(5).unskipped.count(); //=> 10
~~~

### limitBy

The resultset can be limited with `.limitBy(amount)` and be resetted with  `.unlimited`. The current limit can be fetched with `.limit`.

*Please note:* `.limitBy(amount)` and `.unlimited` will return a scoped model and will not modify the existing one.

Default value is `Number.MAX_SAFE_INTEGER`.

~~~ts
User.count(); //=> 10
User.limitBy(3).count(); //=> 3
User.count(); //=> 10 - creates new instance and does not modify existing
User.limitBy(15).count(); //=> 10
User.limitBy(5).unlimited.count(); //=> 10
~~~

## Scopes

Scopes are predefined queries on a Model. For example filters, orders and limitations.

~~~ts
class User extends NextModel<UserSchema>() {
  static get males() {
    return this.filterBy({ gender: 'male' });
  }

  static get females() {
    return this.filterBy({ gender: 'female' });
  }

  static withFirstName(firstName) {
    return this.filterBy({ firstName });
  }
};
~~~

Now you can use these scopes to search/filter records.

~~~ts
User.males;
User.withFirstName('John');
~~~

Scopes can be chained with other scopes or search queries.

~~~ts
User.males.witFirsthName('John');
User.withFirstName('John').filterBy({ gender: 'transgender' });
~~~

### Build from scope

~~~ts
profile = User.males.buildScoped();
profile.gender === 'male';
~~~

### Scope chaining

~~~ts
User.males.young;
User.males.young.filterBy({ ... });
~~~

## Fetching

If you want to read the data of the samples of the [previous section](#fetching) you can fetch if with the following functions. Each fetching function will return a `Promise` to read the data.

### all

Returns all data of the query. Results can be limited by [skipBy](#skipby) and [limitBy](#limitby).

~~~ts
users = await User.all();
users = await User.males.all();
users = await User.filterBy({ firstName: 'John' }).all();
~~~

### first

Returns the first record which matches the query. Use **orderBy** to sort matching records before fetching the first one.

~~~ts
user = await User.first();
user = await User.males.first();
user = await User.filterBy({ firstName: 'John' }).first();
user = await User.orderBy({ lastName: 'asc' }).first();
~~~

### count

Returns the count of the matching records. Ignores [orderBy](#orderBy), [skip](#skipby) and [limit](#limitby) and always returns complete count of matching records.

~~~ts
count = await User.count();
count = await User.males.count();
count = await User.filterBy({ name: 'John' }).count();
~~~

## Batches *WIP - Definitions will change*

When there is a need to change/delete multiple records at once its recommended to use the following methods if possible. They provide a much better performance compared to do it record by record.

### updateaAll *WIP - Definitions will change*

`.updateAll(attrs)` updates all matching records with the passed attributes.

~~~ts
users = await User.filterBy({ firstName: 'John' }).updateAll({ gender: 'male' });
users = await User.updateAll({ encryptedPassword: undefined });
~~~

### deleteAll *WIP - Definitions will change*

Deletes and returns all matching records..

~~~ts
deletedUsers = await User.deleteAll();
deletedUsers = await User.query({ firstName: 'John', lastName: 'Doe' }).deleteAll();
~~~

## Model Parameters *WIP - Definitions will change*

Class Properties are static getters which can be defined with the class. Some of them can be modified by [Queries](#queries) which creates a new Class.

### connector *WIP - Definitions will change*

A connector is the bridge between models and the database. NextModel comes with an DefaultConnector which reads and writes on an simpe js object.

Available connectors:

* WIP [knex](https://github.com/tamino-martinius/node-next-model-knex-connector.git) (mySQL, postgres, sqlite3, ...)
* WIP [local-storage](https://github.com/tamino-martinius/node-next-model-local-storage-connector.git) (Client side for Browser usage)

~~~ts
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

~~~ts
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

### keys *WIP - Definitions will change*

The `.keys` will return all possible attributes you can pass to build new model Instances. The keys depend on [schema](#schema).

~~~ts
class Foo extends NextModel{
  static get schema(): Schema {
    return {
      bar: { type: 'string' },
    };
  }
};
Foo.keys //=> ['bar']
~~~

### filter *WIP - Definitions will change*

A default scope can be defined by adding a getter for `.filter`. You need call [unfiltered](#query) to search without this scope.

~~~ts
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

### order *WIP - Definitions will change*

Adds an default Order to all queries unless its overwritten.

~~~ts
class User extends NextModel<UserSchema>() {
  static get order() {
    return [{
      name: 'asc',
    }];
  }
};
~~~

### skip *WIP - Definitions will change*

Adds an default amount of skipped records on every query. This can be changed by [skipBy](#skipby) and removed by `.unskipped`.

~~~ts
class User extends NextModel<UserSchema>() {
  static get limit(): number {
    return 10;
  }
};
~~~

### limit *WIP - Definitions will change*

Limits all queries made to this model to an specific amount. This can be changed by [limitBy](#limitby) and removed by `.unlimited`.

~~~ts
class User extends NextModel<UserSchema>() {
  static get limit(): number {
    return 100;
  }
};
~~~

## Instance Attributes

### isNew

An record is new unless the record is saved to the database. NextModel checks if the identifier property is set for this attribute.

~~~ts
address = Address.build();
address.isNew === true;
address = await address.save();
address.isNew === false;
~~~

### isPersistent

The opposite of [isNew](#isnew). Returns false unless the record is not saved to the database.

~~~ts
address = Address.build();
address.isPersistent === false;
address = await address.save();
address.isPersistent === true;
~~~

### attributes

Returns an object which contains all properties defined by schema.

~~~ts
user = User.build({
  firstName: 'John',
  lastName: 'Doe',
  gender: 'male',
});

user.attributes === {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
  gender: 'male',
};
~~~

### isChanged *WIP - Definitions will change*

When you change a fresh build or created Class instance this property changes to true.

~~~ts
address = Address.build({
  street: '1st street',
  city: 'New York',
});
address.isChanged === false;
address.street = '2nd street';
address.isChanged === true;
~~~

This property does not change when the value is same after assignment.

~~~ts
address = Address.build({
  street: '1st street',
  city: 'New York',
});
address.isChanged === false;
address.street = '1st street';
address.isChanged === false;
~~~

### changes *WIP - Definitions will change*

The `changes` property contains an `object` of changes per property which has changed. Each entry contains an `from` and `to` property. Just the last value is saved at the `to` property if the property is changed multiple times. The changes are cleared once its set again to its initial value, or if the record got saved.

~~~ts
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

~~~ts
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

### Custom Attributes *WIP - Definitions will change*

Custom attributes can be defined as on every other js class.

~~~ts
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

~~~ts
address.assign({
  street: '1st Street',
  city: 'New York',
});
~~~

### save

Saves the record to database. Returns a `Promise` with the created record including its newly created id. An already existing record gets updated.

~~~ts
address = Address.build({street: '1st street'});
address = await address.save();
address.isNew === false;
~~~

~~~ts
address.street = 'changed';
address = await address.save();
~~~

### delete

Removes the record from database. Returns a `Promise` with the deleted record.

~~~ts
address.isNew === false;
address = await address.delete();
address.isNew === true;
~~~

### reload

Refetches the record from database. All temporary attributes and changes will be lost. Returns a `Promise` with the reloaded record.

~~~ts
address.isNew === false;
address.street = 'changed';
address.notAnDatabaseColumn = 'foo';
address = address.reload();
address.name === '1st Street';
address.notAnDatabaseColumn === undefined;
~~~

### revertCachanges

Reverts an unsaved change with `#revertChange(key)` or reverts all unsaved changed with `#revertChanges()`.

~~~ts
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

~~~ts
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

~~~ts
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

~~~ts
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

* `1.0.0` **2019-xx-xx** Complete rewrite in typescript
* `0.4.1` **2017-04-05** Bugfix: before and after callback
* `0.4.0` **2017-02-28** Added platform specific callbacks
* `0.3.0` **2017-02-27** Tracked property changes
* `0.2.0` **2017-02-25** Improved browser compatibility
* `0.1.0` **2017-02-23** Added Browser compatibility
* `0.0.4` **2017-02-16** Added callbacks for `build`, `create`, `save` and `delete`
* `0.0.3` **2017-02-12** Added CI
* `0.0.2` **2017-02-05** Published [knex connector](https://github.com/tamino-martinius/node-next-model-knex-connector.git)
* `0.0.1` **2017-01-23** Initial commit with query and scoping functions
